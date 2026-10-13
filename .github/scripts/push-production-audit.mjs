import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
const prefix='/accounts/'+account, production='football-edge-background-watch';
const name='fe-notify-audit-'+String(process.env.GITHUB_RUN_ID);
const auth=randomBytes(32).toString('hex');
const report={commit:process.env.CANDIDATE_SHA,mode:'LIVE_SCAN_READ_ONLY_TRACE_NO_PROVIDER_CALLS',measuredAt:Date.now(),tests:[],cleanup:false};
async function api(path,options={}){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});
 const b=await r.json();if(!r.ok||b.success===false)throw Error('CF_HTTP_'+r.status+':'+(b.errors||[]).map(x=>x.code).join(','));
 return b.result;
}
const source=String.raw`
export default {async fetch(request,env){
 if(request.headers.get('authorization')!=='Bearer '+env.AUDIT_AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(request.url).searchParams.has('ready'))return Response.json({ready:true});
 const stub=env.PRODUCTION_DO.get(env.PRODUCTION_DO.idFromName('football-edge-global'));
 const read=async path=>{const r=await stub.fetch(new Request('https://internal'+path));return {http:r.status,data:await r.json()}};
 const status=await read('/api/notify/status');
 const latency=await read('/api/notify/latency');
 const peak=await read('/api/notify/peak-window');
 const devices=status.data.devices||[];
 const result={statusHTTP:status.http,scan:status.data.scan,scanControl:peak.data.scan_control,
 devices:devices.map((d,i)=>({label:'device-'+(i+1),prefs:d.prefs,updated:d.updated})),
 latency:latency.data.last,tests:[]};
 if(false){
  for(const [i,d] of devices.entries()){
   if(d.prefs?.enabled===false)continue;
   const r=await stub.fetch(new Request('https://internal/api/notify/test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:d.id})}));
   const b=await r.json();result.tests.push({device:'device-'+(i+1),http:r.status,accepted:b.ok===true,error:b.error||null});
  }
 }
 result.providerReads=[]; // Observe ongoing scan only; no extra provider calls.
 result.providerDiagnostic=await stub.notifyDiagnostics();
 return Response.json(result);
}};
`;
let created=false;
try{
 const before=await api(prefix+'/workers/scripts/'+production+'/deployments');
 report.productionVersionBefore=before.deployments?.[0]?.versions;
 const settings=await api(prefix+'/workers/scripts/'+production+'/settings');
 const namespace=(settings.bindings||[]).find(x=>x.name==='BACKGROUND_WATCHER')?.namespace_id;
 if(namespace!=='a401c5da72a54ec1ba485db1b46d89c9')throw Error('PRODUCTION_NAMESPACE_MISMATCH');
 const metadata={main_module:'audit.js',compatibility_date:'2026-10-01',bindings:[
 {type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:namespace},
 {type:'plain_text',name:'AUDIT_AUTH',text:auth}
 ]};
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 form.append('audit.js',new Blob([source],{type:'application/javascript+module'}),'audit.js');
 await api(prefix+'/workers/scripts/'+name,{method:'PUT',body:form});created=true;
 await api(prefix+'/workers/scripts/'+name+'/subdomain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:true})});
 const domain=await api(prefix+'/workers/subdomain');
 const url='https://'+name+'.'+domain.subdomain+'.workers.dev/';
 let ready=false;
 for(let i=0;i<10;i++){
  const r=await fetch(url+'?ready=1',{headers:{authorization:'Bearer '+auth},signal:AbortSignal.timeout(15000)});
  if(r.ok){ready=true;break;}
  await new Promise(resolve=>setTimeout(resolve,3000));
 }
 if(!ready)throw Error('AUDIT_ROUTE_NOT_READY');
 const response=await fetch(url,{headers:{authorization:'Bearer '+auth},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('AUDIT_HTTP_'+response.status);
 report.audit=await response.json();
 const database=(settings.bindings||[]).find(x=>x.name==='FOOTBALL_DB')?.id;
 const read=async(sql,params=[])=>{
  const rows=await api(prefix+'/d1/database/'+database+'/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sql,params})});
  return rows.flatMap(x=>x.results||[]);
 };
 report.liveReasons=await read("SELECT json_extract(payload,'$.last.reason') AS reason,json_extract(payload,'$.last.sourceHealth.stats') AS stats,COUNT(*) AS fixtures,MAX(updated_at) AS last_update FROM fe_notify_live_state WHERE COALESCE(json_extract(payload,'$.__fe_deleted'),0)=0 GROUP BY reason,stats");
 report.recentFixtures=await read("SELECT fixture_id,updated_at,json_extract(payload,'$.last') AS last,json_extract(payload,'$.ui.snapshot.source_health') AS ui_source_health,json_extract(payload,'$.ui.captured_at') AS published_at,json_extract(payload,'$.ui.engines') AS engines,json_extract(payload,'$.uiError') AS ui_error,json_array_length(json_extract(payload,'$.history')) AS history_points,json_array_length(json_extract(payload,'$.h1History')) AS h1_history_points,json_array_length(json_extract(payload,'$.hcHistory')) AS hc_history_points FROM fe_notify_live_state WHERE COALESCE(json_extract(payload,'$.__fe_deleted'),0)=0 ORDER BY updated_at DESC LIMIT 12");
 report.alertStates=await read("SELECT CASE WHEN a.key LIKE '%:gap' THEN 'HC' WHEN a.key LIKE '%:h1' THEN 'H1' ELSE 'FT' END AS kind,COUNT(*) AS states,SUM(CASE WHEN json_extract(a.value,'$.armed')=0 THEN 1 ELSE 0 END) AS disarmed,MAX(json_extract(a.value,'$.lastSent')) AS last_accepted FROM fe_notify_live_state t,json_each(t.payload,'$.alerts') a GROUP BY kind");
 report.validationRecent=await read("SELECT validation_type,result_key,COUNT(*) AS n,MAX(created_at) AS last_created FROM validation_results WHERE validation_type LIKE 'PUSH_%' AND created_at>=? GROUP BY validation_type,result_key",[Date.now()-86400000]);
 const after=await api(prefix+'/workers/scripts/'+production+'/deployments');
 report.productionVersionAfter=after.deployments?.[0]?.versions;
 if(JSON.stringify(report.productionVersionAfter)!==JSON.stringify(report.productionVersionBefore))throw Error('PRODUCTION_CHANGED_DURING_AUDIT');
}catch(e){report.error=e.message;process.exitCode=1;}
finally{
 if(created){try{await api(prefix+'/workers/scripts/'+name,{method:'DELETE'});report.cleanup=true;}catch(e){report.cleanupError=e.message;process.exitCode=1;}}
 writeFileSync('push-production-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
