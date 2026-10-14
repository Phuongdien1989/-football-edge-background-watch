// RELEASE: ONLY PR #7 standalone instrumentation built from exact production SHA.
// Guards: verified Workers Logs events, production/rollback, no scan changes,
// no optimizer, no D1 telemetry writes, no synthetic fixtures.
// On any failure after upload starts, re-deploy the ORIGINAL active Worker version.
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';

const repo=process.env.GITHUB_REPOSITORY;
const commit=process.env.CANDIDATE_SHA;
const token=process.env.CLOUDFLARE_API_TOKEN, account=process.env.CLOUDFLARE_ACCOUNT_ID;
const githubToken=process.env.GITHUB_TOKEN;
const worker='football-edge-background-watch';
const productionCommit='6b7accb869cf64598b7ca39d5326d6b4080313e1';
const productionVersion='5f33a4b1-a299-4195-8a68-4646396a9214';
const preservedRollback='60781a4e-70cb-4c02-a036-2528c3048ed5';
const databaseId='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
const origin='https://'+worker+'.ngophuonghuy.workers.dev';
const prefix='/accounts/'+encodeURIComponent(account)+'/workers/scripts/'+worker;
const url='https://api.cloudflare.com/client/v4';
const report={schema:'FE_PR7_METER_PRODUCTION_RELEASE_V1',commit,production_baseline_commit:productionCommit,production_original_version:productionVersion,rollback_version:preservedRollback,db_id:databaseId,deployment:'NOT_ATTEMPTED',checks:{},errors:[]};
const save=()=>writeFileSync('pr7-meter-production-result.json',JSON.stringify(report,null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const cf=async(path,options={})=>{
 const r=await fetch(url+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});
 const b=await r.json().catch(()=>({}));
 if(!r.ok||b.success!==true)throw Error('CLOUDFLARE_API_'+r.status+'_CODES_'+(b.errors||[]).map(e=>e.code).join(','));
 return b.result;
};
const deployInfo=async()=>{
 const d=await cf(prefix+'/deployments');const v=d?.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('SINGLE_100_PERCENT_VERSION_NOT_VERIFIED');
 return v[0].version_id;
};
const getHealth=async()=>{
 const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(10000)});
 const b=await r.json().catch(()=>({}));
 return {status:r.status,body:b};
};
const scanState=h=>({enabled:h?.peak_status?.enabled,manualEnabled:h?.peak_status?.manualEnabled,next_alarm:h?.next_alarm,limit:h?.peak_status?.scan_budget?.limit});
async function queryEvents(needle,earliest){
 const data=await cf('/accounts/'+encodeURIComponent(account)+'/workers/observability/telemetry/query',
  {method:'POST',body:JSON.stringify({queryId:'fe-pr7-meter-release-audit',timeframe:{from:earliest,to:Date.now()},view:'events',parameters:{datasets:[],...(needle?{needle:{value:needle}}:{})},limit:300,dry:true})});
 const events=data?.events?.events||[];
 if(!Array.isArray(events))throw Error('OBSERVABILITY_EVENT_SHAPE_CHANGED');
 return {events,count:data?.events?.count||0,status:data?.run?.status};
}
const preserveScan=h=>{
 const s=scanState(h);
 if(s.enabled!==false||s.manualEnabled!==false||s.next_alarm!=null||s.limit!==720)throw Error('SCANNER_STATE_OR_LIMIT_DRIFT');
 return s;
};
let uploadAttempted=false;let preflightScan;
async function restoreProduction(){
 report.rollback_attempted=true;
 const json=await cf(prefix+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:productionVersion,percentage:100}],annotations:{'workers/message':'Automatic restoration after PR7 meter-only health or log failure'}})});
 report.rollback_api_deployment_id=json.id||null;
 if(await deployInfo()!==productionVersion)throw Error('ORIGINAL_VERSION_NOT_RESTORED');
 for(let n=0;n<16;n++){
  const h=await getHealth();
  if(h.status===200&&h.body.deploy_commit===productionCommit){
   report.rollback_health='PASS';
   const state=preserveScan(h.body);
   if(JSON.stringify(state)!==JSON.stringify(preflightScan))throw Error('ROLLBACK_SCAN_STATE_DRIFT');
   report.deployment='ROLLED_BACK';
   return;
  }
  await pause(2000);
 }
 throw Error('ROLLBACK_HEALTH_UNCONFIRMED');
}
try{
 if(!repo||!commit||!token||!account||!githubToken)throw Error('RELEASE_INPUT_MISSING');
 if(commit===productionCommit)throw Error('CANDIDATE_MUST_BE_DISTINCT_FROM_ORIGINAL');
 if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==commit)throw Error('CHECKOUT_HEAD_DRIFT');
 const cfg=readFileSync('wrangler.toml','utf8');
 const origCfg=execFileSync('git',['show',productionCommit+':wrangler.toml'],{encoding:'utf8'});
 if(cfg!==origCfg)throw Error('WRANGLER_CONFIG_CHANGED_FROM_PRODUCTION');
 const expectedCode=execFileSync('git',['show',productionCommit+':worker_notify_v138_peak_window.js'],{encoding:'utf8'})
  .replace("import {providerRateScope} from './provider_errors.mjs';","import {providerRateScope} from './provider_errors.mjs';\nimport {instrumentD1Env} from './d1-production-meter.mjs';")
  .replace('    super(ctx,env);',"    super(ctx,instrumentD1Env(env,'DURABLE_OBJECT'));")
  .replace('  const response=await base.fetch(request,env,ctx);',"  const response=await base.fetch(request,instrumentD1Env(env,'EDGE_WORKER'),ctx);");
 if(readFileSync('worker_notify_v138_peak_window.js','utf8')!==expectedCode)throw Error('BACKEND_CONTAINS_NON_MEASUREMENT_CHANGES');
 const allowed=new Set(['worker_notify_v138_peak_window.js','d1-production-meter.mjs','tests/test-d1-production-meter.mjs','tests/test-do-free-peak-window.mjs','.github/scripts/d1-meter-readonly-preflight.mjs','.github/scripts/d1-meter-tail-probe.mjs','.github/workflows/d1-meter-readonly-preflight.yml','.github/workflows/d1-meter-diff-regression.yml','.github/scripts/d1-telemetry-auth-audit.mjs','.github/workflows/d1-telemetry-auth-audit.yml','.github/scripts/d1-telemetry-log-receipt.mjs','.github/scripts/d1-meter-release.mjs','.github/workflows/d1-meter-production-release.yml']);
 const changed=execFileSync('git',['diff','--name-only',productionCommit,'HEAD'],{encoding:'utf8'}).trim().split('\n');
 if(changed.some(n=>!allowed.has(n)))throw Error('UNEXPECTED_FILES_IN_PRODUCTION_CANDIDATE');
 const prRes=await fetch('https://api.github.com/repos/'+repo+'/pulls/7',{headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 const pr=await prRes.json().catch(()=>({}));
 if(!prRes.ok||pr.state!=='open'||!pr.draft||pr.head?.sha!==commit||pr.head?.ref!=='diag/d1-production-meter-only-20261014')throw Error('PR7_CHECKPOINT_OR_DRAFT_STATE_DRIFT');
 if(await deployInfo()!==productionVersion)throw Error('PRODUCTION_ACTIVE_VERSION_DRIFT');
 await cf(prefix+'/versions/'+productionVersion);await cf(prefix+'/versions/'+preservedRollback);
 const h=await getHealth();
 if(h.status!==200||h.body.deploy_commit!==productionCommit)throw Error('PRODUCTION_HEALTH_COMMIT_DRIFT');
 preflightScan=preserveScan(h.body);
 report.scan_before=preflightScan;report.checks.original_worker_and_rollback='PASS';
 const settings=await cf(prefix+'/settings');
 const bindings=settings?.bindings||[];
 if(!bindings.some(x=>x.name==='FOOTBALL_DB'&&(x.id===databaseId||x.database_id===databaseId)))throw Error('D1_BINDING_ID_MISMATCH');
 if(!bindings.some(x=>x.name==='BACKGROUND_WATCHER'))throw Error('DURABLE_OBJECT_BINDING_MISSING');
 const sched=await cf(prefix+'/schedules');
 const crons=Array.isArray(sched)?sched:sched?.schedules;
 if(!Array.isArray(crons)||crons.length!==0)throw Error('AUTOMATIC_SCHEDULE_DRIFT');
 report.checks.db_binding_and_no_cron='PASS';
 const existing=await queryEvents(null,Date.now()-12*60000);
 if(existing.events.length<1||existing.status!=='COMPLETED')throw Error('AUTHENTICATED_REAL_LOG_RECEIPT_NOT_VERIFIED');
 report.checks.real_stored_logs={status:'PASS',event_count:existing.events.length};
 // Wrangler deploy from production-based source, no edits to config, triggers, data.
 uploadAttempted=true; report.deployment='UPLOADING';
 const cmd=spawnSync('npx',['--no-install','wrangler','deploy','--var','FE_DEPLOY_COMMIT:'+commit],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},encoding:'utf8',timeout:130000,maxBuffer:3*1024*1024});
 if(cmd.status!==0)throw Error('WRANGLER_DEPLOY_FAILED_EXIT_'+cmd.status);
 const newVersion=await deployInfo();
 if(newVersion===productionVersion)throw Error('DEPLOY_DID_NOT_ACTIVATE_DIAGNOSTIC');
 report.meter_version=newVersion;report.deployment='DEPLOYED_VERIFYING';
 let newHealth;
 for(let n=0;n<30;n++){
  const latest=await getHealth();
  if(latest.status===200&&latest.body.deploy_commit===commit){
    const state=preserveScan(latest.body);
    if(JSON.stringify(state)!==JSON.stringify(preflightScan))throw Error('SCAN_STATE_CHANGED_AFTER_METER_DEPLOY');
    newHealth=latest.body;break;
  }
  await pause(2000);
 }
 if(!newHealth)throw Error('METER_HEALTH_COMMIT_NOT_VERIFIED');
 report.checks.new_health_and_scan='PASS';
 // Exercise pre-existing D1 LIVE history read/ensure-table path (no insert,
 // no artificial production data, no scan start).
 const t=Date.now()-30000;
 const existingRoute=await fetch(origin+'/api/notify/ui-state',{signal:AbortSignal.timeout(12000)});
 report.checks.ui_state_http=existingRoute.status;
 if(!existingRoute.ok)throw Error('EXISTING_UI_STATE_ROUTE_FAILED_HTTP_'+existingRoute.status);
 let observed=null;
 for(let n=0;n<12;n++){
  const measured=await queryEvents('FE_D1_ROUTE_V1',t);
  if(measured.events.length>0){
    observed=measured;
    break;
  }
  await pause(2500);
 }
 if(!observed)throw Error('ACTUAL_METER_LOG_NOT_RECEIVED');
 report.checks.real_d1_route_log={status:'PASS',count:observed.events.length,window_from:new Date(t).toISOString(),window_to:new Date().toISOString(),source:'existing GET /api/notify/ui-state: D1 ensure/read path'};
 // Log events contain only route totals, no payload or credentials.
 const finalHealth=await getHealth();
 if(finalHealth.status!==200||finalHealth.body.deploy_commit!==commit||JSON.stringify(preserveScan(finalHealth.body))!==JSON.stringify(preflightScan))throw Error('POST_MEASUREMENT_HEALTH_DRIFT');
 if(await deployInfo()!==newVersion)throw Error('POST_MEASUREMENT_VERSION_DRIFT');
 report.deployment='DEPLOYED_VERIFIED';report.scan_after=scanState(finalHealth.body);
}catch(e){
 report.errors.push(String(e?.message||e).slice(0,240));
 if(uploadAttempted){
  try{await restoreProduction()}catch(err){report.rollback_error=String(err?.message||err).slice(0,240);report.deployment='ROLLBACK_UNCONFIRMED'}
 }
 process.exitCode=1;
}finally{
 save();
 console.log('FE_PR7_PRODUCTION_RELEASE '+JSON.stringify({schema:report.schema,commit:report.commit,production_baseline_commit:report.production_baseline_commit,deployment:report.deployment,meter_version:report.meter_version||null,rollback_version:report.rollback_version,checks:report.checks,scan_before:report.scan_before||null,scan_after:report.scan_after||null,errors:report.errors,rollback_error:report.rollback_error||null}));
}
