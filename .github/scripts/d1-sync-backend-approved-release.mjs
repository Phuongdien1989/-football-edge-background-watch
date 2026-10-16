// OWNER-APPROVED RELEASE: BACKEND ONLY, exact immutable source commit.
// No Mobile/Desktop upload, no scan ON, no Push test, no D1 test writes.
// Failure after the upload boundary attempts rollback to original Worker version.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';

const approved='3c97629e51251c56f9edeb8d0f67a7a0dad957a2';
const baselineCommit='d73d4b19a069b0b2aed7e2687f27f1820f50e3d1';
const originalVersion='02d56762-ba08-4a8d-8654-bc9d522fc29a';
const olderRollback='5f33a4b1-a299-4195-8a68-4646396a9214';
const mobileVersion='03c1d55d-358a-448b-96f3-f356704831df';
const worker='football-edge-background-watch';
const phone='shiny-silence-d892';
const desktop='football-edge-desktop-b2-test';
const dbId='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const repo=process.env.GITHUB_REPOSITORY,ghToken=process.env.GITHUB_TOKEN;
const candidate=process.env.CANDIDATE_DIR;
const apiRoot='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account||'')+'/workers/scripts/';
const origin='https://'+worker+'.ngophuonghuy.workers.dev';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={schema:'FE_D1_SYNC_BACKEND_APPROVED_RELEASE_V1',approved_commit:approved,baseline_commit:baselineCommit,original_worker_version:originalVersion,older_rollback:olderRollback,backend_deployed:false,state:'PRECHECK',checks:{},errors:[],rollback:{attempted:false,verified:false},data_production_test_writes:0,scanner_modified:false,mobile_modified:false,desktop_modified:false};
const persist=()=>writeFileSync('d1-sync-backend-production-result.json',JSON.stringify(report,null,2));
let attemptStarted=false,originalScan=null,originalDesktop=null;
const request=async(url,method='GET',data=null)=>{
 const res=await fetch(url,{method,headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(22000)});
 const body=await res.json().catch(()=>({}));
 if(!res.ok||body.success!==true)throw Error('CLOUDFLARE_HTTP_'+res.status+'_CODES_'+(body.errors||[]).map(e=>e.code).join(','));
 return body.result;
};
const cf=(path,method='GET',data=null)=>request('https://api.cloudflare.com/client/v4'+path,method,data);
const info=async(name)=>{
 const deployment=await request(apiRoot+name+'/deployments');
 const v=deployment?.deployments?.[0]?.versions;
 if(!Array.isArray(v)||v.length!==1||v[0].percentage!==100||!v[0].version_id)throw Error('ACTIVE_100_PERCENT_VERSION_NOT_VERIFIED_'+name);
 return v[0].version_id;
};
const health=async()=>{
 const r=await fetch(origin+'/health',{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
 return {status:r.status,body:await r.json().catch(()=>({}))};
};
const scan=h=>({enabled:h?.peak_status?.enabled,manualEnabled:h?.peak_status?.manualEnabled,next_alarm:h?.next_alarm,limit:h?.peak_status?.scan_budget?.limit});
function off(h){
 const s=scan(h);
 if(s.enabled!==false||s.manualEnabled!==false||s.next_alarm!==null||s.limit!==720)throw Error('SCANNER_OFF_INVARIANT_FAILED');
 return s;
}
async function githubPR(n){
 const r=await fetch('https://api.github.com/repos/'+repo+'/pulls/'+n,{headers:{Authorization:'Bearer '+ghToken,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('GITHUB_PR_HTTP_'+r.status+'_'+n);
 const j=await r.json();
 return {head:j.head?.sha,draft:j.draft,state:j.state,merged:!!j.merged_at};
}
async function meterQuery(){
 // Authenticated read of existing Cloudflare observability logs only, not D1 writes.
 const r=await cf('/accounts/'+encodeURIComponent(account)+'/workers/observability/telemetry/query','POST',{
  queryId:'fe-d1-sync-backend-release-health',timeframe:{from:Date.now()-5*60*1000,to:Date.now()},
  view:'events',parameters:{datasets:[]},limit:50,dry:true
 });
 if(r?.run?.status!=='COMPLETED'||!Array.isArray(r?.events?.events))throw Error('PR7_OBSERVABILITY_QUERY_UNVERIFIED');
 return {status:r.run.status,existing_logs:r.events.events.length};
}
async function rollback(){
 report.rollback.attempted=true;
 // If no new version activated, still verify the original before marking recovered.
 let current=null;
 try{current=await info(worker)}catch{}
 if(current!==originalVersion){
  const d=await request(apiRoot+worker+'/deployments','POST',{strategy:'percentage',versions:[{version_id:originalVersion,percentage:100}],annotations:{'workers/message':'Restore original metered backend after D1 sync candidate verification failure'}});
  report.rollback.deployment_id=d?.id||null;
 }
 for(let i=0;i<18;i++){
  let v=null,h=null;
  try{v=await info(worker);h=await health()}catch{}
  if(v===originalVersion&&h?.status===200&&h.body?.deploy_commit===baselineCommit){
   if(JSON.stringify(off(h.body))!==JSON.stringify(originalScan))throw Error('ROLLBACK_SCAN_OFF_DRIFT');
   if(await info(phone)!==mobileVersion||await info(desktop)!==originalDesktop)throw Error('ROLLBACK_FRONTEND_VERSION_DRIFT');
   report.rollback.verified=true;report.state='ROLLED_BACK_VERIFIED';return;
  }
  await pause(2000);
 }
 throw Error('ROLLBACK_VERSION_OR_HEALTH_NOT_VERIFIED');
}
try{
 if(!token||!account||!repo||!ghToken||!candidate)throw Error('REQUIRED_RELEASE_INPUT_MISSING');
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:candidate,encoding:'utf8'}).trim();
 if(head!==approved)throw Error('APPROVED_COMMIT_CHECKOUT_MISMATCH');
 const cfg=readFileSync(candidate+'/wrangler.toml','utf8');
 const baseCfg=execFileSync('git',['show',baselineCommit+':wrangler.toml'],{cwd:candidate,encoding:'utf8'});
 if(cfg!==baseCfg)throw Error('WRANGLER_CONFIG_CHANGED');
 for(const file of ['worker_notify_v138_peak_window.js','d1-production-meter.mjs','worker_notify_v137_quota50000.js']){
  const before=execFileSync('git',['show',baselineCommit+':'+file],{cwd:candidate,encoding:'utf8'});
  if(readFileSync(candidate+'/'+file,'utf8')!==before)throw Error('PROTECTED_RUNTIME_FILE_CHANGED_'+file);
 }
 const changed=execFileSync('git',['diff','--name-only',baselineCommit,approved,'--','worker.js','worker_v122.js','worker_v123.js'],{cwd:candidate,encoding:'utf8'}).trim().split('\n');
 if(changed.sort().join(',')!==['worker.js','worker_v122.js','worker_v123.js'].sort().join(','))throw Error('BACKEND_PATCH_SET_DIFFERS_FROM_APPROVAL');
 report.checks.approved_exact_source_and_meter='PASS';
 const [pr6,pr7]=await Promise.all([githubPR(6),githubPR(7)]);
 if(pr6.head!=='79cd4ddfa4191fa5a6e620683947d77e6ecbf31c'||pr6.state!=='open'||pr6.merged)throw Error('PR6_SOURCE_DRIFT');
 if(pr7.head!==baselineCommit||pr7.state!=='open'||pr7.merged)throw Error('PR7_SOURCE_DRIFT');
 report.checks.pr6_pr7_untouched='PASS';
 const versions=await Promise.all([info(worker),info(phone),info(desktop)]);
 if(versions[0]!==originalVersion||versions[1]!==mobileVersion)throw Error('PRODUCTION_VERSION_DRIFT_BEFORE_UPLOAD');
 originalDesktop=versions[2];
 const [active,older,settings,schedules]=await Promise.all([
  request(apiRoot+worker+'/versions/'+originalVersion),
  request(apiRoot+worker+'/versions/'+olderRollback),
  request(apiRoot+worker+'/settings'),
  request(apiRoot+worker+'/schedules')
 ]);
 if(!active||!older)throw Error('ROLLBACK_VERSIONS_NOT_PRESENT');
 if(!settings?.bindings?.some(x=>x.name==='FOOTBALL_DB'&&(x.id===dbId||x.database_id===dbId)))throw Error('D1_BINDING_MISMATCH');
 if(!settings?.bindings?.some(x=>x.name==='BACKGROUND_WATCHER'))throw Error('DURABLE_OBJECT_BINDING_MISSING');
 const crons=Array.isArray(schedules)?schedules:schedules?.schedules;
 if(!Array.isArray(crons)||crons.length!==0)throw Error('CRON_DRIFT');
 const h=await health();
 if(h.status!==200||h.body?.deploy_commit!==baselineCommit)throw Error('ORIGINAL_HEALTH_COMMIT_DRIFT');
 originalScan=off(h.body);
 report.before={backend_version:versions[0],mobile_version:versions[1],desktop_version:versions[2],health_http:h.status,scanner:originalScan};
 report.checks.baseline_health_version_rollback_bindings_and_off='PASS';
 const observedBefore=await meterQuery();
 report.checks.pr7_log_transport_before=observedBefore;
 // One authorized production mutation begins here; no unapproved app or D1 calls.
 attemptStarted=true;report.state='UPLOADING_APPROVED_BACKEND';
 const cmd=spawnSync('npx',['--no-install','wrangler','deploy','--var','FE_DEPLOY_COMMIT:'+approved],{cwd:candidate,env:{...process.env,WRANGLER_SEND_METRICS:'false'},timeout:140000,encoding:'utf8',maxBuffer:2*1024*1024});
 report.checks.wrangler_exit_code=cmd.status;
 if(cmd.status!==0)throw Error('WRANGLER_DEPLOY_FAILED_EXIT_'+String(cmd.status));
 let newVersion=await info(worker);
 if(newVersion===originalVersion)throw Error('NEW_BACKEND_VERSION_NOT_ACTIVATED');
 report.new_backend_version=newVersion;
 report.state='DEPLOYED_VERIFYING';
 let newHealth=null;
 for(let i=0;i<30;i++){
  const h=await health();
  if(h.status===200&&h.body?.deploy_commit===approved){
   const s=off(h.body);
   if(JSON.stringify(s)!==JSON.stringify(originalScan))throw Error('SCANNER_CHANGED_DURING_DEPLOY');
   newHealth=h.body;break;
  }
  await pause(2000);
 }
 if(!newHealth)throw Error('NEW_BACKEND_HEALTH_AND_APPROVED_COMMIT_NOT_CONFIRMED');
 const newSettings=await request(apiRoot+worker+'/settings');
 if(!newSettings?.bindings?.some(x=>x.name==='FOOTBALL_DB'&&(x.id===dbId||x.database_id===dbId)))throw Error('NEW_BACKEND_D1_BINDING_DRIFT');
 if(!newSettings?.bindings?.some(x=>x.name==='BACKGROUND_WATCHER'))throw Error('NEW_BACKEND_DO_BINDING_DRIFT');
 const [newSchedule,versionAfter,phoneAfter,desktopAfter]=await Promise.all([
  request(apiRoot+worker+'/schedules'),info(worker),info(phone),info(desktop)
 ]);
 const afterCron=Array.isArray(newSchedule)?newSchedule:newSchedule?.schedules;
 if(!Array.isArray(afterCron)||afterCron.length!==0)throw Error('NEW_CRON_NONEMPTY');
 if(versionAfter!==newVersion)throw Error('POST_DEPLOY_VERSION_100_PERCENT_CHANGED');
 if(phoneAfter!==mobileVersion||desktopAfter!==originalDesktop)throw Error('FRONTEND_PRODUCTION_MODIFIED_OR_DRIFTED');
 report.checks.post_deploy_version_100_health_d1_do_frontend_scan_off='PASS';
 report.checks.pr7_log_transport_after=await meterQuery();
 report.checks.d1_route_log='PENDING_GENUINE_D1_ACTIVITY_SCANNER_OFF';
 const last=await health();
 if(last.status!==200||last.body?.deploy_commit!==approved||JSON.stringify(off(last.body))!==JSON.stringify(originalScan)||await info(worker)!==newVersion)throw Error('FINAL_HEALTH_VERSION_OR_SCANNER_DRIFT');
 report.after={backend_version:newVersion,deploy_commit:approved,mobile_version:phoneAfter,desktop_version:desktopAfter,health_http:last.status,scanner:scan(last.body),cron_count:0,db_binding:dbId};
 report.backend_deployed=true;
 report.state='DEPLOYED_VERIFIED_AWAITING_LIVE_SCAN';
}catch(e){
 report.errors.push(String(e?.message||e).slice(0,240));
 if(attemptStarted){
  try{await rollback()}catch(f){report.rollback.error=String(f?.message||f).slice(0,240);report.state='ROLLBACK_UNCONFIRMED';}
 }else report.state='PRECHECK_FAILED_NO_DEPLOY';
 process.exitCode=1;
}finally{
 persist();
 console.log('FE_D1_SYNC_APPROVED_RELEASE '+JSON.stringify({schema:report.schema,approved_commit:report.approved_commit,state:report.state,backend_version:report.new_backend_version||null,checks:report.checks,before:report.before||null,after:report.after||null,rollback:report.rollback,errors:report.errors}));
}
