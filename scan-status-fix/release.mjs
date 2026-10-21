import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='scan-status-release',m=JSON.parse(readFileSync(root+'/manifest.json')),mode=process.argv[2],token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,sha=process.env.GITHUB_SHA;assert(token&&account&&sha);assert(['prepare','deploy','verify','rollback'].includes(mode));
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/',name='football-edge-background-watch',config=root+'/candidate/.release.json',hash=b=>createHash('sha256').update(b).digest('hex');
let report;try{report=JSON.parse(readFileSync(root+'/deployment.json'));}catch{report={source_commit:sha,rollback:m.original_version,status:'PREPARING',scanner_toggled:false,provider_requests_requested:0,d1_writes_requested:0};}const save=()=>writeFileSync(root+'/deployment.json',JSON.stringify(report,null,2));
async function cf(path,opts={}){const r=await fetch(base+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+r.status);return j.result;}
async function active(n){const vs=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(vs?.length===1&&vs[0].percentage===100);return vs[0].version_id;}
async function health(requirePaused=true){const r=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(20000)});assert(r.ok,'HEALTH_'+r.status);const h=await r.json();if(requirePaused)assert.equal(h.peak_status?.enabled,false,'SCANNER_MUST_BE_PAUSED_BEFORE_RELEASE');if(requirePaused)assert.equal(h.peak_status?.manualEnabled,false,'MANUAL_SCANNER_ON');if(requirePaused)assert.equal(h.next_alarm,null,'ALARM_PENDING');return h;}
const signature=s=>hash(JSON.stringify((s.bindings||[]).filter(b=>b.name!=='FE_DEPLOY_COMMIT').map(b=>JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).sort()));
async function others(){for(const [n,v]of Object.entries(report.other_versions||{}))assert.equal(await active(n),v,'UNRELATED_DRIFT_'+n);}
async function restore(){await health();await others();const own=await active(name);if(own!==m.original_version){assert(own===report.version,'UNOWNED_BACKEND_ROLLBACK');await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:m.original_version,percentage:100}]})});}assert.equal(await active(name),m.original_version);assert.equal((await health()).deploy_commit,m.original_deploy_commit);report.status='ROLLED_BACK_VERIFIED';save();}
try{
 if(mode==='prepare'){
  assert.equal(await active(name),m.original_version);assert.equal((await cf(name+'/versions/'+m.original_version)).id,m.original_version);const h=await health(false);assert.equal(h.deploy_commit,m.original_deploy_commit);report.scanner_enabled_at_preflight=h.peak_status?.enabled;
  report.other_versions={'shiny-silence-d892':'3166663f-f039-48f5-92ae-888890bb9455','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};await others();
  const settings=await cf(name+'/settings'),bs=settings.bindings||[];assert.equal((bs.find(b=>b.name==='FOOTBALL_DB')?.id||bs.find(b=>b.name==='FOOTBALL_DB')?.database_id),'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4');assert.equal(bs.find(b=>b.name==='APISPORTS_KEY')?.type,'secret_text');
  assert(bs.every(b=>['plain_text','secret_text','d1','durable_object_namespace'].includes(b.type)));report.binding_signature=signature(settings);
  for(const secret of ['BACKGROUND_TOKEN','VAPID_PRIVATE_KEY'])assert(!bs.some(b=>b.name===secret&&b.type==='plain_text'),'PLAINTEXT_SECRET');
  const schedules=await cf(name+'/schedules');assert.deepEqual(Array.isArray(schedules)?schedules:schedules.schedules,[],'UNEXPECTED_CRON');
  const cfg=JSON.parse(execFileSync('python3',['-c','import tomllib,json,sys; print(json.dumps(tomllib.load(open(sys.argv[1],"rb"))))',root+'/candidate/wrangler.toml'],{encoding:'utf8'}));assert.equal(cfg.name,name);assert.equal(cfg.main,'worker_notify_v138_peak_window.js');
  cfg.vars=Object.fromEntries(bs.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]));cfg.vars.FE_DEPLOY_COMMIT=sha;cfg.compatibility_date=settings.compatibility_date||cfg.compatibility_date;cfg.compatibility_flags=settings.compatibility_flags||cfg.compatibility_flags;writeFileSync(config,JSON.stringify(cfg));
  report.status=report.scanner_enabled_at_preflight?'PREPARED_WAITING_SCANNER_PAUSE':'PREPARED_SCANNER_OFF';save();
 }else if(mode==='deploy'){
  assert(['PREPARED_SCANNER_OFF','PREPARED_WAITING_SCANNER_PAUSE'].includes(report.status));await others();await health();assert.equal(await active(name),m.original_version);
  for(const f of m.candidate)assert.equal(hash(readFileSync(root+'/candidate/'+f.path)),f.sha256);
  try{execFileSync('npx',['--no-install','wrangler','deploy','--keep-vars','--config',config],{stdio:'pipe',timeout:180000});}catch{throw Error('BACKEND_UPLOAD_FAILED');}
  report.version=await active(name);assert.notEqual(report.version,m.original_version);save();assert.equal((await health()).deploy_commit,sha);await others();assert.equal(signature(await cf(name+'/settings')),report.binding_signature);report.status='DEPLOYED_TECHNICAL_PASS';save();
 }else if(mode==='verify'){assert.equal(await active(name),report.version);assert.equal((await health()).deploy_commit,sha);await others();assert.equal(signature(await cf(name+'/settings')),report.binding_signature);report.status='VERIFIED_SCANNER_OFF';report.live_push='PHONE_ACCEPTANCE_PENDING';save();}
 else await restore();
}catch(e){report.status='FAIL';report.error=String(e.message).slice(0,200);save();if(report.version&&(mode==='deploy'||mode==='verify'))try{if(!report.version){const own=await active(name),s=await cf(name+'/settings');if(own!==m.original_version&&s.bindings?.find(b=>b.name==='FE_DEPLOY_COMMIT')?.text===sha)report.version=own;}await restore();}catch(re){report.rollback_error=String(re.message).slice(0,200);save();}process.exitCode=1;}
if(mode==='verify'||mode==='rollback')try{unlinkSync(config);}catch{}console.log('SCAN_STATUS_RELEASE '+JSON.stringify(report));
