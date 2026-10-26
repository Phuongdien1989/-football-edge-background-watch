import {readPublicStatic} from '../ht-mechanism-recovery/public-read.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {assertAssetClosure,assertStaticContent} from '../ht-mechanism-recovery/asset-graph.mjs';
const action=process.argv[2],dir='ht-retention-package',origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',name='shiny-silence-d892';
const before='2e5532c0-1a32-4358-866a-5fb926efcf43',backend='e7d2090c-d0e1-4f58-9f5a-4360acd2ced3',indexHash='24e012d6c3ca3c21b32982a5b37f0adb9827c16d7354c3d5657d63f546e2b0ae';
const sha=process.env.GITHUB_SHA,token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
assert(sha&&token&&account);assert(['prepare','deploy','verify','rollback'].includes(action));
const hash=x=>createHash('sha256').update(x).digest('hex'),base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const save=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);};
let report=existsSync(dir+'/deployment.json')?JSON.parse(readFileSync(dir+'/deployment.json')):{source_commit:sha,status:'PREPARING',rollback:before,backend_unchanged:backend,scanner_toggled:false,provider_calls:0,d1_writes:0,push_calls:0};
const saveReport=()=>save(dir+'/deployment.json',JSON.stringify(report,null,2));
async function readRetry(label,work){for(let attempt=1;attempt<=3;attempt++){try{return await work();}catch(e){const transient=e instanceof TypeError||['AbortError','TimeoutError'].includes(e?.name);if(!transient||attempt===3)throw Error(label+'_'+String(e.message).slice(0,140));await new Promise(r=>setTimeout(r,attempt*800));}}}
async function cf(path,options={}){const work=async()=>{const r=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+path+'_'+r.status);return j.result;};return (!options.method||options.method==='GET')?readRetry('CF_READ_'+path,work):work();}
async function active(n){const vs=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(vs?.length===1&&vs[0].percentage===100,'SPLIT_'+n);return vs[0].version_id;}
async function others(){assert.equal(await active('football-edge-background-watch'),backend,'BACKEND_DRIFT');assert.equal(await active('football-edge-desktop-b2-test'),report.desktop_before,'DESKTOP_DRIFT');}
async function health(){return readRetry('BACKEND_HEALTH',async()=>{const r=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(25000)});assert(r.ok);const j=await r.json();assert.equal(j.deploy_commit,'3cd210d2d74aff547de4587ab4a3c96b982a728c');return {enabled:j.peak_status?.enabled,manualEnabled:j.peak_status?.manualEnabled,next_alarm:j.next_alarm};});}
async function web(path){return readRetry('PUBLIC_ASSET_'+path,async()=>{const suffix=path==='index.html'?'/':path.endsWith('/index.html')?'/'+path.slice(0,-10):'/'+path;const r=await readPublicStatic(origin+suffix);const bytes=new Uint8Array(await r.arrayBuffer());if(r.status===200)assertStaticContent(path,r.headers.get('content-type')||'',bytes);return {status:r.status,bytes,type:r.headers.get('content-type')};});}
async function check(files){for(const f of files){const r=await web(f.path);assert.equal(r.status,200,'ASSET_HTTP_'+f.path+'_'+r.status);assert.equal(hash(r.bytes),f.sha256,'ASSET_HASH_'+f.path);}}
const manifest=()=>JSON.parse(readFileSync(dir+'/manifest.json'));
async function restore(){assert(report.version,'NO_OWNED_DEPLOYMENT');const current=await active(name);assert([report.version,before].includes(current),'UNOWNED_MOBILE_REFUSE_ROLLBACK');if(current!==before)await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:before,percentage:100}]})});assert.equal(await active(name),before);await check(manifest().backup);await others();report.status='ROLLED_BACK_VERIFIED';saveReport();}
try{
 if(action==='prepare'){
  assert.equal(await active(name),before,'MOBILE_VERSION_DRIFT');
  report.desktop_before=await active('football-edge-desktop-b2-test');await others();report.scanner_before=await health();
  const meta=await cf(name+'/versions/'+before);assert.equal(meta.id,before);
  report.mobile_binding_types=(meta.resources?.bindings||[]).map(b=>b.type);report.mobile_resource_keys=Object.keys(meta.resources||{});
  // Pure static Workers may have zero named bindings. Reject every non-assets binding.
  assert(Array.isArray(meta.resources?.bindings)&&meta.resources.bindings.every(b=>b.type==='assets'),'ASSET_ONLY_BINDING_REQUIRED');
  save(dir+'/backup-version.json',JSON.stringify(meta,null,2));
  const previous=JSON.parse(readFileSync('previous-mobile/manifest.json'));
  assert.equal(previous.source_commit,'aec5a0527a31f1bdca3cbd3ab7887bdac9c4c84b');assert.equal(previous.candidate.length,36);
  const backup=[];
  for(const file of previous.candidate){
   assert(!file.path.includes('..'));assert.equal(hash(readFileSync('previous-mobile/site/'+file.path)),file.sha256,'HISTORIC_PACKAGE_HASH');
   const current=await web(file.path);assert.equal(current.status,200,'CURRENT_ASSET_'+file.path);assert.equal(hash(current.bytes),file.sha256,'UNEXPECTED_SOURCE_CHANGE_'+file.path);
   save(dir+'/backup/'+file.path,current.bytes);save(dir+'/site/'+file.path,current.bytes);backup.push(file);
  }
  assert.equal(hash(readFileSync(dir+'/backup/index.html')),indexHash);
  const replacements={'ht-candidate/ui.mjs':'ht-early-candidate/ui.mjs','ht-candidate/style.css':'ht-early-candidate/style.css'};
  for(const [target,source] of Object.entries(replacements))save(dir+'/site/'+target,readFileSync(source));
  const candidate=backup.map(f=>({...f,sha256:hash(readFileSync(dir+'/site/'+f.path))}));
  const changed=candidate.filter(f=>f.sha256!==backup.find(x=>x.path===f.path).sha256).map(f=>f.path);assert.deepEqual(changed.sort(),['ht-candidate/ui.mjs','ht-candidate/style.css'].sort());
  const closure=assertAssetClosure(dir+'/site');assert.equal(closure.files,36);
  assert.equal(await active(name),before,'VERSION_CHANGED_DURING_PREP');const settings=await cf(name+'/settings');
  save(dir+'/wrangler.json',JSON.stringify({name,compatibility_date:settings.compatibility_date||'2026-10-01',...(settings.compatibility_flags?.length?{compatibility_flags:settings.compatibility_flags}:{}),keep_vars:true,assets:{directory:'./site'}}));
  save(dir+'/manifest.json',JSON.stringify({source_commit:sha,before_version:before,backup,candidate,modified_existing_files:changed,index_sha256:indexHash,closure},null,2));
  report.status='PREPARED';report.changed_assets=2;report.existing_assets_unchanged=34;report.ht_recorded_quote_display_minutes=10;report.ht_session_duration_unchanged=true;report.models_and_current_qualification_unchanged=true;saveReport();
 }else if(action==='deploy'){
  assert.equal(report.status,'PREPARED');assert.equal(manifest().source_commit,sha);await others();assert.equal(await active(name),before,'MOBILE_VERSION_DRIFT');await check(manifest().backup);
  for(const f of manifest().candidate)assert.equal(hash(readFileSync(dir+'/site/'+f.path)),f.sha256,'LOCAL_PACKAGE_DRIFT');assertAssetClosure(dir+'/site');
  try{execFileSync('npx',['--no-install','wrangler','deploy','--config',dir+'/wrangler.json'],{stdio:'pipe',timeout:180000});}catch{throw Error('MOBILE_ASSET_UPLOAD_FAILED');}
  report.version=await active(name);assert.notEqual(report.version,before);saveReport();await others();report.status='DEPLOYED';saveReport();
 }else if(action==='verify'){
  assert.equal(await active(name),report.version);await check(manifest().candidate);await others();report.scanner_after=await health();report.status='VERIFIED';report.public_hashes_verified=36;report.actual_live_ft_recommendation='NOT_VERIFIED; browser synthetic rendering only';assert.deepEqual(report.scanner_after,report.scanner_before,'SCANNER_CONTROL_DRIFT');saveReport();
 }else await restore();
}catch(e){report.status='FAIL';report.error=String(e.message||e).slice(0,240);saveReport();
 if((action==='deploy'||action==='verify')&&report.version)try{await restore();}catch(error){report.rollback_error=String(error.message).slice(0,240);saveReport();}
 process.exitCode=1;
}
console.log('HT_RETENTION_RELEASE '+JSON.stringify(report));

