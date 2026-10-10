import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'evidence-ultra75k');await fs.mkdir(out,{recursive:true});
const service='football-edge-background-watch',front='shiny-silence-d892',base='https://'+service+'.ngophuonghuy.workers.dev',url='https://'+front+'.ngophuonghuy.workers.dev',previous='60781a4e-70cb-4c02-a036-2528c3048ed5',frontVersion='a3ffd320-54ec-4c5b-b7fd-eb6f95edb608',frontHash='157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392';
const sha=s=>createHash('sha256').update(s).digest('hex'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function cf(s,suffix='',options={}){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${s}${suffix}`,{...options,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('CF_HTTP_'+r.status);return r;}
async function version(s){const d=(await (await cf(s,'/deployments')).json()).result.deployments;return d[0].versions.length===1?d[0].versions[0].version_id:null;}
async function get(p,auth=true){const r=await fetch(base+p,{headers:auth?{Authorization:'Bearer '+process.env.BACKGROUND_TOKEN}:{},signal:AbortSignal.timeout(45000),cache:'no-store'});const d=await r.json();if(!r.ok)throw Error('BACKEND_'+p+'_HTTP_'+r.status);return d;}
async function frontCheck(){if(await version(front)!==frontVersion)throw Error('FRONTEND_VERSION_CHANGED');const r=await fetch(url+'/?accuracy_check='+Date.now(),{signal:AbortSignal.timeout(30000),cache:'no-store'});if(!r.ok||sha(await r.text())!==frontHash)throw Error('FRONTEND_HASH_CHANGED');}
if(await version(service)!==previous)throw Error('BACKEND_BASELINE_CHANGED');await frontCheck();
await fs.writeFile(path.join(out,'backend-before.multipart'),await (await cf(service)).text());
const beforeStatus=await get('/api/notify/status');const beforeValidation=await get('/api/notify/validation/summary');const startedAt=Date.now();
await fs.writeFile(path.join(out,'quota-before.json'),JSON.stringify(beforeStatus.global_api_quota));
const beforeEntries=await get('/api/db/export/entries?limit=10000');await fs.writeFile(path.join(out,'entries-before.json'),JSON.stringify(beforeEntries));
const historical=beforeEntries.rows.filter(x=>['H1','FT'].includes(x.engine)&&x.auto_settle_supported&&x.captured_at<Date.now()-12*3600000&&x.odds_format==='DEC'&&['OVER','UNDER'].includes(x.selection)&&x.line!==null&&x.price>1).map(x=>x.id);
for(const [file,p]of Object.entries({validation:'/api/notify/validation/recent?limit=500',status:'/api/notify/status',sync:'/api/notify/ui-state'}))await fs.writeFile(path.join(out,file+'-before.json'),JSON.stringify(await get(p)));
const configDir=path.join(root,'deploy-ultra75k');await fs.mkdir(configDir,{recursive:true});
const original=await fs.readFile(path.join(root,'..','wrangler.toml'),'utf8');
if(!original.includes('main = "worker_notify_v137_quota50000.js"'))throw Error('WRANGLER_BASELINE_CHANGED');
for(const [key,value]of Object.entries({API_TOTAL_DAILY_BUDGET:72000,NOTIFY_DAILY_BUDGET:62000,VALIDATION_DAILY_BUDGET:4000})){if(!original.includes(key+' = "'+value+'"'))throw Error('ULTRA_CONFIG_MISMATCH_'+key)}
const config=original.replace('main = "worker_notify_v137_quota50000.js"','main = "../worker/worker_notify_v140_validation_lanes.js"').replace('[vars]','keep_vars = true\n\n[vars]\nFRONTEND_APP_URL = "'+url+'"');await fs.writeFile(path.join(configDir,'backend.toml'),config);
let changed=false;
try{
  changed=true;const deploy=spawnSync(process.execPath,[path.join(root,'..','node_modules/wrangler/bin/wrangler.js'),'deploy','--config',path.join(configDir,'backend.toml')],{env:process.env,encoding:'utf8',timeout:180000});
  await fs.writeFile(path.join(out,'deploy.log'),(deploy.stdout||'')+(deploy.stderr||''));if(deploy.status!==0)throw Error('DEPLOY_FAILED');
  let summary;for(let i=0;i<48;i++){try{const s=await get('/api/notify/accuracy');if(s.schema==='FE_ACCURACY_V1_20261010'&&s.repair_revision===2){summary=s;break}}catch{}await pause(10000);}
  if(!summary)throw Error('NEW_ACCURACY_ROUTE_NOT_ACTIVE');
  const unauth=await fetch(base+'/api/notify/accuracy',{signal:AbortSignal.timeout(30000)});if(unauth.status!==401)throw Error('AUTH_REGRESSION');
  const sync=await get('/api/notify/ui-state');if(sync.schema!=='FE_NOTIFY_UI_STATE_V1')throw Error('SYNC_REGRESSION');
  const window=await get('/api/notify/validation/summary');if(window.measurement_version!==summary.schema||!window.goal_window_is_not_period_prediction)throw Error('WINDOW_CONTRACT_REGRESSION');
  for(const file of ['test-production.py','test-original-live.py']){const r=spawnSync('python3',[path.join(root,'tests',file)],{env:{...process.env,EXPECT_NOTIFY_SYNC:'1',EXPECT_TOP_WATCH:'1'},encoding:'utf8',timeout:300000});await fs.writeFile(path.join(out,file+'.log'),(r.stdout||'')+(r.stderr||''));console.log(r.stdout||'');if(r.status!==0)throw Error('REAL_WEBKIT_FAILED_'+file);}
  // Observe real alarm follow-up, not a synthetic POST/forced scan.
  let observed=false,settledHistorical=0,status,validation;for(let i=0;i<45;i++){summary=await get('/api/notify/accuracy');status=await get('/api/notify/status');validation=await get('/api/notify/validation/summary');const e=await get('/api/db/export/entries?limit=10000');settledHistorical=e.rows.filter(x=>historical.includes(x.id)&&['RESOLVED','VOID'].includes(x.resolution)).length;if(summary.validation_execution==='SEPARATE_ALARM_V1'&&summary.validation_lane?.ok&&summary.validation_lane.at>startedAt&&summary.status?.repair_revision===2&&summary.status.at>startedAt&&summary.backfill_complete&&!summary.status.errors?.length&&settledHistorical===historical.length&&status.global_api_quota?.limit===72000&&status.global_api_quota.used>=beforeStatus.global_api_quota.used&&status.scan?.apiLimit===62000&&status.scan.at>startedAt&&status.scan.live>0&&status.scan.scanned>0&&!status.scan.errors?.some(e=>/BUDGET|QUOTA|EVIDENCE_PROVIDER_ERROR/.test(e.error||''))){observed=true;break}if(i%6===0)console.log('ULTRA_ACCEPTANCE_PROGRESS '+JSON.stringify({poll:i,historical:settledHistorical,total:historical.length,lane:summary.validation_lane,accuracy_errors:summary.status?.errors,live:status.scan?.live,scanned:status.scan?.scanned,scan_errors:status.scan?.errors}));await pause(10000);}
  await fs.writeFile(path.join(out,'accuracy-after.json'),JSON.stringify(summary,null,2));
  await fs.writeFile(path.join(out,'runtime-after.json'),JSON.stringify({status,validation},null,2));
  if(!observed)throw Error('ULTRA_ACCEPTANCE_NOT_VERIFIED_'+JSON.stringify({historical:settledHistorical,total:historical.length,lane:summary.validation_lane,accuracy_errors:summary.status?.errors,scan_errors:status.scan?.errors,live:status.scan?.live,scanned:status.scan?.scanned}));
  if(summary.status.errors?.length)throw Error('BACKGROUND_ACCURACY_ERRORS_'+JSON.stringify(summary.status.errors));
  await frontCheck();
  if(validation.validation_api_today?.day===beforeValidation.validation_api_today?.day&&Number(validation.validation_api_today.used)<Number(beforeValidation.validation_api_today.used))throw Error('VALIDATION_COUNTER_RESET');
  if(status.scan.apiToday<beforeStatus.scan.apiToday)throw Error('NOTIFICATION_COUNTER_RESET');
  const independent=spawnSync(process.execPath,[path.join(root,'..','accuracy-verify.mjs')],{env:{...process.env,MAX_VERIFY_POLLS:'1'},encoding:'utf8',timeout:180000});await fs.writeFile(path.join(out,'independent.log'),(independent.stdout||'')+(independent.stderr||''));console.log(independent.stdout||'');if(independent.status!==0)throw Error('INDEPENDENT_BATCH_D_VERIFICATION_FAILED');
  await fs.writeFile(path.join(out,'entries-after.json'),JSON.stringify(await get('/api/db/export/entries?limit=10000')));
  const result={commit:process.env.GITHUB_SHA,backend_version:await version(service),rollback_backend:previous,frontend_version:frontVersion,frontend_sha256:frontHash,frontend_changed:false,engine_changed:false,thresholds_changed:false,real_sync_live_top:'PASS',real_background_measurement:'PASS',ultra_quota:'PASS',quota:status.global_api_quota,notification_budget:status.scan.apiLimit,validation_budget:4000,independent_batch_d:'PASS',historical_paper_verified:settledHistorical,device_push_click:'NOT_INDEPENDENTLY_VERIFIED',summary};
  await fs.writeFile(path.join(out,'RESULT.json'),JSON.stringify(result,null,2));console.log('ACCURACY_DEPLOY_RESULT '+JSON.stringify(result));
}catch(e){
  if(changed){await cf(service,'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:previous,percentage:100}],annotations:{'workers/message':'Automatic rollback: Ultra75k or Batch D production verification failed'}})});if(await version(service)!==previous)throw Error('ROLLBACK_VERSION_FAILED');await frontCheck();console.error('EXACT_BACKEND_ROLLBACK_VERIFIED; additive measurement data retained, no history deleted');}
  throw e;
}

