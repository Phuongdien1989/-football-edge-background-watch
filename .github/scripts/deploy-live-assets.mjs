import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,copyFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {patchLiveDisplay} from './live-display-patch.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const name='shiny-silence-d892',url='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const rollback='a3ffd320-54ec-4c5b-b7fd-eb6f95edb608';
const original={
 'index.html':'157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392',
 'push-sw.js':'c2a193ef7464ebd0a41de358ea69c1d1f91a28866e70baf8e7cbb83499573ec9',
 'manifest.webmanifest':'2f8d30f69d89e49fa95194f09a8fb254bb3b313aa369b57b45337292fbaabc26'
};
const report={commit:process.env.CANDIDATE_SHA,worker:name,mode:'ORIGINAL_THREE_FILE_ASSET_DEPLOYMENT',rollback,checks:{},backendChanged:false,deployed:false};
const hash=x=>createHash('sha256').update(x).digest('hex');
const api='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name;
async function cf(path='',options={}){const r=await fetch(api+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});const b=await r.json();if(!r.ok||b.success===false){report.apiErrors=(b.errors||[]).map(x=>({code:x.code,message:String(x.message||'').slice(0,250)}));throw Error('CF_HTTP_'+r.status+':'+path);}return b.result;}
async function read(file){const r=await fetch(url+'/'+(file==='index.html'?'':file)+'?fe_asset_check='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('ASSET_READ_HTTP_'+r.status+':'+file);return new Uint8Array(await r.arrayBuffer());}
let attempted=false;
try{
 if(!account||!token)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
 const before=await cf('/deployments');if(before.deployments?.[0]?.versions?.length!==1||before.deployments[0].versions[0].version_id!==rollback||before.deployments[0].versions[0].percentage!==100)throw Error('FRONTEND_ROLLBACK_BASELINE_CHANGED');
 await cf('/versions/'+rollback);report.checks.rollback='PASS_ACTIVE_ORIGINAL_VERSION';
 mkdirSync('frontend-assets-backup',{recursive:true});mkdirSync('frontend-assets-candidate',{recursive:true});
 for(const [file,expected]of Object.entries(original)){
  const bytes=await read(file);if(hash(bytes)!==expected)throw Error('PUBLISHED_ASSET_CHANGED:'+file);
  writeFileSync('frontend-assets-backup/'+file,bytes);writeFileSync('frontend-assets-candidate/'+file,bytes);
 }
 report.checks.originalAssets='PASS_EXACT_ORIGINAL_DEPLOYMENT_BUNDLE_HASHES';
 const html=readFileSync('frontend-assets-candidate/index.html','utf8');
 writeFileSync('frontend-assets-candidate/index.html',patchLiveDisplay(html));
 report.expectedHash=hash(readFileSync('frontend-assets-candidate/index.html'));
 const regression=spawnSync(process.execPath,['.github/scripts/test-live-display.mjs','frontend-assets-backup/index.html'],{stdio:'inherit'});if(regression.status!==0)throw Error('DISPLAY_REGRESSION_FAILED');report.checks.regression='PASS';
 writeFileSync('frontend-assets-only.json',JSON.stringify({name,compatibility_date:'2026-10-03',keep_vars:true,assets:{directory:'./frontend-assets-candidate'}}));
 const dry=spawnSync('npx',['wrangler','deploy','--config','frontend-assets-only.json','--dry-run'],{stdio:'inherit',timeout:90000});if(dry.status!==0)throw Error('ASSET_DRY_RUN_FAILED');report.checks.bundle='PASS_DRY_RUN';
 const current=await cf('/deployments');if(current.deployments?.[0]?.versions?.[0]?.version_id!==rollback)throw Error('FRONTEND_CHANGED_BEFORE_ASSET_UPLOAD');
 attempted=true;
 const result=spawnSync('npx',['wrangler','deploy','--config','frontend-assets-only.json'],{stdio:'inherit',timeout:180000});if(result.status!==0)throw Error('WRANGLER_ASSET_DEPLOY_FAILED');
 const after=await cf('/deployments');report.activeVersions=after.deployments?.[0]?.versions;report.productionVersion=report.activeVersions?.[0]?.version_id;
 if(report.activeVersions?.length!==1||report.activeVersions[0].percentage!==100||report.productionVersion===rollback)throw Error('ASSET_VERSION_NOT_ACTIVE');
 let verified=false;report.publicChecks=[];const verifyStart=Date.now();
 for(let i=0;i<16&&Date.now()-verifyStart<90000;i++){const actual=hash(await read('index.html'));report.publicChecks.push(actual);if(actual===report.expectedHash){verified=true;break;}await new Promise(r=>setTimeout(r,5000));}
 if(!verified)throw Error('PUBLIC_ASSET_HTML_HASH_MISMATCH');
 for(const file of ['push-sw.js','manifest.webmanifest'])if(hash(await read(file))!==original[file])throw Error('PUSH_ASSET_CHANGED:'+file);
 report.checks.publicHTML='PASS_EXACT_PATCHED_HTML';report.checks.pushAssets='PASS_ORIGINAL_BYTES_UNCHANGED';report.deployed=true;
}catch(e){report.error=e.message;process.exitCode=1;
 if(attempted){try{await cf('/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:rollback,percentage:100}]})});report.restoredVersion=rollback;}catch(e){report.rollbackError=e.message;}}
}finally{writeFileSync('frontend-asset-deployment-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
