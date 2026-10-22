import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',name='shiny-silence-d892';
const expectedVersion='3166663f-f039-48f5-92ae-888890bb9455';
const pinnedSource='005a74b4768a00f92ac462592b3de63106b2a4db35732103f6095cfed9fdb46d';
const pinnedCandidate='d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752';
const directory='ft-audit-output/mobile-release';
const files=['index.html','original/index.html','ft-overview-live/index.html','push-sw.js','manifest.webmanifest','favicon.svg','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png','ft-overview/core.mjs','ft-overview/adapter.mjs','ft-overview/charts.mjs','ft-overview/demo.mjs','ft-overview/ui.mjs','ft-overview/style.css','ui-tabs/integrated.css','ui-tabs/integrated.mjs','ui-tabs/read-model.mjs'];
const hash=data=>createHash('sha256').update(data).digest('hex');
const cfBase='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
function save(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
async function cf(path){
 let last;
 for(let attempt=1;attempt<=3;attempt++){
  try{const r=await fetch(cfBase+name+'/'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
   const j=await r.json().catch(()=>({}));assert(r.ok&&j.success,'CF_READ_'+path+'_'+r.status);return j.result;
  }catch(e){last=e;if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1200*attempt));}
 }
 throw Error('CF_READ_RETRY_EXHAUSTED_'+path+'_'+String(last?.message||last).slice(0,100));
}
async function active(){
 const v=(await cf('deployments')).deployments?.[0]?.versions;
 assert(v?.length===1&&v[0].percentage===100,'MOBILE_VERSION_SPLIT');
 return v[0].version_id;
}
async function publicFile(path){
 const url=origin+(path==='index.html'?'/':path.endsWith('/index.html')?'/'+path.slice(0,-10):'/'+path);let last;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(22000),redirect:'error'});
   assert.equal(r.status,200,'PUBLIC_ASSET_HTTP_'+path+'_'+r.status);
   return new Uint8Array(await r.arrayBuffer());
  }catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1600));}
 }
 throw Error('PUBLIC_ASSET_READ_FAILED_'+path+'_'+String(last?.message||last).slice(0,90));
}
const report={status:'FAIL',scope:'MOBILE_ONLY_OWNER_APPROVED_RELEASE',source_commit:process.env.GITHUB_SHA,production_deployed:false,scanner_changes:0,provider_calls:0,D1_queries:0,D1_writes:0};
try{
 assert(account&&token,'CLOUDFLARE_AUTH_MISSING');
 assert(process.env.FE_MOBILE_OUTBOX_RELEASE_APPROVED==='true','APPROVAL_GATE_MISSING');
 report.phase='ACTIVE_VERSION';const before=await active();assert.equal(before,expectedVersion,'MOBILE_VERSION_DRIFT');
 report.phase='VERSION_METADATA';const metadata=await cf('versions/'+before);
 assert(Array.isArray(metadata.resources?.bindings)&&metadata.resources.bindings.every(b=>b.type==='assets'),'MOBILE_BINDINGS_CHANGED');
 const baseline=readFileSync('mobile-outbox-candidate/baseline.html');
 const candidate=readFileSync('mobile-outbox-candidate/candidate_mobile.html');
 assert.equal(hash(baseline),pinnedSource,'LOCAL_BASELINE_DRIFT');
 assert.equal(hash(candidate),pinnedCandidate,'CANDIDATE_DRIFT');
 const manifest=[];
 for(const f of files){
  report.phase='ASSET_'+f;const bytes=await publicFile(f);
  if(f==='index.html')assert.equal(hash(bytes),pinnedSource,'PRODUCTION_HTML_DRIFT');
  save(directory+'/backup/'+f,bytes);save(directory+'/site/'+f,bytes);
  manifest.push({path:f,sha256:hash(bytes),bytes:bytes.length});
 }
 assert.equal(hash(readFileSync(directory+'/backup/index.html')),pinnedSource,'BACKUP_BASELINE_WRONG');
 save(directory+'/site/index.html',candidate);
 const unchanged=manifest.filter(f=>f.path!=='index.html');
 for(const f of unchanged)assert.equal(hash(readFileSync(directory+'/site/'+f.path)),f.sha256,'ASSET_COPY_BAD_'+f.path);
 assert.equal(await active(),expectedVersion,'VERSION_CHANGED_DURING_PREP');
 const release={...report,status:'PREFLIGHT_PASS',mobile_name:name,before_version:before,rollback_version:before,
  asset_count:files.length,baseline_sha:pinnedSource,candidate_sha:pinnedCandidate,
  files:manifest,content_delta:['index.html'],production_deployed:false};
 save(directory+'/manifest.json',JSON.stringify(release,null,2));
 save(directory+'/wrangler.json',JSON.stringify({name,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},null,2));
 console.log('FE_MOBILE_OUTBOX_PREFLIGHT_PASS '+JSON.stringify({status:release.status,version:before,asset_count:files.length,source:pinnedSource,candidate:pinnedCandidate,release_commit:process.env.GITHUB_SHA}));
}catch(e){report.error=String(e.message).slice(0,240);save(directory+'/preflight-error.json',JSON.stringify(report,null,2));console.error(report.error);process.exitCode=1;}
