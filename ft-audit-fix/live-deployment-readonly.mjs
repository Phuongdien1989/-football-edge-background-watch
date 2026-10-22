// Read-only ACTIVE deployment and rollback diagnosis for Football Edge 2026-10-22.
// ONE-SHOT EXECUTION; never mutates D1, Worker or scan status.
// Uses Cloudflare GET and public backend health only; never D1 SQL/GraphQL query, deploy, scan control or mutation.
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
const report={at:new Date().toISOString(),type:'ACTIVE_DEPLOYMENT_READ_ONLY',status:'NOT_RUN',d1_queries:0,d1_writes:0,production_deploys:0,scanner_changes:0,provider_calls:0,backend:null,mobile:null,rollbacks:{},errors:[]};
mkdirSync('ft-audit-output',{recursive:true});
const save=()=>writeFileSync('ft-audit-output/ft-live-deployment-readonly.json',JSON.stringify(report,null,2));
async function cf(path){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+path,{
  method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(18000)});
 const j=await response.json().catch(()=>({}));
 if(!response.ok||j.success!==true){let e=new Error('CLOUDFLARE_GET_'+response.status);e.codes=(j.errors||[]).map(x=>x.code);throw e;}
 return j.result;
}
async function active(name){
 const result=await cf('/workers/scripts/'+name+'/deployments');
 const deployments=result?.deployments||[];
 if(!Array.isArray(deployments)||!Array.isArray(deployments[0]?.versions))throw Error('DEPLOYMENT_FORMAT_UNKNOWN_'+name);
 const v=deployments[0].versions;
 if(v.length!==1||v[0].percentage!==100)throw Error('MULTIPLE_ACTIVE_VERSIONS_'+name);
 return v[0].version_id;
}
async function exists(name,id){
 try{const v=await cf('/workers/scripts/'+name+'/versions/'+id);return v?.id===id;}catch(e){return {exists:'UNVERIFIED',error:e.message,codes:e.codes||[]};}
}
try{
 if(!account||!token)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
 if(process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.FT_LIVE_VERSION_AUDIT!=='READ_ONLY_ONCE')throw Error('ONE_SHOT_GATE_MISSING');
 const [backend,mobile,desktop]=await Promise.all([
  active('football-edge-background-watch'),active('shiny-silence-d892'),active('football-edge-desktop-b2-test')
 ]);
 const healthRes=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{method:'GET',signal:AbortSignal.timeout(18000)});
 if(!healthRes.ok)throw Error('BACKEND_HEALTH_HTTP_'+healthRes.status);
 const health=await healthRes.json();
 report.backend={version:backend,deploy_commit:health.deploy_commit??null,
  peak_enabled:health.peak_status?.enabled??null,peak_manual_enabled:health.peak_status?.manualEnabled??null,
  next_alarm:health.next_alarm??null,health_http:healthRes.status};
 report.mobile={version:mobile,original_candidate:'03c1d55d-358a-448b-96f3-f356704831df',
  matches_original_mobile:mobile==='03c1d55d-358a-448b-96f3-f356704831df'};
 report.desktop={version:desktop};
 report.rollbacks={
  previous_backend:await exists('football-edge-background-watch','02d56762-ba08-4a8d-8654-bc9d522fc29a'),
  previous_older:await exists('football-edge-background-watch','5f33a4b1-a299-4195-8a68-4646396a9214'),
  free_rollback:await exists('football-edge-background-watch','60781a4e-70cb-4c02-a036-2528c3048ed5')
 };
 // Do NOT label installed producer patch or D1 idempotency present based only on backend commit.
 report.identity={staging_fix_pr6_head:'79cd4ddfa4191fa5a6e620683947d77e6ecbf31c',
  backend_v20261016_baseline:'d73d4b19a069b0b2aed7e2687f27f1820f50e3d1'};
 report.status='PASS';
}catch(e){report.status='FAIL';report.errors.push({message:e.message,codes:e.codes||[]});process.exitCode=1;}
finally{save();console.log('FE_LIVE_DEPLOYMENT_READONLY '+JSON.stringify(report));}
