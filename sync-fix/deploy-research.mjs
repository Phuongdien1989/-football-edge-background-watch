import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const out=path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
const service='shiny-silence-d892',url='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const previous='9b5bb5f1-fb53-4a54-9825-b0850ea28074';
const hash=s=>createHash('sha256').update(s).digest('hex');
async function cf(suffix,options={}){
 const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${service}${suffix}`,{...options,headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('CLOUDFLARE_HTTP_'+r.status);return (await r.json()).result;
}
async function versions(){return (await cf('/deployments')).deployments;}
const before=await versions();
if(before[0].versions.length!==1||before[0].versions[0].version_id!==previous)throw Error('FRONTEND_CHANGED_BEFORE_DEPLOY');
const old=await (await fetch(url+'/?research_preflight='+Date.now(),{cache:'no-store'})).text();
if(hash(old)!=='09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1')throw Error('FRONTEND_SOURCE_CHANGED');
await fs.writeFile(path.join(out,'frontend-before-research.html'),old);
await fs.writeFile(path.join(out,'frontend-before-research.json'),JSON.stringify(before));
const dir=path.join(root,'deploy-research'),pub=path.join(dir,'public');await fs.mkdir(pub,{recursive:true});
for(const name of ['index.html','push-sw.js','manifest.webmanifest'])await fs.copyFile(path.join(root,'frontend',name),path.join(pub,name));
const config=path.join(dir,'wrangler.json');await fs.writeFile(config,JSON.stringify({name:service,compatibility_date:'2026-10-03',assets:{directory:'./public'}}));
try{
 const r=spawnSync(process.execPath,[path.join(root,'..','node_modules/wrangler/bin/wrangler.js'),'deploy','--config',config],{env:process.env,encoding:'utf8',timeout:180000});
 await fs.writeFile(path.join(out,'research-deploy.log'),(r.stdout||'')+(r.stderr||''));
 if(r.status!==0)throw Error('FRONTEND_DEPLOY_FAILED');
 let pass=false;
 for(let i=0;i<60;i++){
  const live=await fetch(url+'/?research_check='+Date.now(),{cache:'no-store'});
  if(live.ok&&hash(await live.text())===hash(await fs.readFile(path.join(pub,'index.html')))){pass=true;break;}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 if(!pass)throw Error('FRONTEND_HASH_CHECK_FAILED');
 for(const name of ['push-sw.js','manifest.webmanifest']){
  const live=await fetch(url+'/'+name+'?research_check='+Date.now());
  if(!live.ok||hash(await live.text())!==hash(await fs.readFile(path.join(pub,name))))throw Error('ASSET_CHANGED_'+name);
 }
 const result={commit:process.env.GITHUB_SHA,frontend_version:(await versions())[0].versions[0].version_id,rollback_version:previous,frontend_sha256:hash(await fs.readFile(path.join(pub,'index.html'))),backend_changed:false,production_http_check:'PASS'};
 await fs.writeFile(path.join(out,'RESEARCH_RESULT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){
 await cf('/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:previous,percentage:100}],annotations:{'workers/message':'Rollback research disclosure update'}})});
 if((await versions())[0].versions[0].version_id!==previous)throw Error('ROLLBACK_FAILED');
 console.error('Rollback verified');throw e;
}
