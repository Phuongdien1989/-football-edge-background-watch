import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const action=process.argv[2],dir='ft-audit-output/mobile-release';
assert(['deploy','rollback'].includes(action),'INVALID_ACTION');
assert.equal(process.env.FE_MOBILE_OUTBOX_RELEASE_APPROVED,'true','OWNER_APPROVAL_GATE_MISSING');
const packageManifest=JSON.parse(readFileSync(dir+'/manifest.json','utf8'));
const name='shiny-silence-d892',old='3166663f-f039-48f5-92ae-888890bb9455';
const hash=x=>createHash('sha256').update(x).digest('hex');
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)+'/workers/scripts/'+name;
async function versions(){
 const r=await fetch(base+'/deployments',{headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(25000)});
 const j=await r.json();assert(r.ok&&j.success,'CF_DEPLOYMENTS_READ_FAIL');
 const vs=j.result?.deployments?.[0]?.versions;assert(vs?.length===1&&vs[0].percentage===100,'SPLIT_TRAFFIC');
 return vs[0].version_id;
}
async function web(f){
 const p=f==='index.html'?'/':'/'+f;
 const r=await fetch('https://'+name+'.ngophuonghuy.workers.dev'+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000),redirect:'error'});
 assert.equal(r.status,200,'PUBLIC_CHECK_'+f+'_'+r.status);
 return new Uint8Array(await r.arrayBuffer());
}
async function check(expected){
 for(const f of expected){assert.equal(hash(await web(f.path)),f.sha256,'PUBLIC_ASSET_MISMATCH_'+f.path);}
}
async function rollback(ownerVersion){
 assert.equal(await versions(),ownerVersion,'UNRELATED_MOBILE_DEPLOY_REFUSE_ROLLBACK');
 const r=await fetch(base+'/deployments',{method:'POST',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:old,percentage:100}]}),signal:AbortSignal.timeout(30000)});
 const j=await r.json();assert(r.ok&&j.success,'ROLLBACK_API_FAILED');
 assert.equal(await versions(),old,'ROLLBACK_VERSION_FAILED');
 await check(packageManifest.files);
}
const result={status:'FAIL',action,source_commit:process.env.GITHUB_SHA,rollback_version:old,production_deployed:false,backend_changed:false,scanner_changed:false,D1_writes:0,provider_calls:0};
try{
 assert.equal(packageManifest.source_commit,process.env.GITHUB_SHA,'PACKAGE_COMMIT_DRIFT');
 if(action==='rollback'){
  const report=JSON.parse(readFileSync(dir+'/deployment.json','utf8'));assert(report.deployed_version,'NO_DEPLOYED_VERSION');
  await rollback(report.deployed_version);Object.assign(result,{status:'ROLLED_BACK',rollback_verified:true});
 }else{
  assert.equal(await versions(),old,'MOBILE_DEPLOYMENT_DRIFT');
  await check(packageManifest.files);
  assert.equal(hash(readFileSync(dir+'/site/index.html')),packageManifest.candidate_sha,'CANDIDATE_MISMATCH');
  for(const item of packageManifest.files.filter(f=>f.path!=='index.html'))assert.equal(hash(readFileSync(dir+'/site/'+item.path)),item.sha256,'OTHER_ASSET_CHANGED');
  writeFileSync(dir+'/deployment.json',JSON.stringify(result,null,2));
  const deploy=spawnSync('npx',['--yes','wrangler@4','deploy','--config',dir+'/wrangler.json'],{stdio:'inherit',timeout:210000});
  assert.equal(deploy.status,0,'WRANGLER_DEPLOY_FAILED');
  result.deployed_version=await versions();assert.notEqual(result.deployed_version,old,'NO_NEW_VERSION');
  writeFileSync(dir+'/deployment.json',JSON.stringify(result,null,2));
  const expected=packageManifest.files.map(f=>f.path==='index.html'?{...f,sha256:packageManifest.candidate_sha}:f);
  await check(expected);
  result.status='PASS';result.production_deployed=true;result.public_assets_verified=expected.length;
 }
}catch(e){
 result.error=String(e.message).slice(0,220);process.exitCode=1;
 if(action==='deploy'&&result.deployed_version){
  try{await rollback(result.deployed_version);result.rollback_verified=true;result.status='ROLLED_BACK';}
  catch(err){result.rollback_error=String(err.message).slice(0,220);}
 }
}
writeFileSync(dir+'/deployment.json',JSON.stringify(result,null,2));
console.log('FE_MOBILE_OUTBOX_DEPLOY '+JSON.stringify(result));
