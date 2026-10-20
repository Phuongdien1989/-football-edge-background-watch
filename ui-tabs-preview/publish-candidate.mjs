// Manually invoked only after acceptance; never called by a push workflow.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const action=process.argv[2];assert(['deploy','rollback'].includes(action),'EXPLICIT_ACTION_REQUIRED');
assert.equal(process.env.FE_TABS_PRODUCTION_APPROVED,'true','PRODUCTION_APPROVAL_REQUIRED');
assert(/^[a-f0-9]{40}$/.test(process.env.FE_TABS_APPROVED_COMMIT||''),'APPROVED_COMMIT_REQUIRED');
assert.equal(process.env.GITHUB_SHA,process.env.FE_TABS_APPROVED_COMMIT,'APPROVED_COMMIT_MISMATCH');
const out='ui-tabs-preview/release-package',manifest=JSON.parse(readFileSync(out+'/manifest.json'));
assert.equal(manifest.source_commit,process.env.FE_TABS_APPROVED_COMMIT,'PACKAGE_SOURCE_MISMATCH');
const {activeVersions,publicFile}=await import('./prepare-release.mjs');
const baseline=JSON.parse(readFileSync('ui-tabs-preview/release-baseline.json'));
const hash=x=>createHash('sha256').update(x).digest('hex'),name=baseline.mobile_name,resultPath=out+'/deployment.json';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(dir+'/'+x.name):[dir+'/'+x.name]);
async function verifyPublic(files){for(const f of files)assert.equal(hash((await publicFile('/'+(f.path==='index.html'?'':f.path.endsWith('/index.html')?f.path.slice(0,-10):f.path))).bytes),f.sha256,'SERVED_ASSET_MISMATCH_'+f.path);}
async function restore(ownVersion){const current=await activeVersions();assert.equal(current[name],ownVersion,'UNRELATED_VERSION_REFUSE_ROLLBACK');for(const n of Object.keys(baseline.versions).filter(x=>x!==name))assert.equal(current[n],baseline.versions[n],'UNRELATED_PRODUCTION_DRIFT');const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)+'/workers/scripts/'+name+'/deployments',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:manifest.rollback_version,percentage:100}]}),signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'ROLLBACK_API_FAILED');assert.deepEqual(await activeVersions(),baseline.versions,'ROLLBACK_VERSION_NOT_RESTORED');await verifyPublic(manifest.backup_files);}
if(action==='rollback'){
 const report=JSON.parse(readFileSync(resultPath));assert.equal(report.source_commit,manifest.source_commit,'DEPLOYMENT_RECORD_MISMATCH');assert(report.version,'NO_OWN_DEPLOYMENT_RECORDED');await restore(report.version);report.rollback_verified=true;report.deployed=false;writeFileSync(resultPath,JSON.stringify(report,null,2));console.log('ROLLBACK_VERIFIED');
}else{
 const report={status:'FAIL',source_commit:manifest.source_commit,deployed:false,rollback_version:manifest.rollback_version,provider_calls:0,d1_queries:0,scanner_toggled:false};
 try{
  assert.deepEqual(await activeVersions(),baseline.versions,'PRODUCTION_DRIFT');await verifyPublic(manifest.backup_files);
  const actual=walk(out+'/site').map(p=>p.slice((out+'/site/').length)).sort();assert.deepEqual(actual,manifest.files.map(f=>f.path).sort(),'PACKAGE_FILE_LIST_DRIFT');for(const f of manifest.files)assert.equal(hash(readFileSync(out+'/site/'+f.path)),f.sha256,'PACKAGE_HASH_DRIFT_'+f.path);
  const config=JSON.parse(readFileSync(out+'/wrangler.json'));assert.deepEqual(config,{name,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},'DEPLOY_CONFIG_DRIFT');
  writeFileSync(resultPath,JSON.stringify(report,null,2));
  const result=spawnSync('npx',['--yes','wrangler@4','deploy','--config',out+'/wrangler.json'],{stdio:'inherit',timeout:180000});assert.equal(result.status,0,'UPLOAD_FAILED_CHECK_ACTIVE_VERSION_BEFORE_ANY_ROLLBACK');
  const after=await activeVersions();report.version=after[name];assert.notEqual(report.version,manifest.rollback_version,'NO_NEW_VERSION');writeFileSync(resultPath,JSON.stringify(report,null,2));
  for(const n of Object.keys(baseline.versions).filter(x=>x!==name))assert.equal(after[n],baseline.versions[n],'UNRELATED_PRODUCTION_DRIFT');
  await verifyPublic(manifest.files);report.status='PASS';report.deployed=true;report.after=after;report.live_push='REQUIRES_PHONE_ACCEPTANCE';
 }catch(e){report.error=String(e.message).slice(0,240);process.exitCode=1;if(report.version&&report.version!==manifest.rollback_version){try{await restore(report.version);report.rollback_verified=true;}catch(e){report.rollback_error=String(e.message).slice(0,240);}}}
 writeFileSync(resultPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
