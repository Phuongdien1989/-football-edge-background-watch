import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,root='https://api.cloudflare.com/client/v4/accounts/'+a,worker='football-edge-background-watch',helper='fe-live-check-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
const expected='04cc044d-412f-4844-9b83-c7c786eedd13',source='da5242bb41b2401271f52dda17b0e2208e7e3819';
const report={run:process.env.GITHUB_RUN_ID,production_source:source,production_version:expected,logical_provider_call_cap:2,scanner_enabled_by_test:false,push_sent:false,production_D1_writes_requested:0,cleanup:false,errors:[]};let created=false;
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+t,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();if(!r.ok||!j.success)throw Error('CF_'+r.status);return j.result}
async function versions(){const out={};for(const n of [worker,'shiny-silence-d892','football-edge-desktop-b2-test'])out[n]=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;return out}
const helperSource=`export default {async fetch(request,env){
 if(request.headers.get('authorization')!=='Bearer '+env.CHECK_AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(request.url).searchParams.has('ready'))return Response.json({ready:true});
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const stub=env.PRODUCTION_DO.get(env.PRODUCTION_DO.idFromName('football-edge-global'));
 const d=await stub.notifyDiagnostics();if(d.diagnostics_version!=='PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE')return Response.json({error:'DO_VERSION_MISMATCH'},{status:409});
 const out={diagnostics_before:{provider:d.provider,quota:d.global_api_quota},attempts:[]};
 const devices=await stub.devices();out.devices={total:devices.length,enabled:devices.filter(x=>x?.prefs?.enabled).length,settings:devices.filter(x=>x?.prefs?.enabled).map(x=>({transport:x.transport||'web',h1_threshold:x.prefs.h1Threshold??null,goal_threshold:x.prefs.goalThreshold??null,gap_threshold:x.prefs.gapThreshold??null}))};
 const pacing=d.provider?.pacing||{},until=Math.max(Number(pacing.cooldown_until||0),...(pacing.endpoint_cooldowns||[]).filter(x=>x.request_kind==='LIVE_WITH_TIMEZONE').map(x=>Number(x.until||0)));
 if(until>Date.now()){out.blocked_until=until;out.error='EXISTING_PROVIDER_COOLDOWN';return Response.json(out)}
 try{const rows=await stub.api('/fixtures',{live:'all'},true);out.attempts.push({kind:'LIVE',ok:true,count:rows.length});const f=rows.find(x=>['1H','2H'].includes(x.fixture?.status?.short))||rows[0];if(f?.fixture?.id){const stats=await stub.api('/fixtures/statistics',{fixture:f.fixture.id},true);out.attempts.push({kind:'STATISTICS',fixture:f.fixture.id,ok:true,rows:stats.length})}}
 catch(e){out.error=String(e.message||e).slice(0,160)}
 const after=await stub.notifyDiagnostics();out.diagnostics_after={provider:after.provider,quota:after.global_api_quota};return Response.json(out);
}};`;
try{
 assert(a&&t);report.versions_before=await versions();assert.deepEqual(report.versions_before[worker],[{version_id:expected,percentage:100}]);
 const hr=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)}),h=await hr.json();assert.equal(h.deploy_commit,source);assert.equal(h.peak_status?.enabled,false);assert.equal(h.next_alarm,null);
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'check.mjs',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'PRODUCTION_DO',namespace_id:'a401c5da72a54ec1ba485db1b46d89c9'},{type:'secret_text',name:'CHECK_AUTH',text:auth}]})],{type:'application/json'}));form.append('check.mjs',new Blob([helperSource],{type:'application/javascript+module'}),'check.mjs');await cf('/workers/scripts/'+helper,{method:'PUT',body:form});created=true;
 await cf('/workers/scripts/'+helper+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});const domain=await cf('/workers/subdomain'),url='https://'+helper+'.'+domain.subdomain+'.workers.dev/';
 let ready=false;for(let i=0;i<10;i++){const r=await fetch(url+'?ready=1',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});if(r.ok){ready=true;break}await new Promise(r=>setTimeout(r,2000))}assert(ready);
 const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(60000)});assert(r.ok);report.live_check=await r.json();
 const final=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)});const fh=await final.json();report.health_after={commit:fh.deploy_commit,scanner:fh.peak_status?.enabled,alarm:fh.next_alarm,diagnostics:fh.notify_status?.diagnostics_version};assert.equal(fh.deploy_commit,source);assert.equal(fh.peak_status?.enabled,false);assert.equal(fh.next_alarm,null);
 if(report.live_check.error){report.errors.push(report.live_check.error);process.exitCode=1}
}catch(e){report.errors.push(String(e.message||e).slice(0,250));process.exitCode=1}
finally{
 if(created){try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.cleanup=true}catch{report.errors.push('HELPER_CLEANUP_FAILED');process.exitCode=1}}
 if(report.versions_before){try{report.versions_after=await versions();assert.deepEqual(report.versions_after,report.versions_before);report.versions_unchanged=true}catch{report.errors.push('VERSION_DRIFT');process.exitCode=1}}
 writeFileSync('backend-completion-live-result.json',JSON.stringify(report,null,2));console.log('BACKEND_COMPLETION_LIVE '+JSON.stringify(report));
}
