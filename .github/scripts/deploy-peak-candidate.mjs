import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const evidence=JSON.parse(readFileSync('cloudflare-readonly-preflight.json','utf8'));
const cfg=readFileSync('wrangler.toml','utf8');
const candidate=process.env.CANDIDATE_SHA;
const repository=process.env.GITHUB_REPOSITORY;
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const rollback='60781a4e-70cb-4c02-a036-2528c3048ed5';
const expectedProduction='9e1744be-7b2c-4fc5-b755-bba6cea2d2e0';
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
let previousSchedules=null,deployed=false,auditCreated=false;
const auditName='fe-ui-audit-'+process.env.GITHUB_RUN_ID;
const auditAuth=randomBytes(32).toString('hex');
async function createUiAudit(namespace){
 const source=`export default {async fetch(r,e){
 if(r.headers.get('authorization')!=='Bearer '+e.AUTH)return new Response('Unauthorized',{status:401});
 if(new URL(r.url).searchParams.has('ready'))return Response.json({ready:true});
 const stub=e.DO.get(e.DO.idFromName('football-edge-global'));
 const response=await stub.fetch(new Request('https://internal/api/notify/ui-state'));
 const data=await response.json().catch(()=>({}));
 return Response.json({http:response.status,schema:data.schema||null,snapshots:data.snapshots?.length||0,pending:data.pending?.length||0});
 }};`;
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'audit.js',compatibility_date:'2026-10-01',bindings:[{type:'durable_object_namespace',name:'DO',namespace_id:namespace},{type:'plain_text',name:'AUTH',text:auditAuth}]})],{type:'application/json'}));
 form.append('audit.js',new Blob([source],{type:'application/javascript+module'}),'audit.js');
 const r=await fetch('https://api.cloudflare.com/client/v4'+prefix+'/workers/scripts/'+auditName,{method:'PUT',headers:{authorization:'Bearer '+token},body:form,signal:AbortSignal.timeout(30000)});
 const b=await r.json();if(!r.ok||b.success===false)throw Error('UI_AUDIT_UPLOAD_FAILED');auditCreated=true;
 await api(prefix+'/workers/scripts/'+auditName+'/subdomain',{method:'POST',body:JSON.stringify({enabled:true})});
 const domain=await api(prefix+'/workers/subdomain');
 const url='https://'+auditName+'.'+domain.subdomain+'.workers.dev/';
 for(let i=0;i<10;i++){
 const response=await fetch(url+'?ready=1',{headers:{authorization:'Bearer '+auditAuth},signal:AbortSignal.timeout(10000)});
 if(response.ok)return url;
 await new Promise(resolve=>setTimeout(resolve,3000));
 }
 throw Error('UI_AUDIT_ROUTE_NOT_READY');
}
async function readUiAudit(url){
 const r=await fetch(url,{headers:{authorization:'Bearer '+auditAuth},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('UI_AUDIT_HTTP_'+r.status);
 return r.json();
}
let uiAuditURL;

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
 uiAuditURL=await createUiAudit(namespace);
 report.uiBridgeBefore=await readUiAudit(uiAuditURL);
 const subdomain=await api(prefix+'/workers/subdomain');
 if(!subdomain.subdomain)throw Error('WORKER_PUBLIC_SUBDOMAIN_MISSING');
 const healthURL='https://'+worker+'.'+subdomain.subdomain+'.workers.dev/health';
 report.healthURL=healthURL;
 run(['wrangler','deploy','--dry-run','--outdir','/tmp/peak-release-bundle']);
 // Set deployed before invocation: a CLI/network failure may happen after
 // Cloudflare accepted the upload, requiring restoration of the old version.
 deployed=true;
 run(['wrangler','deploy','--var','FE_DEPLOY_COMMIT:'+candidate,'--var','FE_PROVIDER_PROBE_RUN_ID:3f644a53c9e9fee1065b290adaf51f94177ca6c5','--var','FE_PROVIDER_PROBE_ENABLED:false']);
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
  healthy=response.ok&&health.deploy_commit===candidate&&health.peak_window?.enabled===false&&health.peak_status?.manualMode===true&&health.peak_status?.scan_budget?.limit===720&&health.notify_status?.diagnostics_version==='PACING_COOLDOWN_QUOTA_V6_UI_SYNC'&&health.notify_status?.provider?.classification==='V2'&&health.notify_status?.provider?.pacing?.bootstrap===true&&health.notify_status?.provider?.pacing?.configured_minute_limit===450&&health.notify_status?.provider?.pacing?.start_gap_ms>=143&&typeof health.notify_status?.provider?.pacing?.cooldown_until==='number'&&typeof health.notify_status?.provider?.pacing?.consecutive_rate_failures==='number';
  if(healthy)break;
  // Permit old idle DO instances to evict before polling the new generation.
  await new Promise(resolve=>setTimeout(resolve,attempt===0?150000:5000));
 }
 report.health=health;
 if(!healthy)throw Error('PRODUCTION_MANUAL_HEALTH_FAILED');
 report.uiBridgeAfter=await readUiAudit(uiAuditURL);
 if(report.uiBridgeAfter.http!==200||report.uiBridgeAfter.schema!=='FE_NOTIFY_UI_STATE_V1')throw Error('UI_BRIDGE_PRODUCTION_FAILED');
 report.checks.uiBridge='PASS_ACTUAL_DURABLE_OBJECT_GET';
 // Preserve explicit manual ON/OFF choices; this release updates read-only status views.
 const finalSchedulesResponse=await api(path+'/schedules');
 const finalSchedules=Array.isArray(finalSchedulesResponse)?finalSchedulesResponse:finalSchedulesResponse.schedules;
 if(!Array.isArray(finalSchedules)||finalSchedules.length!==0)throw Error('PRODUCTION_AUTOMATIC_CRON_NOT_REMOVED');
 report.checks.productionSchedule='PASS_NO_AUTOMATIC_CRON';
 report.checks.manualScanControl=health.peak_status.manualEnabled?'PASS_USER_MANUALLY_ENABLED':'PASS_USER_MANUALLY_PAUSED';
 report.checks.notifyBudget='PASS_CURRENT_UTC_DAY_STATUS';
 report.checks.liveScan=health.notify_status.last_cycle_current_day&&health.notify_status.scanned>0?'CURRENT_DAY_FIXTURE_SCAN_OBSERVED':'NO_CURRENT_FIXTURE_SCAN_EVIDENCE';
 report.checks.livePush='DEVICE_PUSH_DELIVERY_NOT_VERIFIED';
 report.checks.rollbackPreserved='PASS_OLD_VERSION_EXISTS_LEGACY_DO_UNTOUCHED';
 save();console.log(JSON.stringify(report,null,2));
}catch(error){
 report.error=String(error.message||error);
 if(deployed){
  try{
   await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:expectedProduction,percentage:100}],annotations:{'workers/message':'Automatic rollback: peak-window deployment verification failed'}})});
   report.productionDeploy='ROLLED_BACK';report.restoredVersion=expectedProduction;
   // Original 60781a4e production had no cron. Keep manual mode paused on rollback.
   await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/schedules',{method:'PUT',body:'[]'});
   report.productionDeploy='ROLLED_BACK';report.restoredVersion=expectedProduction;
  }catch(rollbackError){report.rollbackError=String(rollbackError.message||rollbackError);}
 }
 save();console.log(JSON.stringify(report,null,2));process.exitCode=1;
}finally{
 if(auditCreated){try{await api(prefix+'/workers/scripts/'+auditName,{method:'DELETE'});report.uiAuditCleanup='PASS';}catch(e){report.uiAuditCleanup=e.message;process.exitCode=1;}}
 save();console.log(JSON.stringify(report,null,2));
}
