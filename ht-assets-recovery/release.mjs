import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {preservedMobileAssets,assertAssetClosure,assertStaticContent} from '../mobile-outbox-candidate/preserved-mobile-assets.mjs';
const action=process.argv[2],dir='ht-assets-release',origin='https://shiny-silence-d892.ngophuonghuy.workers.dev',name='shiny-silence-d892';
const before='e1beb5bf-3617-4c54-805a-623cfafd7411',backend='e7d2090c-d0e1-4f58-9f5a-4360acd2ced3',indexHash='d5dd7761ea2296aab2762564457f92c778c1065f3112bba61e6cdd0a13535752';
const sha=process.env.GITHUB_SHA,token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
assert(sha&&token&&account);assert(['prepare','deploy','verify','rollback'].includes(action));
const hash=x=>createHash('sha256').update(x).digest('hex'),base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const save=(p,b)=>{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);};
let report=existsSync(dir+'/deployment.json')?JSON.parse(readFileSync(dir+'/deployment.json')):{source_commit:sha,status:'PREPARING',rollback:before,backend_unchanged:backend,scanner_toggled:false,provider_calls:0,d1_writes:0,push_calls:0};
const saveReport=()=>save(dir+'/deployment.json',JSON.stringify(report,null,2));
async function cf(path,options={}){const r=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+path+'_'+r.status);return j.result;}
async function active(n){const vs=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(vs?.length===1&&vs[0].percentage===100,'SPLIT_'+n);return vs[0].version_id;}
async function others(){assert.equal(await active('football-edge-background-watch'),backend,'BACKEND_DRIFT');assert.equal(await active('football-edge-desktop-b2-test'),report.desktop_before,'DESKTOP_DRIFT');}
async function health(){const r=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(25000)});assert(r.ok);const j=await r.json();assert.equal(j.deploy_commit,'3cd210d2d74aff547de4587ab4a3c96b982a728c');return {enabled:j.peak_status?.enabled,manualEnabled:j.peak_status?.manualEnabled,next_alarm:j.next_alarm};}
async function web(path){const suffix=path==='index.html'?'/':path.endsWith('/index.html')?'/'+path.slice(0,-10):'/'+path;const r=await fetch(origin+suffix,{headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(25000)});const bytes=new Uint8Array(await r.arrayBuffer());if(r.status===200)assertStaticContent(path,r.headers.get('content-type')||'',bytes);return {status:r.status,bytes,type:r.headers.get('content-type')};}
async function check(files){for(const f of files){const r=await web(f.path);assert.equal(r.status,200,'ASSET_HTTP_'+f.path+'_'+r.status);assert.equal(hash(r.bytes),f.sha256,'ASSET_HASH_'+f.path);}}
const manifest=()=>JSON.parse(readFileSync(dir+'/manifest.json'));
async function restore(){assert(report.version,'NO_OWNED_DEPLOYMENT');const current=await active(name);assert([report.version,before].includes(current),'UNOWNED_MOBILE_REFUSE_ROLLBACK');if(current!==before)await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:before,percentage:100}]})});assert.equal(await active(name),before);await check(manifest().backup);await others();report.status='ROLLED_BACK_VERIFIED';saveReport();}
try{
 if(action==='prepare'){
  assert.equal(await active(name),before,'MOBILE_VERSION_DRIFT');
  report.desktop_before=await active('football-edge-desktop-b2-test');await others();report.scanner_before=await health();
  const meta=await cf(name+'/versions/'+before);assert.equal(meta.id,before);assert(Array.isArray(meta.resources?.bindings)&&meta.resources.bindings.length>0&&meta.resources.bindings.every(b=>b.type==='assets'),'ASSET_ONLY_BINDING_REQUIRED');
  save(dir+'/backup-version.json',JSON.stringify(meta,null,2));
  const old=JSON.parse(readFileSync('previous-ht/ht-event-release/manifest.json'));
  assert.equal(old.source_commit,'319558534e1bac39dd9d212afd22ecf1c818bf22');
  assert.deepEqual(old.site.map(f=>f.path).sort(),[...preservedMobileAssets].sort());
  const backup=[],candidate=[],restored=[];
  for(const f of old.site){
   const historic=readFileSync('previous-ht/ht-event-release/site/'+f.path);assert.equal(hash(historic),f.sha256,'HISTORIC_PACKAGE_HASH_'+f.path);
   const current=await web(f.path);
   if(f.path.startsWith('ht-candidate/')){
    assert.equal(current.status,404,'EXPECTED_MISSING_HT_FILE_'+f.path);restored.push({path:f.path,before_http:current.status,sha256:f.sha256});save(dir+'/site/'+f.path,historic);candidate.push(f);
   }else{
    assert.equal(current.status,200,'CURRENT_ASSET_'+f.path);const sha256=hash(current.bytes);
    assert.equal(sha256,f.path==='index.html'?indexHash:f.sha256,'UNEXPECTED_SOURCE_CHANGE_'+f.path);
    save(dir+'/backup/'+f.path,current.bytes);save(dir+'/site/'+f.path,current.bytes);const row={path:f.path,sha256};backup.push(row);candidate.push(row);
   }
  }
  assert.equal(backup.length,18);assert.equal(restored.length,10);assert.equal(candidate.length,28);assertAssetClosure(dir+'/site');
  assert.equal(await active(name),before,'VERSION_CHANGED_DURING_PREP');
  const settings=await cf(name+'/settings');
  save(dir+'/wrangler.json',JSON.stringify({name,compatibility_date:settings.compatibility_date||'2026-10-01',...(settings.compatibility_flags?.length?{compatibility_flags:settings.compatibility_flags}:{}),keep_vars:true,assets:{directory:'./site'}}));
  save(dir+'/manifest.json',JSON.stringify({source_commit:sha,before_version:before,backup,candidate,restored,modified_existing_files:[],index_sha256:indexHash,closure:assertAssetClosure(dir+'/site')},null,2));
  report.status='PREPARED';report.restored_assets=restored.length;report.existing_assets_unchanged=backup.length;saveReport();
 }else if(action==='deploy'){
  assert.equal(report.status,'PREPARED');assert.equal(manifest().source_commit,sha);await others();assert.equal(await active(name),before,'MOBILE_VERSION_DRIFT');await check(manifest().backup);
  for(const f of manifest().candidate)assert.equal(hash(readFileSync(dir+'/site/'+f.path)),f.sha256,'LOCAL_PACKAGE_DRIFT');assertAssetClosure(dir+'/site');
  try{execFileSync('npx',['--no-install','wrangler','deploy','--config',dir+'/wrangler.json'],{stdio:'pipe',timeout:180000});}catch{throw Error('MOBILE_ASSET_UPLOAD_FAILED');}
  report.version=await active(name);assert.notEqual(report.version,before);saveReport();await others();report.status='DEPLOYED';saveReport();
 }else if(action==='verify'){
  assert.equal(await active(name),report.version);await check(manifest().candidate);await others();report.scanner_after=await health();report.status='VERIFIED';report.public_hashes_verified=28;report.actual_live_ht_recommendation='NOT_VERIFIED; browser synthetic rendering only';saveReport();
 }else await restore();
}catch(e){report.status='FAIL';report.error=String(e.message||e).slice(0,240);saveReport();
 if((action==='deploy'||action==='verify')&&report.version)try{await restore();}catch(error){report.rollback_error=String(error.message).slice(0,240);saveReport();}
 process.exitCode=1;
}
console.log('HT_ASSETS_RECOVERY '+JSON.stringify(report));
