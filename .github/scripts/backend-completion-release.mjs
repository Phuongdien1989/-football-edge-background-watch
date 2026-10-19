import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,sha=process.env.GITHUB_SHA;
const worker='football-edge-background-watch',original='2be01a61-cc5d-43c7-9c6d-13e581296453',baseline='3c97629e51251c56f9edeb8d0f67a7a0dad957a2',root='https://api.cloudflare.com/client/v4/accounts/'+account,path='/workers/scripts/'+worker,origin='https://'+worker+'.ngophuonghuy.workers.dev';
const report={source:sha,original_version:original,original_source:baseline,deployment:'NOT_ATTEMPTED',provider_requests_requested:0,checks:{},errors:[]};let attempted=false,before;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function cf(p,o={}){const r=await fetch(root+p,{...o,headers:{Authorization:'Bearer '+token,...o.headers},signal:AbortSignal.timeout(25000)}),j=await r.json();if(!r.ok||!j.success)throw Error('CF_'+r.status+'_CODES_'+(j.errors||[]).map(x=>x.code).join(','));return j.result}
async function active(n=worker){const v=(await cf('/workers/scripts/'+n+'/deployments')).deployments?.[0]?.versions;assert.equal(v?.length,1,'MULTIPLE_VERSIONS');assert.equal(v[0].percentage,100);return v[0].version_id}
async function clients(){assert.equal(await active('shiny-silence-d892'),'03c1d55d-358a-448b-96f3-f356704831df');assert.equal(await active('football-edge-desktop-b2-test'),'a332ee39-abb2-422d-a021-db78ef19cc10')}
async function health(){const r=await fetch(origin+'/health',{signal:AbortSignal.timeout(15000)});assert(r.ok);return r.json()}
function paused(h){assert.equal(h.peak_status?.enabled,false,'SCANNER_IS_ON');assert.equal(h.peak_status?.manualEnabled,false,'MANUAL_SCAN_IS_ON')}
function signature(s){return (s.bindings||[]).filter(x=>x.name!=='FE_DEPLOY_COMMIT').map(b=>JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).sort()}
function run(args){try{return execFileSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',stdio:'pipe',timeout:120000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}})}catch{throw Error('WRANGLER_'+args[0]+'_FAILED')}}
async function restore(){await cf(path+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:original,percentage:100}],annotations:{'workers/message':'Restore exact baseline after backend pause/minute release failure'}})});let ok=false;for(let i=0;i<30;i++){const h=await health();if(await active()===original&&h.deploy_commit===baseline){paused(h);ok=true;break}await wait(2000)}assert(ok);report.rollback='PASS';report.deployment='ROLLED_BACK'}
try{
 assert(account&&token&&sha);await clients();assert.equal(await active(),original,'BACKEND_VERSION_DRIFT');
 const initial=await health();paused(initial);assert.equal(initial.deploy_commit,baseline,'SOURCE_DRIFT');
 report.scan_before={enabled:initial.peak_status.enabled,manual:initial.peak_status.manualEnabled,alarm:initial.next_alarm};
 // A legacy OFF registration can leave a short pending wake; never cancel it or enable scanning.
 let settled=initial;for(let i=0;settled.next_alarm!=null&&i<12;i++){await wait(2000);settled=await health();paused(settled)}assert.equal(settled.next_alarm,null,'PAUSED_ALARM_DID_NOT_DRAIN');
 before=await cf(path+'/settings');await cf(path+'/versions/'+original);await cf(path+'/versions/60781a4e-70cb-4c02-a036-2528c3048ed5');report.checks.rollback_versions='PASS';
 const bs=before.bindings||[],db=bs.find(x=>x.name==='FOOTBALL_DB'),doBinding=bs.find(x=>x.name==='BACKGROUND_WATCHER');assert.equal(db?.id||db?.database_id,'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4');assert.equal(doBinding?.namespace_id,'a401c5da72a54ec1ba485db1b46d89c9');assert.equal(doBinding?.class_name,'BackgroundWatcher');
 assert(bs.every(x=>['plain_text','secret_text','d1','durable_object_namespace'].includes(x.type)),'UNSUPPORTED_BINDING');assert.equal(bs.find(x=>x.name==='APISPORTS_KEY')?.type,'secret_text');for(const n of ['BACKGROUND_TOKEN','VAPID_PRIVATE_KEY'])assert(!bs.some(x=>x.name===n&&x.type==='plain_text'),'SENSITIVE_PLAINTEXT_BINDING');
 const schedules=await cf(path+'/schedules');assert.deepEqual(Array.isArray(schedules)?schedules:schedules.schedules,[]);
 const unchanged=execFileSync('git',['diff','--name-only',baseline,'HEAD','--','wrangler.toml','notify-core*','*engine*','mobile-sports-premium','native'],{encoding:'utf8'}).trim();assert.equal(unchanged,'','ENGINE_OR_CONFIG_CHANGED');
 const cfg=JSON.parse(execFileSync('python3',['-c',"import tomllib,json;print(json.dumps(tomllib.load(open('wrangler.toml','rb'))))"],{encoding:'utf8'}));cfg.vars=Object.fromEntries(bs.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));cfg.vars.FE_DEPLOY_COMMIT=sha;cfg.compatibility_date=before.compatibility_date||cfg.compatibility_date;cfg.compatibility_flags=before.compatibility_flags||cfg.compatibility_flags;
 writeFileSync('.completion-wrangler.json',JSON.stringify(cfg));run(['deploy','--config','.completion-wrangler.json','--dry-run']);report.checks.preflight='PASS';
 attempted=true;run(['deploy','--config','.completion-wrangler.json','--keep-vars']);report.production_version=await active();assert.notEqual(report.production_version,original);
 const started=Date.now();let verified=false;report.observations=[];
 while(Date.now()-started<300000){const h=await health();paused(h);const current=h.notify_status?.diagnostics_version==='PACING_COOLDOWN_QUOTA_V7_PAUSE_MINUTE';report.observations.push({elapsed:Date.now()-started,edge_source:h.deploy_commit,do_current:current,alarm:h.next_alarm});if(h.deploy_commit===sha&&current){verified=true;break}await wait(10000)}assert(verified,'DO_VERSION_CONVERGENCE_NOT_VERIFIED');
 assert.deepEqual(signature(await cf(path+'/settings')),signature(before),'RUNTIME_SETTINGS_DRIFT');await clients();assert.equal(await active(),report.production_version);
 // Observe several app registration opportunities. This is health-only, no provider or push calls.
 report.pause_observation=[];for(let i=0;i<5;i++){if(i)await wait(10000);const h=await health();paused(h);assert.equal(h.deploy_commit,sha);assert.equal(h.next_alarm,null,'OFF_ALARM_REARMED');report.pause_observation.push({at:Date.now(),alarm:h.next_alarm,quota_used:h.notify_status?.global_api_quota?.used,diagnostics:h.notify_status?.diagnostics_version});}
 report.checks.runtime_settings_and_clients='PASS';report.checks.new_DO_version='PASS';report.checks.off_no_alarm_window='PASS';report.deployment='DEPLOYED_VERIFIED';report.rollback='AVAILABLE_VERIFIED';
}catch(e){report.errors.push(String(e.message||e).slice(0,300));process.exitCode=1;if(attempted){try{await restore()}catch{report.rollback='UNCONFIRMED';report.deployment='ROLLBACK_UNCONFIRMED'}}}
finally{try{unlinkSync('.completion-wrangler.json')}catch{}writeFileSync('backend-completion-release-result.json',JSON.stringify(report,null,2));console.log('BACKEND_COMPLETION_RELEASE '+JSON.stringify(report))}
