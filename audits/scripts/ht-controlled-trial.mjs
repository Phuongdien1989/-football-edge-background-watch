// Controlled HT trial release from the reviewed immutable package.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,unlinkSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const mode=process.argv[2],out='ht-rollout',pkg='accept-package/package';
assert(['prepare','deploy','rollback','verify'].includes(mode),'ACTION_REQUIRED');
mkdirSync(out,{recursive:true});
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,sha=process.env.GITHUB_SHA;
assert(account&&token&&sha,'CONFIGURED_AUTH_REQUIRED');
const expected={'shiny-silence-d892':'3c0e47ed-275b-410c-b527-77f1ff65a28a','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
const mobile='shiny-silence-d892',backend='football-edge-background-watch',desktop='football-edge-desktop-b2-test';
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account),origin=n=>'https://'+n+'.ngophuonghuy.workers.dev';
const hash=b=>createHash('sha256').update(b).digest('hex'),wait=ms=>new Promise(r=>setTimeout(r,ms));
const path=out+'/release.json';
let report;try{report=JSON.parse(readFileSync(path));}catch{report={release_commit:sha,candidate_code:'a9e9cc68cc07af27bdca0305b6f227da12f64cb9',source_run:39491133238,original_versions:expected,versions:{},status:'PREPARING',scanner_toggled:false,provider_requests_requested:0,d1_writes_requested:0,database_backup:false,checks:{}};}
assert.equal(report.release_commit,sha,'RELEASE_RECORD_DRIFT');
const save=()=>writeFileSync(path,JSON.stringify(report,null,2));
async function cf(p,o={}){const r=await fetch(base+p,{...o,headers:{Authorization:'Bearer '+token,...o.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CF_'+r.status+'_CODES_'+(j.errors||[]).map(e=>e.code).join(','));return j.result;}
const workerPath=n=>'/workers/scripts/'+n;
async function active(n){const v=(await cf(workerPath(n)+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT_'+n);return v[0].version_id;}
async function settings(n){return cf(workerPath(n)+'/settings');}
async function health(){const r=await fetch(origin(backend)+'/health',{signal:AbortSignal.timeout(20000)});assert(r.ok,'HEALTH_HTTP_'+r.status);return r.json();}
function off(h){assert.equal(h.peak_status?.enabled,false,'BACKGROUND_SCAN_STILL_ON');assert.equal(h.peak_status?.manualEnabled,false,'MANUAL_SCAN_STILL_ON');}
async function paused(){let h=await health();off(h);for(let i=0;h.next_alarm!=null&&i<10;i++){await wait(2000);h=await health();off(h);}assert.equal(h.next_alarm,null,'OFF_ALARM_STILL_PENDING');return h;}
function signature(s){return (s.bindings||[]).filter(b=>b.name!=='FE_DEPLOY_COMMIT').map(b=>JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).sort();}
async function publicHash(n,p){const r=await fetch(origin(n)+'/'+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'PUBLIC_HTTP_'+r.status+'_'+p);return hash(new Uint8Array(await r.arrayBuffer()));}
function files(p){return readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(p+'/'+d.name):[p+'/'+d.name]);}
async function verifyPublic(list,folder){for(const f of list)assert.equal(await publicHash(mobile,f),hash(readFileSync(folder+'/'+f)),'PUBLIC_HASH_'+f);}
function run(config,dry){try{const log=execFileSync('npx',['--no-install','wrangler','deploy','--config',config,...(dry?['--dry-run']:['--keep-vars'])],{encoding:'utf8',stdio:'pipe',timeout:180000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});return {status:'PASS',bundle_line:log.split('\n').find(l=>l.includes('Total Upload:'))?.replace(/\u001b\[[0-9;]*m/g,'')};}catch{throw Error('WRANGLER_'+(dry?'DRY_RUN':'DEPLOY')+'_FAILED');}}
const mobileFiles=()=>files(pkg+'/site').map(p=>p.slice((pkg+'/site/').length)).sort();
const backupFiles=()=>files(pkg+'/backup/mobile').map(p=>p.slice((pkg+'/backup/mobile/').length)).sort();
async function restoreOne(n,v){
 const current=await active(n);if(current===expected[n])return;
 assert(v&&current===v,'UNRELATED_VERSION_REFUSE_ROLLBACK_'+n);
 await cf(workerPath(n)+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:expected[n],percentage:100}],annotations:{'workers/message':'Restore preserved pre-HT baseline'}})});
 assert.equal(await active(n),expected[n],'ROLLBACK_VERSION_'+n);
}
async function rollback(){
 await paused();assert.equal(await active(desktop),expected[desktop],'DESKTOP_DRIFT');
 // If upload returned an error after changing traffic, prove ownership before restoring.
 if(!report.versions[backend]&&await active(backend)!==expected[backend]){
   const s=await settings(backend);assert.equal(s.bindings?.find(b=>b.name==='FE_DEPLOY_COMMIT')?.text,sha,'UNOWNED_BACKEND_VERSION');
   report.versions[backend]=await active(backend);
 }
 if(!report.versions[mobile]&&await active(mobile)!==expected[mobile]){
   assert.equal(await publicHash(mobile,'index.html'),hash(readFileSync(pkg+'/site/index.html')),'UNOWNED_MOBILE_VERSION');
   report.versions[mobile]=await active(mobile);
 }
 await restoreOne(mobile,report.versions[mobile]);await restoreOne(backend,report.versions[backend]);
 await verifyPublic(backupFiles(),pkg+'/backup/mobile');
 let h;for(let i=0;i<15;i++){h=await paused();if(h.deploy_commit==='da5242bb41b2401271f52dda17b0e2208e7e3819')break;await wait(2000);}
 assert.equal(h.deploy_commit,'da5242bb41b2401271f52dda17b0e2208e7e3819','RESTORED_HEALTH_SOURCE');
 report.status='ROLLED_BACK_VERIFIED';report.rollback='PASS';save();
}
let backendConfig=pkg+'/backend/.ht-release-wrangler.json',mobileConfig=pkg+'/mobile-release.json';
try{
 if(mode==='prepare'){
   const manifest=JSON.parse(readFileSync(pkg+'/manifest.json'));assert.equal(manifest.source_commit,report.candidate_code);
   for(const f of manifest.files){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(pkg+'/'+f.path)),f.sha256,'PACKAGE_HASH_'+f.path);}
   for(const [n,v]of Object.entries(expected)){assert.equal(await active(n),v,'PRODUCTION_DRIFT_'+n);assert.equal((await cf(workerPath(n)+'/versions/'+v)).id,v,'ROLLBACK_MISSING_'+n);}
   const h=await paused();assert.equal(h.deploy_commit,'da5242bb41b2401271f52dda17b0e2208e7e3819');
   report.scan_before={enabled:false,manualEnabled:false,next_alarm:null};
   await verifyPublic(backupFiles(),pkg+'/backup/mobile');
   const before=await settings(backend),mb=await settings(mobile),bs=before.bindings||[];
   const db=bs.find(b=>b.name==='FOOTBALL_DB'),ob=bs.find(b=>b.name==='BACKGROUND_WATCHER');
   assert.equal(db?.id||db?.database_id,'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4');
   assert.equal(ob?.namespace_id,'a401c5da72a54ec1ba485db1b46d89c9');assert.equal(ob?.class_name,'BackgroundWatcher');
   assert(bs.every(b=>['plain_text','secret_text','d1','durable_object_namespace'].includes(b.type)),'UNREVIEWED_BINDING_TYPE');
   for(const name of ['APISPORTS_KEY','BACKGROUND_TOKEN','VAPID_PRIVATE_KEY'])assert(!bs.some(b=>b.name===name&&b.type==='plain_text'),'SENSITIVE_BINDING_MUST_NOT_BE_PLAINTEXT');
   assert.equal(bs.find(b=>b.name==='APISPORTS_KEY')?.type,'secret_text');
   assert((mb.bindings||[]).every(b=>b.type==='assets'),'MOBILE_HAS_NON_ASSET_BINDINGS');
   const crons=await cf(workerPath(backend)+'/schedules');assert.deepEqual(Array.isArray(crons)?crons:crons.schedules,[]);
   report.binding_signature=hash(signature(before).join('\n'));
   async function gql(query,variables={}){
     const r=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(25000)});
     const j=await r.json();assert(r.ok&&!j.errors?.length,'ANALYTICS_READ_'+r.status);return j.data;
   }
   const unwrap=t=>t?.name||unwrap(t.ofType);
   const fields=async name=>(await gql('query($name:String!){__type(name:$name){fields{name type{kind name ofType{kind name ofType{kind name ofType{kind name ofType{kind name}}}}}}}}',{name})).__type.fields;
   const root=(await gql('{__schema{queryType{name}}}')).__schema.queryType.name;
   const vf=(await fields(root)).find(f=>f.name==='viewer');
   const af=(await fields(unwrap(vf.type))).find(f=>f.name==='accounts');
   const dataset=(await fields(unwrap(af.type))).find(f=>f.name==='d1AnalyticsAdaptiveGroups');assert(dataset,'D1_ANALYTICS_DATASET_MISSING');
   const sf=(await fields(unwrap(dataset.type))).find(f=>f.name==='sum');
   const available=(await fields(unwrap(sf.type))).map(f=>f.name);
   const written=available.find(n=>n==='rowsWritten'),read=available.find(n=>n==='rowsRead');assert(written&&read,'D1_ANALYTICS_ROW_UNITS_MISSING');
   const today=new Date().toISOString().slice(0,10);
   const q='query($accountTag:string!,$date:Date){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$date,date_leq:$date}){sum{'+written+' '+read+'} dimensions{date}}}}}';
   const usage=await gql(q,{accountTag:account,date:today});
   const groups=(usage.viewer?.accounts||[]).flatMap(a=>a.d1AnalyticsAdaptiveGroups||[]);
   report.account_d1_usage={utc_day:today,rows_written:groups.reduce((n,g)=>n+Number(g.sum?.[written]||0),0),rows_read:groups.reduce((n,g)=>n+Number(g.sum?.[read]||0),0),source:'Cloudflare account-wide analytics; may lag live traffic'};
   assert(report.account_d1_usage.rows_written<100000,'D1_FREE_DAILY_WRITES_EXHAUSTED');
   assert(report.account_d1_usage.rows_read<5000000,'D1_FREE_DAILY_READS_EXHAUSTED');
   report.checks.account_d1_headroom='AVAILABLE_AT_PREFLIGHT';

   // Use the same already-configured runtime variables and secrets; no secret values are read.
   const cfg=JSON.parse(execFileSync('python3',['-c',"import tomllib,json,sys; print(json.dumps(tomllib.load(open(sys.argv[1],'rb'))))",pkg+'/backend/wrangler.toml'],{encoding:'utf8'}));
   assert.equal(cfg.name,backend);assert.equal(cfg.main,'worker_notify_v138_peak_window.js');
   assert.equal(hash(readFileSync(pkg+'/backend/wrangler.toml')),hash(readFileSync(pkg+'/backup/backend/wrangler.toml')));
   cfg.vars=Object.fromEntries(bs.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));cfg.vars.FE_DEPLOY_COMMIT=sha;
   cfg.compatibility_date=before.compatibility_date||cfg.compatibility_date;cfg.compatibility_flags=before.compatibility_flags||cfg.compatibility_flags;
   writeFileSync(backendConfig,JSON.stringify(cfg));
   writeFileSync(mobileConfig,JSON.stringify({name:mobile,compatibility_date:mb.compatibility_date||'2026-10-01',...(mb.compatibility_flags?.length?{compatibility_flags:mb.compatibility_flags}:{}),keep_vars:true,assets:{directory:'./site'}}));
   report.checks.backend_dry_run=run(backendConfig,true);report.checks.mobile_dry_run=run(mobileConfig,true);
   report.checks.package_and_preserved_assets='PASS';report.checks.old_versions_exist='PASS';
   report.artifact_files=manifest.files.length;report.mobile_backup_files=backupFiles().length;report.backend_backup_files=readdirSync(pkg+'/backup/backend').length;
   report.status='PREPARED_SCANNER_OFF';save();
 }else if(mode==='deploy'){
   assert.equal(report.status,'PREPARED_SCANNER_OFF');
   for(const [n,v]of Object.entries(expected))assert.equal(await active(n),v,'PRE_DEPLOY_DRIFT_'+n);
   await paused();
   report.status='DEPLOYING_BACKEND';save();run(backendConfig,false);
   report.versions[backend]=await active(backend);assert.notEqual(report.versions[backend],expected[backend]);save();
   let h;for(let i=0;i<20;i++){h=await paused();if(h.deploy_commit===sha)break;await wait(2000);}assert.equal(h.deploy_commit,sha,'NEW_BACKEND_HEALTH_SOURCE');
   assert.equal(hash(signature(await settings(backend)).join('\n')),report.binding_signature,'RUNTIME_BINDINGS_DRIFT');
   assert.equal(await active(mobile),expected[mobile]);assert.equal(await active(desktop),expected[desktop]);
   await paused();report.status='DEPLOYING_MOBILE';save();run(mobileConfig,false);
   report.versions[mobile]=await active(mobile);assert.notEqual(report.versions[mobile],expected[mobile]);save();
   await verifyPublic(mobileFiles(),pkg+'/site');assert.equal(await active(desktop),expected[desktop]);
   h=await paused();assert.equal(h.deploy_commit,sha);report.status='DEPLOYED_HTTPS_QA_PENDING';report.rollback='ORIGINAL_VERSIONS_AVAILABLE';report.live_push='PHONE_ACCEPTANCE_PENDING';save();
 }else if(mode==='verify'){
   assert.equal(report.status,'DEPLOYED_HTTPS_QA_PENDING');
   for(const n of [backend,mobile])assert.equal(await active(n),report.versions[n]);
   assert.equal(await active(desktop),expected[desktop]);
   for(let i=0;i<3;i++){if(i)await wait(5000);const h=await paused();assert.equal(h.deploy_commit,sha);}
   report.status='TRIAL_DEPLOYED_TECHNICAL_ACCEPTANCE_PASS';report.checks.https_browser='PASS';report.checks.scanner_stays_off='PASS';report.not_verified=['Actual iPhone/PWA and Push receipt','Authenticated live provider warm-up','Account quota under candidate live traffic','Forecast accuracy'];save();
 }else await rollback();
}catch(e){
 report.error=String(e.message||e).slice(0,300);report.failed_action=mode;report.status='FAILED';save();
 if(mode==='deploy'||mode==='verify'){try{await rollback();}catch(re){report.status='FAIL_ROLLBACK_REQUIRES_REVIEW';report.rollback_error=String(re.message||re).slice(0,300);save();}}
 process.exitCode=1;
}finally{
 if(mode==='verify'||mode==='rollback')for(const f of [backendConfig,mobileConfig])try{unlinkSync(f);}catch{}
 console.log('HT_ROLLOUT '+JSON.stringify(report));
}
