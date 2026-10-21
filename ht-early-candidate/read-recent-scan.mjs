import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,root='https://api.cloudflare.com/client/v4/accounts/'+account,helper='fe-ht-read-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
assert(account&&token);const report={at:new Date().toISOString(),provider_requests_requested:0,push_calls:0,scanner_toggled:false,production_deploys:0,samples:[],errors:[]};let created=false;
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+token,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+r.status);return j.result;}
async function versions(){const out={};for(const n of ['football-edge-background-watch','shiny-silence-d892','football-edge-desktop-b2-test'])out[n]=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return out;}
const source=`export default {async fetch(request,env){
 if(request.headers.get('authorization')!=='Bearer '+env.READ_AUTH)return new Response('Unauthorized',{status:401});
 if(request.method!=='GET')return new Response('GET only',{status:405});
 if(new URL(request.url).searchParams.has('ready'))return Response.json({ready:true});
 const stub=env.PRODUCTION_DO.get(env.PRODUCTION_DO.idFromName('football-edge-global'));
 const control=await stub.scanControl(),diagnostics=await stub.notifyDiagnostics(),devices=await stub.devices();
 const statusResponse=await stub.fetch(new Request('https://internal/api/notify/status'));
 const status=statusResponse.ok?await statusResponse.json():{error:'STATUS_'+statusResponse.status};
 const uiResponse=await stub.fetch(new Request('https://internal/api/notify/ui-state'));
 const ui=uiResponse.ok?await uiResponse.json():{error:'UI_'+uiResponse.status};
 const snapshots=(Array.isArray(ui.snapshots)?ui.snapshots:[]).slice(0,30).map(r=>{
   const f=r.fixture||{},h=r.engines?.H1||r.runtime?.H1?.eval||{},v=h.htValuation;
   return {id:r.fixture_id??f.fixture?.id,league:f.league?.name,home:f.teams?.home?.name,away:f.teams?.away?.name,status:f.fixture?.status?.short,minute:f.fixture?.status?.elapsed,goals:f.goals,captured_at:r.captured_at,age_seconds:r.captured_at?Math.round((Date.now()-r.captured_at)/1000):null,
    source_health:r.source_health,h1:{score:h.score??null,scoreMode:h.scoreMode??null,hardVeto:h.hardVeto??null,core:h.core?{available:h.core.available,strongCount:h.core.strongCount,pass:h.core.pass}:null,
    pricing:v?{state:v.state,action:v.action,dataOK:v.dataOK,modelOK:v.modelOK,marketOK:v.marketOK,reasons:v.reasons,sample:v.sample,line:v.recommendation?.line,odds:v.recommendation?.odds,ev:v.quote?.ev}:null},runtime_h1_present:!!r.runtime?.H1};
 });
 const enabled=devices.filter(d=>d?.prefs?.enabled);
 const settings=enabled.map(d=>({transport:d.transport||'web',apple:!!d.subscription?.endpoint&&(()=>{try{return new URL(d.subscription.endpoint).hostname.endsWith('.push.apple.com')}catch{return false}})(),h1:d.prefs.h1,h1Threshold:d.prefs.h1Threshold,goal:d.prefs.goal,gap:d.prefs.gap}));
 const scan=status.scan||{};
 return Response.json({at:Date.now(),control,diagnostics,subscriptions:{total:devices.length,enabled:enabled.length,settings},scan:{at:scan.at,startedAt:scan.startedAt,live:scan.live,scanned:scan.scanned,alertsAccepted:scan.alertsAccepted,signalCrossings:scan.signalCrossings,mechanisms:scan.mechanisms,apiToday:scan.apiToday,apiLimit:scan.apiLimit,rotationEstimateSeconds:scan.rotationEstimateSeconds,durationMs:scan.durationMs,errors:scan.errors,warnings:scan.warnings},snapshots,ui_error:ui.error??null,status_error:status.error??null});
}};`;
try{
 report.before=await versions();assert.deepEqual(report.before['football-edge-background-watch'],[{version_id:'7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a',percentage:100}]);assert.deepEqual(report.before['shiny-silence-d892'],[{version_id:'3166663f-f039-48f5-92ae-888890bb9455',percentage:100}]);
 const settings=await cf('/workers/scripts/football-edge-background-watch/settings'),binding=settings.bindings?.find(b=>b.name==='BACKGROUND_WATCHER');assert.equal(binding?.type,'durable_object_namespace');assert(binding.namespace_id);
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'read.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:binding.namespace_id},{type:'secret_text',name:'READ_AUTH',text:auth}]})],{type:'application/json'}));form.append('read.mjs',new Blob([source],{type:'application/javascript+module'}),'read.mjs');await cf('/workers/scripts/'+helper,{method:'PUT',body:form});created=true;
 await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});const domain=await cf('/workers/subdomain'),url='https://'+helper+'.'+domain.subdomain+'.workers.dev/';
 let ready=false;for(let i=0;i<8;i++){const r=await fetch(url+'?ready=1',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});if(r.ok){ready=true;break;}await new Promise(r=>setTimeout(r,1500));}assert(ready,'READ_HELPER_NOT_READY');
 for(let i=0;i<2;i++){if(i)await new Promise(r=>setTimeout(r,30000));const r=await fetch(url,{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(25000)});assert(r.ok,'READ_'+r.status);report.samples.push(await r.json());}
}catch(e){report.errors.push(String(e.message||e).slice(0,200));process.exitCode=1;}
finally{
 if(created)try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.helper_removed=true;}catch{report.errors.push('HELPER_CLEANUP_FAILED');process.exitCode=1;}
 if(report.before)try{report.after=await versions();assert.deepEqual(report.after,report.before);report.production_versions_unchanged=true;}catch{report.errors.push('PRODUCTION_VERSION_DRIFT');process.exitCode=1;}
 writeFileSync('ht-recent-scan-report.json',JSON.stringify(report,null,2));console.log('HT_RECENT_SCAN '+JSON.stringify(report));
}
