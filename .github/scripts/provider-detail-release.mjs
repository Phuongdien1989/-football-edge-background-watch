import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,sha=process.env.GITHUB_SHA;
const baseline='3c97629e51251c56f9edeb8d0f67a7a0dad957a2',original='2be01a61-cc5d-43c7-9c6d-13e581296453',worker='football-edge-background-watch',namespace='a401c5da72a54ec1ba485db1b46d89c9';
const root='https://api.cloudflare.com/client/v4/accounts/'+account,origin='https://'+worker+'.ngophuonghuy.workers.dev',helper='fe-detail-read-'+process.env.GITHUB_RUN_ID,auth=randomBytes(32).toString('hex');
const report={commit:sha,original_version:original,baseline,deployed:false,provider_requests:0,production_d1_writes_requested:0,checks:{},errors:[]};
let attempted=false,created=false,settingsBefore;
async function cf(path,opts={}){const r=await fetch(root+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();if(!r.ok||!j.success)throw Error('CF_HTTP_'+r.status+'_CODES_'+(j.errors||[]).map(x=>x.code).join(','));return j.result}
const json=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function version(name){const v=(await cf('/workers/scripts/'+name+'/deployments')).deployments?.[0]?.versions;assert.equal(v?.length,1);assert.equal(v[0].percentage,100);return v[0].version_id}
async function health(commit){const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(15000)}),h=await r.json();assert.equal(r.status,200);assert.equal(h.deploy_commit,commit);assert.equal(h.peak_status?.enabled,false);assert.equal(h.peak_status?.manualEnabled,false);assert.equal(h.next_alarm,null);return {commit:h.deploy_commit,scanner_off:true}}
async function clients(){assert.equal(await version('shiny-silence-d892'),'03c1d55d-358a-448b-96f3-f356704831df');assert.equal(await version('football-edge-desktop-b2-test'),'a332ee39-abb2-422d-a021-db78ef19cc10')}
function bindingSignature(s){return (s.bindings||[]).filter(b=>b.name!=='FE_DEPLOY_COMMIT').map(b=>JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).sort()}
const run=(args)=>{try{return execFileSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',stdio:'pipe',timeout:120000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}})}catch{throw Error('WRANGLER_COMMAND_FAILED_'+args[0])}};
try{
 if(process.env.FE_RESTORE_ONLY==='true'){
  report.version_before=await version(worker);
  await cf('/workers/scripts/'+worker+'/deployments',json({strategy:'percentage',versions:[{version_id:original,percentage:100}],annotations:{'workers/message':'Verify restoration of pre-diagnostic production backend'}}));
  let restored=false;
  for(let i=0;i<25;i++){
   const hr=await fetch(origin+'/health',{signal:AbortSignal.timeout(15000)}),h=await hr.json();
   report.observed_health_commit=h.deploy_commit;report.version_after=await version(worker);
   if(report.version_after===original&&h.deploy_commit===baseline&&h.peak_status?.enabled===false&&h.next_alarm===null){restored=true;break}
   await new Promise(r=>setTimeout(r,2000));
  }
  assert(restored,'RESTORED_VERSION_OR_COMMIT_NOT_VERIFIED');await clients();report.rollback='PASS';report.checks.restoration='PASS';
 }else{
 assert(account&&token&&sha);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sha);
 execFileSync('node',['tests/test-provider-diagnostic-detail.mjs'],{stdio:'inherit'});
 const allowed=['provider-diagnostic-detail.mjs','worker_notify_v138_peak_window.js','tests/test-provider-diagnostic-detail.mjs','.github/scripts/provider-detail-release.mjs','.github/workflows/provider-detail-release.yml'];
 const changed=execFileSync('git',['diff','--name-only',baseline,'HEAD'],{encoding:'utf8'}).trim().split('\n');assert(changed.every(x=>allowed.includes(x)));
 await clients();assert.equal(await version(worker),original);await health(baseline);
 await cf('/workers/scripts/'+worker+'/versions/'+original);await cf('/workers/scripts/'+worker+'/versions/60781a4e-70cb-4c02-a036-2528c3048ed5');
 settingsBefore=await cf('/workers/scripts/'+worker+'/settings');const bs=settingsBefore.bindings||[];
 assert.equal(bs.find(x=>x.name==='BACKGROUND_WATCHER')?.namespace_id,namespace);
 const db=bs.find(x=>x.name==='FOOTBALL_DB');assert.equal(db?.id||db?.database_id,'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4');
 assert(bs.every(x=>['plain_text','secret_text','d1','durable_object_namespace'].includes(x.type)));
 const sched=await cf('/workers/scripts/'+worker+'/schedules');assert.deepEqual(Array.isArray(sched)?sched:sched.schedules,[]);
 const cfg=JSON.parse(execFileSync('python3',['-c',"import tomllib,json;print(json.dumps(tomllib.load(open('wrangler.toml','rb'))))"],{encoding:'utf8'}));
 cfg.vars=Object.fromEntries(bs.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));
 assert(bs.find(x=>x.name==='APISPORTS_KEY')?.type==='secret_text');
 for(const name of ['BACKGROUND_TOKEN','VAPID_PRIVATE_KEY'])assert(!bs.some(b=>b.name===name&&b.type==='plain_text'));
 cfg.vars.FE_DEPLOY_COMMIT=sha;cfg.compatibility_date=settingsBefore.compatibility_date||cfg.compatibility_date;cfg.compatibility_flags=settingsBefore.compatibility_flags||cfg.compatibility_flags;
 writeFileSync('.provider-detail-wrangler.json',JSON.stringify(cfg));run(['deploy','--config','.provider-detail-wrangler.json','--dry-run']);report.checks.preflight='PASS';
 attempted=true;run(['deploy','--config','.provider-detail-wrangler.json','--keep-vars']);
 report.production_version=await version(worker);assert.notEqual(report.production_version,original);
 let ok=false;for(let i=0;i<12;i++){try{await health(sha);ok=true;break}catch{await new Promise(r=>setTimeout(r,2000))}}assert(ok);
 const after=await cf('/workers/scripts/'+worker+'/settings');assert.deepEqual(bindingSignature(after),bindingSignature(settingsBefore));await clients();report.checks.live_settings_and_clients_unchanged='PASS';
 // Read existing diagnostics through the production health path after DO rollout propagation.
 let detailReady=false;
 for(let i=0;i<30;i++){
  const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(15000)}),h=await r.json();
  if(r.ok&&h.deploy_commit===sha&&h.notify_status?.provider?.last_failure&&'error_detail' in h.notify_status.provider.last_failure){
   report.stored_diagnostics={provider:h.notify_status.provider,quota:h.notify_status.global_api_quota};detailReady=true;break;
  }
  await new Promise(r=>setTimeout(r,2000));
 }
 assert(detailReady,'DO_DIAGNOSTIC_ROLLOUT_NOT_VISIBLE');await health(sha);await clients();assert.equal(await version(worker),report.production_version);report.deployed=true;report.checks.stored_error_read='PASS';
 }
}catch(e){report.errors.push(String(e.message||e).slice(0,350));if(attempted){try{await cf('/workers/scripts/'+worker+'/deployments',json({strategy:'percentage',versions:[{version_id:original,percentage:100}],annotations:{'workers/message':'Restore exact backend after read-only detail diagnostic failure'}}));assert.equal(await version(worker),original);let restored=false;for(let i=0;i<25;i++){try{await health(baseline);restored=true;break}catch{await new Promise(r=>setTimeout(r,2000))}}assert(restored);report.rollback='PASS'}catch{report.rollback='UNCONFIRMED'}}process.exitCode=1}
finally{
 if(created){try{await cf('/workers/scripts/'+helper,{method:'DELETE'});report.helper_cleanup=true}catch{report.helper_cleanup=false;process.exitCode=1}}
 try{unlinkSync('.provider-detail-wrangler.json')}catch{}
 writeFileSync('provider-detail-release-result.json',JSON.stringify(report,null,2));console.log('PROVIDER_DETAIL_RESULT '+JSON.stringify(report));
}
