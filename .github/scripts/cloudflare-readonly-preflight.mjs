import {readFileSync, writeFileSync} from 'node:fs';
const cfg=readFileSync('wrangler.toml','utf8');
const worker=cfg.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
const database=cfg.match(/^database_id\s*=\s*"([^"]+)"/m)?.[1];
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const rollback=process.env.FE_ROLLBACK_VERSION_ID;
const report={commit:process.env.CANDIDATE_SHA,mode:'READ_ONLY_NO_DEPLOY',worker,checks:{},blockers:[]};
const block=s=>report.blockers.push(s);
for(const [key,value] of Object.entries({CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,FE_ROLLBACK_VERSION_ID:rollback})){
 report.checks[key]=Boolean(value);if(!value)block('MISSING_'+key);
}
if(!worker||!database)block('WRANGLER_WORKER_OR_D1_ID_MISSING');
if(rollback&&!rollback.startsWith('60781a4e'))block('ROLLBACK_DOES_NOT_MATCH_60781a4e');
async function api(path,options={}){
 const r=await fetch('https://api.cloudflare.com/client/v4'+path,{...options,headers:{authorization:'Bearer '+token,'content-type':'application/json'},signal:AbortSignal.timeout(20000)});
 const body=await r.json();if(!r.ok||body.success===false)throw Error('HTTP_'+r.status+'_CODES_'+(body.errors||[]).map(x=>x.code).join(','));
 return body.result;
}
if(token&&account&&worker&&database){
 const prefix='/accounts/'+encodeURIComponent(account);
 try{
  const deployments=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/deployments');
  report.checks.deployments_read='PASS';report.currentDeployments=deployments;
 }catch(e){block('WORKERS_DEPLOYMENTS_READ:'+e.message)}
 if(rollback&&rollback.startsWith('60781a4e')){
  try{
   let full=rollback;
   if(rollback.length!==36){
    const versions=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/versions');
    const matches=(versions.items||versions.versions||versions||[]).filter(x=>String(x.id).startsWith(rollback));
    if(matches.length!==1)throw Error('ROLLBACK_PREFIX_NOT_UNIQUE_OR_NOT_IN_VERSION_LIST_USE_FULL_UUID');
    full=matches[0].id;
   }
   const version=await api(prefix+'/workers/scripts/'+encodeURIComponent(worker)+'/versions/'+encodeURIComponent(full));
   report.rollbackVersion={id:version.id||full};report.checks.rollback_version_read='PASS';
  }catch(e){block('ROLLBACK_VERIFY:'+e.message)}
 }
 try{
  const db=await api(prefix+'/d1/database/'+encodeURIComponent(database));
  report.checks.d1_database_read='PASS';report.database={uuid:db.uuid,name:db.name,file_size:db.file_size};
  const schema=await api(prefix+'/d1/database/'+encodeURIComponent(database)+'/query',{method:'POST',body:JSON.stringify({sql:"SELECT name,sql FROM sqlite_master WHERE type='table' AND name='fe_notify_live_state'"})});
  if(!Array.isArray(schema)||schema.some(x=>x.success===false))throw Error('D1_SCHEMA_QUERY_FAILED');
  report.liveTableSchema=schema.flatMap(x=>x.results||[]);report.checks.d1_schema_read='PASS';
  report.checks.live_table=report.liveTableSchema.length?'EXISTS_REVIEW_COLUMNS':'ABSENT_CANDIDATE_CREATES_ON_FIRST_USE';
 }catch(e){block('D1_READ:'+e.message)}
}
report.checks.account_wide_usage='NOT_VERIFIED_REQUIRES_CLOUDFLARE_ANALYTICS';
report.checks.production_deploy='NOT_ATTEMPTED';
writeFileSync('cloudflare-readonly-preflight.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.blockers.length)process.exitCode=1;
