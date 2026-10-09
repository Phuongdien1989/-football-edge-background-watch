import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'evidence');
await fs.mkdir(out,{recursive:true});
const services={backend:'football-edge-background-watch',frontend:'shiny-silence-d892'};
const previous={backend:'37c473f4-f2f7-4b77-a441-fc50baf48974',frontend:'c1ab7df6-d13d-436c-a656-c42a547b3420'};
const urls={backend:'https://football-edge-background-watch.ngophuonghuy.workers.dev',frontend:'https://shiny-silence-d892.ngophuonghuy.workers.dev'};
const sha=s=>createHash('sha256').update(s).digest('hex');
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,bg=process.env.BACKGROUND_TOKEN;
if(!token||!account||!bg)throw Error('MISSING_CONFIGURED_GITHUB_SECRET');
async function cf(service,suffix='',options={}){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${service}${suffix}`,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error('CLOUDFLARE_HTTP_'+r.status+'_'+service+' '+JSON.stringify(d.errors||[]));}
 return r;
}
async function versions(key){return (await (await cf(services[key],'/deployments')).json()).result.deployments;}
async function read(url,auth=false){const r=await fetch(url,{headers:auth?{Authorization:'Bearer '+bg}:{},cache:'no-store',signal:AbortSignal.timeout(30000)});return r;}
for(const key of ['backend','frontend']){
 const deployments=await versions(key);await fs.writeFile(path.join(out,key+'-before.json'),JSON.stringify(deployments,null,2));
 if(deployments[0]?.versions.length!==1||deployments[0].versions[0].version_id!==previous[key])throw Error('PRODUCTION_CHANGED_'+key);
}
const baseline=await (await read(urls.frontend+'/?fe_sync_preflight='+Date.now())).text();
if(sha(baseline)!=='a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844')throw Error('FRONTEND_BASELINE_CHANGED');
await fs.writeFile(path.join(out,'frontend-original.html'),baseline);
await fs.writeFile(path.join(out,'backend-original.multipart'),await (await cf(services.backend)).text());
if((await read(urls.backend+'/api/notify/status',true)).status!==200)throw Error('BACKGROUND_TOKEN_AUTH_FAILED_BEFORE_DEPLOY');
const oldRoute=await read(urls.backend+'/api/notify/ui-state',true);
if(oldRoute.status!==405||(await oldRoute.json()).error!=='METHOD_NOT_ALLOWED')throw Error('V137_BASELINE_ROUTE_CHANGED');
const dir=path.join(root,'deploy'),pub=path.join(dir,'public');await fs.mkdir(pub,{recursive:true});
for(const name of ['index.html','push-sw.js','manifest.webmanifest'])await fs.copyFile(path.join(root,'frontend',name),path.join(pub,name));
let workerConfig=await fs.readFile(path.join(root,'..','wrangler.toml'),'utf8');
if(!workerConfig.includes('main = "worker_notify_v137_quota50000.js"'))throw Error('BACKEND_BASELINE_CONFIG_CHANGED');
workerConfig=workerConfig.replace('main = "worker_notify_v137_quota50000.js"','main = "../worker/worker_notify_v138_sync.js"').replace('[vars]','keep_vars = true\n\n[vars]\nFRONTEND_APP_URL = "'+urls.frontend+'"');
await fs.writeFile(path.join(dir,'backend.toml'),workerConfig);
await fs.writeFile(path.join(dir,'frontend.json'),JSON.stringify({name:services.frontend,compatibility_date:'2026-10-03',assets:{directory:'./public'}}));
const changed=[];
async function deploy(key,config){
 changed.push(key); // rollback also covers an upload accepted just before CLI failure
 const run=spawnSync(process.execPath,[path.join(root,'..','node_modules/wrangler/bin/wrangler.js'),'deploy','--config',config],{env:process.env,encoding:'utf8',timeout:180000});
 await fs.writeFile(path.join(out,key+'-deploy.log'),(run.stdout||'')+(run.stderr||''));
 if(run.status!==0)throw Error('WRANGLER_DEPLOY_FAILED_'+key);
 console.log('Deployment accepted: '+key);
}
const expected=sha(await fs.readFile(path.join(pub,'index.html')));
try{
 await deploy('backend',path.join(dir,'backend.toml'));
 let state;
 for(let i=0;i<48;i++){
  const r=await read(urls.backend+'/api/notify/ui-state',true);
  await fs.appendFile(path.join(out,'sync-smoke-attempts.ndjson'),JSON.stringify({attempt:i,status:r.status,cache_control:r.headers.get('cache-control')})+'\n');
  if(r.status===200){state=await r.json();if(state.schema==='FE_NOTIFY_UI_STATE_V1'&&r.headers.get('cache-control')==='no-store')break;}
  state=null;await new Promise(r=>setTimeout(r,10000));
 }
 if(!state)throw Error('BACKEND_SYNC_SMOKE_FAILED_AFTER_8_MINUTES');
 if((await read(urls.backend+'/api/notify/ui-state')).status!==401)throw Error('BACKEND_AUTH_REGRESSION');
 await deploy('frontend',path.join(dir,'frontend.json'));
 let passed=false;
 for(let i=0;i<60;i++){
  const r=await read(urls.frontend+'/?fe_sync_smoke='+Date.now());
  if(r.ok&&sha(await r.text())===expected){passed=true;break;}
  await new Promise(r=>setTimeout(r,2000));
 }
 if(!passed)throw Error('FRONTEND_HASH_SMOKE_FAILED');
 for(const name of ['push-sw.js','manifest.webmanifest']){
  const r=await read(urls.frontend+'/'+name+'?fe_sync_smoke='+Date.now());
  if(!r.ok||sha(await r.text())!==sha(await fs.readFile(path.join(pub,name))))throw Error('ASSET_SMOKE_FAILED_'+name);
 }
 const summary={commit:process.env.GITHUB_SHA,frontend_sha256:expected,rollback_versions:previous,backend_schema:state.schema,live_count:state.live_count,snapshots:state.snapshots.length,production_http_smoke:'PASS',device_push_click:'NOT_YET_VERIFIED'};
 for(const key of ['backend','frontend']){const d=await versions(key);await fs.writeFile(path.join(out,key+'-after.json'),JSON.stringify(d,null,2));summary[key+'_version']=d[0].versions[0].version_id;}
 await fs.writeFile(path.join(out,'RESULT.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}catch(error){
 console.error(error.message);
 for(const key of changed.reverse()){
  try{
   await cf(services[key],'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:previous[key],percentage:100}],annotations:{'workers/message':'Automatic rollback: original UI sync smoke failed'}})});
   const d=await versions(key);if(d[0].versions[0].version_id!==previous[key])throw Error('ROLLBACK_VERSION_MISMATCH');
   console.error('Rollback verified: '+key);
  }catch(e){console.error('ROLLBACK_FAILED_'+key+': '+e.message);}
 }
 throw error;
}
