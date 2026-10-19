import {writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
const worker='football-edge-background-watch',root='https://api.cloudflare.com/client/v4/accounts/'+a;
const report={commit:process.env.GITHUB_SHA,mode:'READ_ONLY_ROUTING_AUDIT',mutations:0,provider_requests:0,errors:[]};
async function get(path){const r=await fetch(root+path,{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok||!j.success)throw Error('CF_GET_'+r.status+'_'+path);return j.result}
async function active(n){const v=(await get('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return v}
const signature=s=>({sha256:createHash('sha256').update(s).digest('hex'),bytes:Buffer.byteLength(s),has_error_detail:s.includes('error_detail'),has_sanitizer:s.includes('providerDiagnosticDetail'),has_diagnostics:s.includes('PACING_COOLDOWN_QUOTA_V6_UI_SYNC'),exports:s.match(/export\s*\{[^}]{0,2000}\}/g)?.map(x=>x.slice(0,1000))||[],detail_occurrences:s.split('error_detail').length-1});
try{
 assert(a&&t);
 report.versions_before={};for(const n of [worker,'shiny-silence-d892','football-edge-desktop-b2-test'])report.versions_before[n]=await active(n);
 const settings=await get('/workers/scripts/'+worker+'/settings');
 report.do_binding=(settings.bindings||[]).filter(x=>x.type==='durable_object_namespace');
 report.d1_binding=(settings.bindings||[]).filter(x=>x.type==='d1').map(x=>({name:x.name,id:x.id||x.database_id}));
 report.compatibility={date:settings.compatibility_date,flags:settings.compatibility_flags};
 const namespaces=await get('/workers/durable_objects/namespaces?per_page=100');
 report.namespaces=(Array.isArray(namespaces)?namespaces:[]).filter(n=>n.script===worker||n.script_name===worker||n.id==='a401c5da72a54ec1ba485db1b46d89c9').map(n=>({id:n.id,name:n.name,script:n.script,script_name:n.script_name,class:n.class,class_name:n.class_name,use_sqlite:n.use_sqlite}));
 report.version_metadata=[];
 for(const id of [report.versions_before[worker]?.[0]?.version_id,'0ce2f6fb-7bbb-4a92-9e6c-10a5caf78127']){
  if(!id)continue;const v=await get('/workers/scripts/'+worker+'/versions/'+id);
  report.version_metadata.push({id,keys:Object.keys(v),metadata:{created_on:v.metadata?.created_on,source:v.metadata?.source},resources_keys:Object.keys(v.resources||{}),script:v.resources?.script,do_bindings:(v.resources?.bindings||[]).filter(x=>x.type==='durable_object_namespace')});
 }
 const cr=await fetch(root+'/workers/scripts/'+worker+'/content/v2',{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(25000)});
 if(!cr.ok)throw Error('SCRIPT_CONTENT_'+cr.status);const source=await cr.text();report.latest_uploaded_content=signature(source);
 // This endpoint returns latest uploaded content; do NOT assume it is the active rollback version.
 execFileSync('npx',['--no-install','wrangler','deploy','--dry-run','--outdir','.routing-bundle'],{stdio:'pipe',timeout:120000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
 report.local_bundles=readdirSync('.routing-bundle').filter(x=>/\.m?js$/.test(x)).map(n=>({file:n,...signature(readFileSync('.routing-bundle/'+n,'utf8'))}));
 const h=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});const b=await h.json();
 report.health={status:h.status,commit:b.deploy_commit,scanner:b.peak_status?.enabled,manual:b.peak_status?.manualEnabled,alarm:b.next_alarm,has_error_detail:'error_detail' in (b.notify_status?.provider?.last_failure||{}),provider:b.notify_status?.provider,quota:b.notify_status?.global_api_quota};
 // Historical observability query only; never invokes the football provider.
 const from=Date.parse('2026-10-18T10:19:30Z'),to=Date.parse('2026-10-18T10:25:30Z');
 const lr=await fetch(root+'/workers/observability/telemetry/query',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({queryId:'fe-readonly-rollout-version-audit',timeframe:{from,to},view:'events',parameters:{datasets:[],needle:{value:worker}},limit:300,dry:true}),signal:AbortSignal.timeout(25000)});
 const lj=await lr.json();
 report.historical_logs={http:lr.status,status:lj.result?.run?.status,count:lj.result?.events?.count,events:(lj.result?.events?.events||[]).map(e=>{const m=e['$metadata']||{},w=e['$workers']||{};return {at:e.timestamp||m.timestamp,metadata_keys:Object.keys(m),workers_keys:Object.keys(w),service:m.service,scriptName:m.scriptName,scriptVersion:w.scriptVersion,version:m.version,trigger:w.event?.request?.url?new URL(w.event.request.url).pathname:null,type:w.eventType,outcome:w.outcome}})};
 const now=Date.now();const recent=await fetch(root+'/workers/observability/telemetry/query',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({queryId:'fe-paused-alarm-source-readonly',timeframe:{from:now-180000,to:now},view:'events',parameters:{datasets:[],needle:{value:worker}},limit:300,dry:true}),signal:AbortSignal.timeout(25000)});const recentJson=await recent.json();
 const counts={};for(const e of recentJson.result?.events?.events||[]){const w=e['$workers']||{},r=w.event?.request||{};let p=null;try{p=r.url?new URL(r.url).pathname:null}catch{};const k=JSON.stringify({version:w.scriptVersion?.id,do:!!w.durableObjectId,type:w.eventType,method:r.method,path:p,outcome:w.outcome});counts[k]=(counts[k]||0)+1}
 report.recent_traffic={from:new Date(now-180000).toISOString(),to:new Date(now).toISOString(),http:recent.status,total:recentJson.result?.events?.count,groups:Object.entries(counts).map(([key,count])=>({...JSON.parse(key),count}))};
 report.versions_after={};for(const n of Object.keys(report.versions_before))report.versions_after[n]=await active(n);
 assert.deepEqual(report.versions_after,report.versions_before);report.versions_unchanged=true;
}catch(e){report.errors.push(String(e.message||e).slice(0,300));process.exitCode=1}
finally{writeFileSync('provider-routing-readonly.json',JSON.stringify(report,null,2));console.log('PROVIDER_ROUTING_AUDIT '+JSON.stringify(report))}
