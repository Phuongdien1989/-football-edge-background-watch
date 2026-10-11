import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const evidence=JSON.parse(readFileSync('cloudflare-readonly-preflight.json','utf8'));
const cfg=readFileSync('wrangler.toml','utf8');
const candidate=process.env.CANDIDATE_SHA;
const repository=process.env.GITHUB_REPOSITORY;
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const rollback='60781a4e-70cb-4c02-a036-2528c3048ed5';
const expectedProduction='60781a4e-70cb-4c02-a036-2528c3048ed5';
const worker=evidence.worker,database=evidence.database?.uuid;
const prefix='/accounts/'+encodeURIComponent(account);
const report={commit:candidate,rollback,checks:{},productionDeploy:'NOT_ATTEMPTED'};
const save=()=>writeFileSync('peak-production-result.json',JSON.stringify(report,null,2));
async function api(path,options={}){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(30000)});
 const b=await r.json();if(!r.ok||b.success===false)throw Error('CF_HTTP_'+r.status+'_CODES_'+(b.errors||[]).map(x=>x.code).join(','));return b.result;
}
const run=(args,env={})=>{const r=spawnSync('npx',args,{stdio:'inherit',env:{...process.env,...env}});if(r.status!==0)throw Error('COMMAND_FAILED:'+args.slice(0,2).join(' '));};
const total=(rows,day,key)=>rows.filter(x=>x.dimensions?.date===day).reduce((n,x)=>n+Number(x.sum?.[key]||0),0);
let previousSchedules=null,deployed=false;
try{
 if(!candidate||!token||!account||!database||!worker)throw Error('DEPLOY_INPUT_MISSING');
 if(evidence.commit!==candidate||evidence.blockers?.length)throw Error('PREFLIGHT_CHECKPOINT_MISMATCH_OR_BLOCKED');
 if(evidence.rollbackVersion?.id!==rollback)throw Error('ROLLBACK_NOT_VERIFIED');
 if(!/PEAK_SCAN_ENABLED\s*=\s*"false"/.test(cfg)||!/MANUAL_SCAN_MODE_ENABLED\s*=\s*"true"/.test(cfg)||!/MANUAL_SCAN_TICKS_PER_DAY\s*=\s*"720"/.test(cfg)||!/crons\s*=\s*\[\s*\]/.test(cfg)||!/LIVE_STATE_D1_ENABLED\s*=\s*"true"/.test(cfg))throw Error('RELEASE_MANUAL_OR_D1_CONFIGURATION_CHANGED');
 const pr=await fetch('https://api.github.com/repos/'+repository+'/pulls/5',{headers:{accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)}).then(r=>r.json());
 if(pr.head?.sha!==candidate||pr.head?.ref!=='fix/do-free-isolated-20261010'||pr.state!=='open')throw Error('PR_HEAD_CHANGED_OR_CLOSED');
 report.checks.checkpoint='PASS';
 const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const d1=evidence.analytics?.d1AnalyticsAdaptiveGroups,objects=evidence.analytics?.durableObjectsPeriodicGroups;
 if(!d1?.daily?.length||!objects?.daily?.length||!objects.byResource?.length)throw Error('ACCOUNT_ROW_USAGE_EVIDENCE_MISSING');
 const baseline=Math.max(total(d1.daily,yesterday,'rowsWritten'),total(d1.byResource||[],yesterday,'rowsWritten'));
 const candidateD1=720*(12+12+6);
 const namespace=evidence.workerBindingNames?.find(x=>x.name==='BACKGROUND_WATCHER')?.namespace_id;
 if(!namespace)throw Error('DO_NAMESPACE_NOT_VERIFIED');
 const otherDO=objects.byResource.filter(x=>x.dimensions.namespaceId!==namespace);
 const otherBaseline=total(otherDO,yesterday,'rowsWritten');
 const doToday=total(objects.daily,today,'rowsWritten');
 const plannedDO=782+4*720+720+720+720+180+50000+10;
 report.quota={baselineD1:baseline,candidateD1,combinedD1:baseline+candidateD1,otherDO:otherBaseline,doToday,plannedDO,limit:100000,modelOnly:true};
 if(baseline+candidateD1>100000)throw Error('D1_ACCOUNT_HEADROOM_INSUFFICIENT');
 if(otherBaseline+doToday+plannedDO>100000)throw Error('DO_ACCOUNT_HEADROOM_INSUFFICIENT');
 if(total(d1.daily,yesterday,'rowsRead')>=5000000)throw Error('D1_READ_BASELINE_ALREADY_EXHAUSTED');
 report.checks.accountQuota='PASS_MODEL_AND_MEASURED_BASELINE';
 const bindings=evidence.workerBindingNames||[];
 if(!bindings.some(x=>x.name==='APISPORTS_KEY'&&x.type==='secret_text')||!bindings.some(x=>x.name==='BACKGROUND_TOKEN'&&x.type==='secret_text'))throw Error('WORKER_SECRET_BINDING_MISSING');
 if(!bindings.some(x=>x.name==='FOOTBALL_DB'&&x.id===database))throw Error('PRODUCTION_D1_BINDING_MISMATCH');
 const path=prefix+'/workers/scripts/'+encodeURIComponent(worker);
 const active=await api(path+'/deployments');
 if(active.deployments?.[0]?.versions?.length!==1||active.deployments[0].versions[0].version_id!==expectedProduction||active.deployments[0].versions[0].percentage!==100)throw Error('PRODUCTION_CHANGED_SINCE_MANUAL_CHECKPOINT');
 const scheduleResponse=await api(path+'/schedules');
 previousSchedules=Array.isArray(scheduleResponse)?scheduleResponse:scheduleResponse.schedules;
 if(!Array.isArray(previousSchedules))throw Error('SCHEDULE_API_SHAPE_NOT_SUPPORTED');
 report.previousSchedules=previousSchedules;
 await api(prefix+'/d1/database/'+database+'/query',{method:'POST',body:JSON.stringify({sql:'CREATE TABLE IF NOT EXISTS fe_notify_live_state (fixture_id INTEGER PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)'})});
 const columns=await api(prefix+'/d1/database/'+database+'/query',{method:'POST',body:JSON.stringify({sql:"PRAGMA table_info('fe_notify_live_state')"})});
 const names=columns.flatMap(x=>x.results||[]);
 if(names.length!==3||!names.some(x=>x.name==='fixture_id'&&x.type==='INTEGER'&&x.pk===1)||!names.some(x=>x.name==='payload'&&x.type==='TEXT'&&x.notnull===1)||!names.some(x=>x.name==='updated_at'&&x.type==='INTEGER'&&x.notnull===1))throw Error('D1_LIVE_SCHEMA_MISMATCH');
 report.checks.d1Schema='PASS';
 const subdomain=await api(prefix+'/workers/subdomain');
 if(!subdomain.subdomain)throw Error('WORKER_PUBLIC_SUBDOMAIN_MISSING');
 const healthURL='https://'+worker+'.'+subdomain.subdomain+'.workers.dev/health';
 report.healthURL=healthURL;
 run(['wrangler','deploy','--dry-run','--outdir','/tmp/peak-release-bundle']);
 // Set deployed before invocation: a CLI/network failure may happen after
 // Cloudflare accepted the upload, requiring restoration of the old version.
 deployed=true;
 run(['wrangler','deploy','--var','FE_DEPLOY_COMMIT:'+candidate]);
 report.productionDeploy='DEPLOYED';
 const after=await api(path+'/deployments');
 report.deployment=after.deployments?.[0];
 const versions=report.deployment?.versions;
 if(versions?.length!==1||versions[0].version_id===rollback||versions[0].percentage!==100)throw Error('NEW_PRODUCTION_VERSION_NOT_CONFIRMED');
 let health=null,healthy=false;
 report.healthAttempts=[];
 // Worker and Durable Object rollout may propagate at different times.
 for(let attempt=0;attempt<90;attempt++){
  const response=await fetch(healthURL,{signal:AbortSignal.timeout(10000)});
  health=await response.json();
  report.healthAttempts.push({attempt:attempt+1,http:response.status,commit:health.deploy_commit,doStatus:health.peak_status_error||'OK',manualMode:health.peak_status?.manualMode||false});
  healthy=response.ok&&health.deploy_commit===candidate&&health.peak_window?.enabled===false&&health.peak_status?.manualMode===true&&health.peak_status?.scan_budget?.limit===720;
  if(healthy)break;
  // Permit old idle DO instances to evict before polling the new generation.
  await new Promise(resolve=>setTimeout(resolve,attempt===0?150000:5000));
 }
 report.health=health;
 if(!healthy)throw Error('PRODUCTION_MANUAL_HEALTH_FAILED');
 if(health.peak_status.enabled!==false||health.peak_status.manualEnabled!==false||health.next_alarm!==null)throw Error('PRODUCTION_MANUAL_SCAN_NOT_OFF');
 const finalSchedulesResponse=await api(path+'/schedules');
 const finalSchedules=Array.isArray(finalSchedulesResponse)?finalSchedulesResponse:finalSchedulesResponse.schedules;
 if(!Array.isArray(finalSchedules)||finalSchedules.length!==0)throw Error('PRODUCTION_AUTOMATIC_CRON_NOT_REMOVED');
 report.checks.productionSchedule='PASS_NO_AUTOMATIC_CRON';
 report.checks.manualScanControl='PASS_OFF_NO_ALARM';
 report.checks.livePush='NOT_TESTED_USER_HAS_NOT_ENABLED_SCAN';
 report.checks.rollbackPreserved='PASS_OLD_VERSION_EXISTS_LEGACY_DO_UNTOUCHED';
 save();console.log(JSON.stringify(report,null,2));
}catch(error){
 report.error=String(error.message||error);
 if(deployed){
  try{
   await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:rollback,percentage:100}],annotations:{'workers/message':'Automatic rollback: peak-window deployment verification failed'}})});
   report.productionDeploy='ROLLED_BACK';
   // Original 60781a4e production had no cron. Keep manual mode paused on rollback.
   await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/schedules',{method:'PUT',body:'[]'});
   report.productionDeploy='ROLLED_BACK';
  }catch(rollbackError){report.rollbackError=String(rollbackError.message||rollbackError);}
 }
 save();console.log(JSON.stringify(report,null,2));process.exitCode=1;
}
