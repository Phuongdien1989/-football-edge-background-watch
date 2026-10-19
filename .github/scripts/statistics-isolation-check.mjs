import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,root='https://api.cloudflare.com/client/v4/accounts/'+a,worker='football-edge-background-watch',helper='fe-stats-isolate-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
const expected='04cc044d-412f-4844-9b83-c7c786eedd13',source='da5242bb41b2401271f52dda17b0e2208e7e3819';
const report={run:process.env.GITHUB_RUN_ID,user_reported_apps_closed:true,quiet_wait_ms:120000,fixture:1555512,reason:'Previously saved, raw-verified FT fixture; this is an endpoint diagnostic, not a new football signal.',logical_statistics_calls:0,scanner_enabled:false,push_sent:false,production_D1_writes_requested:0,errors:[],cleanup:false};let created=false;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+t,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();if(!r.ok||!j.success)throw Error('CF_'+r.status);return j.result}
async function versions(){const v={};for(const n of [worker,'shiny-silence-d892','football-edge-desktop-b2-test'])v[n]=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return v}
async function health(){const r=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)}),h=await r.json();assert(r.ok);assert.equal(h.deploy_commit,source,'PRODUCTION_SOURCE_CHANGED');assert.equal(h.peak_status?.enabled,false,'SCANNER_ENABLED');assert.equal(h.peak_status?.manualEnabled,false);assert.equal(h.next_alarm,null,'PENDING_ALARM');return h}
const helperSource=`export default {async fetch(r,e){
 if(r.headers.get('authorization')!=='Bearer '+e.CHECK_AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(r.url).searchParams.has('ready'))return Response.json({ready:true});
 const stub=e.PRODUCTION_DO.get(e.PRODUCTION_DO.idFromName('football-edge-global'));
 const diagnostics=async()=>{const d=await stub.notifyDiagnostics();return {build:d.diagnostics_version,provider:d.provider,quota:d.global_api_quota}};
 if(r.method==='GET')return Response.json(await diagnostics());
 if(r.method!=='POST')return new Response('Method not allowed',{status:405});
 const before=await diagnostics();const out={fixture:1555512,started_at:Date.now(),before};
 const until=Number(before.provider?.pacing?.cooldown_until||0);if(until>Date.now()){out.error='EXISTING_GLOBAL_COOLDOWN';return Response.json(out)}
 try{const rows=await stub.api('/fixtures/statistics',{fixture:1555512},true);out.ok=true;out.team_rows=rows.length;out.statistics_items=rows.reduce((n,x)=>n+(Array.isArray(x.statistics)?x.statistics.length:0),0)}catch(err){out.ok=false;out.error=String(err.message||err).slice(0,180)}
 out.completed_at=Date.now();out.after=await diagnostics();return Response.json(out);
}};`;
try{
 assert(a&&t);report.versions_before=await versions();assert.deepEqual(report.versions_before[worker],[{version_id:expected,percentage:100}]);const h=await health();report.health_before={source:h.deploy_commit,scanner:h.peak_status.enabled,alarm:h.next_alarm};
 report.quiet_from=Date.now();for(let i=0;i<3;i++){await pause(40000);const h=await health();console.log('ISOLATION_WAIT '+JSON.stringify({elapsed_ms:Date.now()-report.quiet_from,scanner:h.peak_status.enabled,alarm:h.next_alarm,quota_used:h.notify_status?.global_api_quota?.used}))}report.quiet_to=Date.now();
 // Query existing backend logs only; direct browser-to-provider calls are not observable here.
 const lr=await cf('/workers/observability/telemetry/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queryId:'fe-isolated-statistics-window',timeframe:{from:report.quiet_from,to:report.quiet_to},view:'events',parameters:{datasets:[],needle:{value:worker}},limit:300,dry:true})});
 const events=lr.events?.events||[];const counts={};for(const x of events){const w=x['$workers']||{},r=w.event?.request||{};let p=null;try{p=r.url?new URL(r.url).pathname:null}catch{}if(p==='/health'||p==='/api/notify/peak-window')continue;const key=JSON.stringify({method:r.method,path:p,type:w.eventType,do:!!w.durableObjectId});counts[key]=(counts[key]||0)+1}report.backend_window={status:lr.run?.status,total:lr.events?.count,groups:Object.entries(counts).map(([k,count])=>({...JSON.parse(k),count})),limitation:'User reported closing apps; absence of backend requests does not independently measure all direct provider/API-key traffic.'};
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'check.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:'a401c5da72a54ec1ba485db1b46d89c9'},{type:'secret_text',name:'CHECK_AUTH',text:auth}]})],{type:'application/json'}));form.append('check.mjs',new Blob([helperSource],{type:'application/javascript+module'}),'check.mjs');await cf('/workers/scripts/'+helper,{method:'PUT',body:form});created=true;
 await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});const domain=await cf('/workers/subdomain'),url='https://'+helper+'.'+domain.subdomain+'.workers.dev/';let ready=false;
 for(let i=0;i<10;i++){const r=await fetch(url+'?ready=1',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});if(r.ok){ready=true;break}await pause(2000)}assert(ready);
 const dr=await fetch(url,{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(15000)}),d=await dr.json();assert(dr.ok);report.diagnostics_before=d;assert.equal(d.build,'PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE');assert(Number(d.quota?.remaining)>4);
 const p=d.provider?.pacing||{},until=Math.max(Number(p.cooldown_until||0),...(p.endpoint_cooldowns||[]).filter(x=>x.request_kind==='STATISTICS').map(x=>Number(x.until||0)));assert(until<=Date.now(),'EXISTING_COOLDOWN_NO_PROBE');
 report.logical_statistics_calls=1;const rr=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(60000)});assert(rr.ok);report.result=await rr.json();
 const before=report.result.before?.provider?.pacing?.instance_physical_attempts,after=report.result.after?.provider?.pacing?.instance_physical_attempts;report.physical_attempts_delta=Number.isFinite(before)&&Number.isFinite(after)&&after>=before?after-before:null;
 if(report.result.error){report.errors.push(report.result.error);process.exitCode=1}
 const post=await health();report.health_after={source:post.deploy_commit,scanner:post.peak_status.enabled,alarm:post.next_alarm};
}catch(e){report.errors.push(String(e.message||e).slice(0,250));process.exitCode=1}
finally{
 if(created){try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.cleanup=true}catch{report.errors.push('HELPER_CLEANUP_FAILED');process.exitCode=1}}
 if(report.versions_before){try{report.versions_after=await versions();assert.deepEqual(report.versions_after,report.versions_before);report.versions_unchanged=true}catch{report.errors.push('VERSION_DRIFT');process.exitCode=1}}
 writeFileSync('statistics-isolation-result.json',JSON.stringify(report,null,2));console.log('STATISTICS_ISOLATION_RESULT '+JSON.stringify(report));
}
