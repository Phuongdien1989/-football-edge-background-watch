// Backend release candidate: READ-ONLY Cloudflare/GitHub preflight. Absolutely NO deploy.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('CLOUDFLARE_READONLY_AUTH_MISSING');
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const target='football-edge-background-watch',mobile='shiny-silence-d892';
const expected={workerVersion:'02d56762-ba08-4a8d-8654-bc9d522fc29a',workerCommit:'d73d4b19a069b0b2aed7e2687f27f1820f50e3d1',olderRollback:'5f33a4b1-a299-4195-8a68-4646396a9214',mobileVersion:'03c1d55d-358a-448b-96f3-f356704831df'};
async function cf(url){
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 const json=await response.json().catch(()=>({}));
 if(!response.ok||json.success!==true)throw Error('CF_READ_FAILED_'+response.status+'_CODES_'+(json.errors||[]).map(x=>x.code).join(','));
 return json.result;
}
async function current(name){
 const d=await cf(base+name+'/deployments'),v=d?.deployments?.[0]?.versions;
 if(v?.length!==1||v[0].percentage!==100)throw Error('ACTIVE_WORKER_VERSION_UNVERIFIED_'+name);
 return v[0].version_id;
}
const [actual,phone]=await Promise.all([current(target),current(mobile)]);
if(actual!==expected.workerVersion)throw Error('BACKEND_PRODUCTION_VERSION_DRIFT');
if(phone!==expected.mobileVersion)throw Error('MOBILE_PRODUCTION_VERSION_DRIFT');
const [restore,older,settings,crons]=await Promise.all([
 cf(base+target+'/versions/'+expected.workerVersion),
 cf(base+target+'/versions/'+expected.olderRollback),
 cf(base+target+'/settings'),
 cf(base+target+'/schedules')
]);
if(!restore||!older)throw Error('ROLLBACK_VERSION_MISSING');
const db=settings?.bindings?.find(b=>b.name==='FOOTBALL_DB');
if(!db||!(db.id==='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4'||db.database_id==='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4'))throw Error('D1_BINDING_DRIFT');
const schedules=Array.isArray(crons)?crons:crons?.schedules;
if(!Array.isArray(schedules)||schedules.length!==0)throw Error('CRON_SCHEDULE_DRIFT');
const hr=await fetch('https://'+target+'.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});
if(!hr.ok)throw Error('BACKEND_HEALTH_HTTP_'+hr.status);
const h=await hr.json();
if(h.deploy_commit!==expected.workerCommit)throw Error('BACKEND_PRODUCTION_COMMIT_DRIFT');
if(h.peak_status?.enabled!==false||h.peak_status?.manualEnabled!==false||h.next_alarm!=null)throw Error('SCANNER_NOT_OFF_STOP');
const repo=process.env.GITHUB_REPOSITORY,githubToken=process.env.GITHUB_TOKEN;
if(!repo||!githubToken)throw Error('GITHUB_METADATA_AUTH_MISSING');
async function pr(n){
 const r=await fetch('https://api.github.com/repos/'+repo+'/pulls/'+n,{headers:{Authorization:'Bearer '+githubToken,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('GITHUB_PR_READ_FAILED_'+n+'_'+r.status);
 return r.json();
}
const [pr6,pr7]=await Promise.all([pr(6),pr(7)]);
if(pr6.state!=='open'||pr6.merged||pr6.head?.sha!=='79cd4ddfa4191fa5a6e620683947d77e6ecbf31c')throw Error('PR6_CHANGED');
if(pr7.state!=='open'||pr7.merged||pr7.head?.sha!=='d73d4b19a069b0b2aed7e2687f27f1820f50e3d1')throw Error('PR7_CHANGED');
const output={schema:'FE_D1_SYNC_RELEASE_READONLY_GATE_V1',deployed:false,backend:{version:actual,commit:h.deploy_commit},mobile:{version:phone,unmodified:true},rollbacks:{current_version_exists:!!restore,older_version_exists:!!older},db_binding:'verified',cron:0,scanner:{enabled:false,manualEnabled:false,next_alarm:null},pr6:'unchanged',pr7:'unchanged',meter_source:'PR7 preserved in baseline'};
console.log('FE_D1_SYNC_RELEASE_PREFLIGHT_PASS '+JSON.stringify(output));
