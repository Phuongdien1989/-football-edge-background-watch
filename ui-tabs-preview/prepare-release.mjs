// Read-only Cloudflare preflight and complete frontend asset packaging.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
const baseline=JSON.parse(readFileSync('ui-tabs-preview/release-baseline.json'));
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert(account&&token,'CLOUDFLARE_AUTH_MISSING');
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const target=baseline.mobile_name,origin='https://'+target+'.ngophuonghuy.workers.dev';
const out='ui-tabs-preview/release-package',hash=x=>createHash('sha256').update(x).digest('hex');
export async function cfRead(path){const r=await fetch(api+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'CF_READ_'+r.status);return j.result;}
export async function activeVersions(){const result={};for(const name of Object.keys(baseline.versions)){const v=(await cfRead(name+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT');result[name]=v[0].version_id;}return result;}
export async function publicFile(path){const r=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'PUBLIC_FILE_'+r.status+'_'+path);return {bytes:new Uint8Array(await r.arrayBuffer()),type:r.headers.get('content-type')||''};}
function save(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(dir+'/'+x.name):[dir+'/'+x.name]);}
async function prepare(){
 mkdirSync(out,{recursive:true});const report={status:'FAIL',mode:'READ_ONLY_RELEASE_PREPARATION',source_commit:process.env.GITHUB_SHA,production_deployed:false,provider_calls:0,d1_queries:0,scanner_toggled:false};
 try{
  const before=await activeVersions();assert.deepEqual(before,baseline.versions,'PRODUCTION_VERSION_DRIFT');
  const rollback=await cfRead(target+'/versions/'+baseline.versions[target]);
  assert.equal(rollback.id,baseline.versions[target],'ROLLBACK_VERSION_MISMATCH');
  const bindings=rollback.resources?.bindings;assert(Array.isArray(bindings),'VERSION_BINDING_METADATA_MISSING');assert(bindings.every(x=>x.type==='assets'),'NON_ASSET_BINDING_REQUIRES_REVIEW');
  const captured=[];
  for(const f of baseline.files){const path='/'+(f.path==='index.html'?'':f.path.endsWith('/index.html')?f.path.slice(0,-10):f.path);const {bytes}=await publicFile(path);assert.equal(hash(bytes),f.sha256,'ACTIVE_ASSET_DRIFT_'+f.path);save(out+'/backup/'+f.path,bytes);save(out+'/site/'+f.path,bytes);captured.push({...f});}
  const optional=[];
  for(const p of ['/sw.js','/favicon.ico','/favicon.svg','/icons/icon-180.png','/icons/icon-192.png','/icons/icon-512.png']){
   const r=await fetch(origin+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)}),type=r.headers.get('content-type')||'';
   if(r.ok&&(p.endsWith('.js')?/javascript/.test(type):/^image\//.test(type))){const bytes=new Uint8Array(await r.arrayBuffer());save(out+'/backup'+p,bytes);save(out+'/site'+p,bytes);captured.push({path:p.slice(1),bytes:bytes.length,sha256:hash(bytes)});optional.push({path:p,status:'PRESERVED'});}else optional.push({path:p,status:'NOT_SERVED_AS_EXPECTED_TYPE',http:r.status});
  }
  const candidate='ui-tabs-preview/generated/candidate';
  assert.equal(hash(readFileSync(candidate+'/index.html')),baseline.candidate_html_sha256,'CANDIDATE_HTML_DRIFT');
  const additions=[];for(const file of walk(candidate)){const relative=file.slice(candidate.length+1);if(relative==='candidate-build.json')continue;assert(relative==='index.html'||/^ui-tabs\/(integrated\.mjs|integrated\.css|read-model\.mjs)$/.test(relative)||/^ft-overview\/(ui\.mjs|core\.mjs|adapter\.mjs|charts\.mjs|demo\.mjs|style\.css)$/.test(relative),'UNEXPECTED_CANDIDATE_FILE');const data=readFileSync(file);save(out+'/site/'+relative,data);additions.push(relative);}
  // Restore missing icon URLs already referenced by the existing HTML/Push SW.
  // Existing remote icons, if any, take precedence over the supplied SVG fallback.
  for(const relative of ['favicon.svg','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'])if(!captured.some(f=>f.path===relative)){save(out+'/site/'+relative,readFileSync('ui-tabs-preview/generated/icons/'+relative));additions.push(relative);}
  const changed=captured.filter(f=>hash(readFileSync(out+'/site/'+f.path))!==f.sha256).map(f=>f.path).sort();
  assert.deepEqual(changed,['ft-overview/ui.mjs','index.html'],'UNEXPECTED_BASELINE_ASSET_CHANGE');
  for(const f of ['index.html','ui-tabs/integrated.mjs'])for(const marker of ['__FETabsSandbox','__FETabsQA','PREVIEW_NETWORK_DISABLED','sandbox-boot'])assert(!readFileSync(out+'/site/'+f,'utf8').includes(marker),'SANDBOX_IN_CANDIDATE');
  const after=await activeVersions();assert.deepEqual(after,before,'PRODUCTION_CHANGED_DURING_PREPARATION');
  const allowed=new Set([...captured.map(f=>f.path),...additions]);
  const files=walk(out+'/site').map(p=>{const relative=p.slice((out+'/site/').length);assert(allowed.has(relative),'UNEXPECTED_PACKAGED_FILE');const bytes=readFileSync(p);return {path:relative,bytes:bytes.length,sha256:hash(bytes)};}).sort((a,b)=>a.path.localeCompare(b.path));
  const config={name:target,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}};
  save(out+'/wrangler.json',JSON.stringify(config,null,2));save(out+'/manifest.json',JSON.stringify({source_commit:process.env.GITHUB_SHA,target,rollback_version:before[target],baseline_versions:before,backup_files:captured,files,changed_existing_files:changed,additional_files:additions.filter(p=>!captured.some(f=>f.path===p))},null,2));
  Object.assign(report,{status:'PASS',before,after,rollback_version_exists:true,rollback_exercised:false,active_binding_types:bindings.map(x=>x.type),captured_assets:captured.length,packaged_assets:files.length,optional_assets:optional,changed_existing_files:changed,backup_verified:true,candidate_html_sha256:baseline.candidate_html_sha256,approval_required_before_production:true});
 }catch(e){report.error=String(e.message).slice(0,250);process.exitCode=1;}
 save(out+'/preflight.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('ui-tabs-preview/prepare-release.mjs'))await prepare();
