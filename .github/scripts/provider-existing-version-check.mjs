import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,root='https://api.cloudflare.com/client/v4/accounts/'+a,worker='football-edge-background-watch',path='/workers/scripts/'+worker;
const original='2be01a61-cc5d-43c7-9c6d-13e581296453',candidate='0ce2f6fb-7bbb-4a92-9e6c-10a5caf78127',baseline='3c97629e51251c56f9edeb8d0f67a7a0dad957a2',candidateSource='2b55cad3e6e28c38992c38f5df7b563471e2e50c';
const report={checkpoint:process.env.GITHUB_SHA,original,candidate,candidate_source:candidateSource,provider_requests:0,deployment:'NOT_ATTEMPTED',errors:[]};let attempted=false;
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+t,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();if(!r.ok||!j.success)throw Error('CF_'+r.status);return j.result}
async function active(n=worker){const v=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;assert.equal(v?.length,1);assert.equal(v[0].percentage,100);return v[0].version_id}
async function health(){const r=await fetch('https://'+worker+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(15000)});assert(r.ok);return r.json()}
function scan(h,requireNoAlarm=true){assert.equal(h.peak_status?.enabled,false,'SCANNER_ENABLED');assert.equal(h.peak_status?.manualEnabled,false,'MANUAL_SCAN_ENABLED');if(requireNoAlarm)assert.equal(h.next_alarm,null,'SCANNER_OFF_BUT_ALARM_PRESENT')}
function signature(bs){return bs.filter(x=>x.name!=='FE_DEPLOY_COMMIT').map(b=>JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).sort()}
async function clients(){assert.equal(await active('shiny-silence-d892'),'03c1d55d-358a-448b-96f3-f356704831df');assert.equal(await active('football-edge-desktop-b2-test'),'a332ee39-abb2-422d-a021-db78ef19cc10')}
async function deploy(id){await cf(path+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:id,percentage:100}],annotations:{'workers/message':'Diagnostic-only stored error observation with bounded DO convergence'}})})}
try{
 assert(a&&t);await clients();assert.equal(await active(),original);
 const h=await health();report.preflight={commit:h.deploy_commit,scanner:h.peak_status?.enabled,manual:h.peak_status?.manualEnabled,alarm:h.next_alarm};assert.equal(h.deploy_commit,baseline);scan(h);
 const before=await cf(path+'/settings'),v=await cf(path+'/versions/'+candidate);await cf(path+'/versions/'+original);
 assert.deepEqual(signature(v.resources?.bindings||[]),signature(before.bindings||[]),'CANDIDATE_RUNTIME_SETTINGS_DRIFT');
 const doBinding=before.bindings.find(x=>x.name==='BACKGROUND_WATCHER');assert.equal(doBinding.namespace_id,'a401c5da72a54ec1ba485db1b46d89c9');assert.equal(doBinding.class_name,'BackgroundWatcher');
 const sched=await cf(path+'/schedules');assert.deepEqual(Array.isArray(sched)?sched:sched.schedules,[]);
 report.preflight_checks='PASS';attempted=true;await deploy(candidate);report.deployment='OBSERVING';assert.equal(await active(),candidate);
 const started=Date.now();report.observations=[];
 while(Date.now()-started<300000){
  const h=await health();scan(h,false);report.observations.push({elapsed_ms:Date.now()-started,commit:h.deploy_commit,field_present:'error_detail' in (h.notify_status?.provider?.last_failure||{}),alarm:h.next_alarm});
  if(h.deploy_commit===candidateSource&&'error_detail' in (h.notify_status?.provider?.last_failure||{})){report.stored_provider=h.notify_status.provider;report.quota=h.notify_status.global_api_quota;report.deployment='DIAGNOSTIC_VERIFIED';break}
  if(report.observations.length%3===0)console.log('PROVIDER_CONVERGENCE_PROGRESS '+JSON.stringify(report.observations.at(-1)));
  await new Promise(r=>setTimeout(r,10000));
 }
 assert.equal(report.deployment,'DIAGNOSTIC_VERIFIED','DO_VERSION_CONVERGENCE_TIMEOUT');await clients();assert.equal(await active(),candidate);assert.deepEqual(signature((await cf(path+'/settings')).bindings),signature(before.bindings));
 // Temporary diagnosis complete: restore exact application baseline even on success.
}catch(e){report.errors.push(String(e.message||e).slice(0,300));process.exitCode=1}
finally{
 if(attempted){try{await deploy(original);let restored=false;for(let i=0;i<24;i++){const h=await health();if(await active()===original&&h.deploy_commit===baseline&&h.peak_status?.enabled===false){restored=true;break}await new Promise(r=>setTimeout(r,2500))}assert(restored);report.rollback='PASS'}catch{report.rollback='UNCONFIRMED';process.exitCode=1}}
 writeFileSync('provider-existing-version-result.json',JSON.stringify(report,null,2));console.log('PROVIDER_EXISTING_VERSION_RESULT '+JSON.stringify(report));
}
