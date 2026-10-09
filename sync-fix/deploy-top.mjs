import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'evidence-top');await fs.mkdir(out,{recursive:true});
const previous={frontend:'9b5bb5f1-fb53-4a54-9825-b0850ea28074',backend:'491076a2-78d9-48f0-9050-ffc0f479c531'};
const services={frontend:'shiny-silence-d892',backend:'football-edge-background-watch'},url='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function cf(key,suffix,options={}){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${services[key]}${suffix}`,{...options,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('CLOUDFLARE_'+key+'_HTTP_'+r.status);return (await r.json()).result;
}
async function versions(key){return (await cf(key,'/deployments')).deployments;}
for(const key of ['frontend','backend']){const d=await versions(key);if(d[0].versions.length!==1||d[0].versions[0].version_id!==previous[key])throw Error('PRODUCTION_CHANGED_'+key);await fs.writeFile(path.join(out,key+'-before.json'),JSON.stringify(d));}
const old=await (await fetch(url+'/?top_preflight='+Date.now(),{cache:'no-store'})).text();
if(hash(old)!=='09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1')throw Error('PREHIDE_SOURCE_CHANGED');
await fs.writeFile(path.join(out,'rollback-prehide.html'),old);
const dir=path.join(root,'deploy-top'),pub=path.join(dir,'public');await fs.mkdir(pub,{recursive:true});
for(const name of ['index.html','push-sw.js','manifest.webmanifest'])await fs.copyFile(path.join(root,'frontend',name),path.join(pub,name));
const config=path.join(dir,'wrangler.json');await fs.writeFile(config,JSON.stringify({name:services.frontend,compatibility_date:'2026-10-03',assets:{directory:'./public'}}));
let changed=false;
try{
 changed=true;
 const r=spawnSync(process.execPath,[path.join(root,'..','node_modules/wrangler/bin/wrangler.js'),'deploy','--config',config],{env:process.env,encoding:'utf8',timeout:180000});
 await fs.writeFile(path.join(out,'deploy.log'),(r.stdout||'')+(r.stderr||''));if(r.status!==0)throw Error('FRONTEND_DEPLOY_FAILED');
 const expected=hash(await fs.readFile(path.join(pub,'index.html')));let pass=false;
 for(let i=0;i<60;i++){const r=await fetch(url+'/?top_check='+Date.now(),{cache:'no-store'});if(r.ok&&hash(await r.text())===expected){pass=true;break;}await new Promise(r=>setTimeout(r,2000));}
 if(!pass)throw Error('FRONTEND_HASH_FAILED');
 for(const name of ['push-sw.js','manifest.webmanifest']){const r=await fetch(url+'/'+name+'?top_check='+Date.now());if(!r.ok||hash(await r.text())!==hash(await fs.readFile(path.join(pub,name))))throw Error('ASSET_CHANGED_'+name);}
 for(const file of ['test-production.py','test-original-live.py']){
  const t=spawnSync('python3',[path.join(root,'tests',file)],{env:{...process.env,EXPECT_NOTIFY_SYNC:'1',EXPECT_TOP_WATCH:'1'},encoding:'utf8',timeout:300000});
  await fs.writeFile(path.join(out,file+'.log'),(t.stdout||'')+(t.stderr||''));console.log(t.stdout||'');if(t.status!==0)throw Error('REAL_WEBKIT_FAILED_'+file);
 }
 if((await versions('backend'))[0].versions[0].version_id!==previous.backend)throw Error('BACKEND_CHANGED');
 const result={commit:process.env.GITHUB_SHA,frontend_version:(await versions('frontend'))[0].versions[0].version_id,rollback_versions:previous,frontend_sha256:expected,backend_changed:false,engine_thresholds_changed:false,css_layout_changed:false,real_sync_live_top:'PASS',device_push_click:'NOT_YET_VERIFIED'};
 await fs.writeFile(path.join(out,'RESULT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){
 if(changed){await cf('frontend','/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:previous.frontend,percentage:100}],annotations:{'workers/message':'Automatic rollback TOP WATCH: verification failed'}})});if((await versions('frontend'))[0].versions[0].version_id!==previous.frontend)throw Error('ROLLBACK_VERSION_FAILED');
 let restored=false;for(let i=0;i<60;i++){const r=await fetch(url+'/?top_rollback='+Date.now(),{cache:'no-store'});if(r.ok&&hash(await r.text())===hash(old)){restored=true;break;}await new Promise(r=>setTimeout(r,2000));}if(!restored)throw Error('ROLLBACK_SOURCE_FAILED');console.error('EXACT_PREHIDE_ROLLBACK_VERIFIED');}
 throw e;
}
