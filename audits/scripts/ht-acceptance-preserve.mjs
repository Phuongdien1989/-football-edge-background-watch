import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='accept-package/package',out='accept-evidence';mkdirSync(out,{recursive:true});
const report={checked_at:new Date().toISOString(),status:'RUNNING',production_deployed:false,scanner_toggled:false,database_backup:false,checks:{}};
const hash=b=>createHash('sha256').update(b).digest('hex');
function save(){writeFileSync(out+'/acceptance.json',JSON.stringify(report,null,2));}
save();
try {
const manifest=JSON.parse(readFileSync(root+'/manifest.json'));
assert.equal(manifest.source_commit,'a9e9cc68cc07af27bdca0305b6f227da12f64cb9');
assert.equal(manifest.backend_source_baseline,'da5242bb41b2401271f52dda17b0e2208e7e3819');
for(const f of manifest.files){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(root+'/'+f.path)),f.sha256,'ARTIFACT_HASH_'+f.path);}
report.checks.package_hashes={status:'PASS',files:manifest.files.length};
const original=JSON.parse(readFileSync('audits/2026-10-20/ui-tabs-mobile-release-manifest.json'));
for(const f of original.files)assert.equal(hash(readFileSync(root+'/backup/mobile/'+f.path)),f.sha256,'MOBILE_BACKUP_'+f.path);
assert.equal(hash(readFileSync(root+'/backend/wrangler.toml')),hash(readFileSync(root+'/backup/backend/wrangler.toml')),'BACKEND_CONFIG_CHANGED');
const changed=readdirSync(root+'/backup/backend').filter(f=>hash(readFileSync(root+'/backup/backend/'+f))!==hash(readFileSync(root+'/backend/'+f))).sort();
assert.deepEqual(changed,['notify-core-h1.js','worker_notify_v130.js']);
report.checks.backup={status:'PASS',mobile_files:original.files.length,backend_original_files:readdirSync(root+'/backup/backend').length,candidate_changed_existing_backend_files:changed,configuration_unchanged:true};
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;assert(token&&account,'CONFIGURED_AUTH_REQUIRED');
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
async function cf(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});const j=await r.json();assert(r.ok&&j.success,'CF_READ_'+r.status);return j.result;}
const expected={'shiny-silence-d892':'3c0e47ed-275b-410c-b527-77f1ff65a28a','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
report.rollbacks={};
for(const [name,version] of Object.entries(expected)){
 const d=await cf(name+'/deployments'),v=d.deployments?.[0]?.versions;
 assert(v?.length===1&&v[0].percentage===100&&v[0].version_id===version,'PRODUCTION_DRIFT_'+name);
 const old=await cf(name+'/versions/'+version);assert(old?.id===version,'ROLLBACK_NOT_FOUND_'+name);
 report.rollbacks[name]={version,exists:true,currently_active:true};
}
report.checks.rollback_versions='PASS';
const settings=await cf('football-edge-background-watch/settings');
const db=settings.bindings?.find(b=>b.name==='FOOTBALL_DB');
assert.equal(db?.id||db?.database_id,'0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4','D1_BINDING_DRIFT');
const schedules=await cf('football-edge-background-watch/schedules');
assert.equal((Array.isArray(schedules)?schedules:schedules.schedules)?.length,0,'CRON_DRIFT');
const hr=await fetch('https://football-edge-background-watch.ngophuonghuy.workers.dev/health',{signal:AbortSignal.timeout(25000)});
assert(hr.ok,'HEALTH_HTTP_'+hr.status);const h=await hr.json();
assert.equal(h.deploy_commit,'da5242bb41b2401271f52dda17b0e2208e7e3819','BACKEND_COMMIT_DRIFT');
report.checks.health={status:'PASS',commit:h.deploy_commit,scanner_enabled:h.peak_status?.enabled,manual_enabled:h.peak_status?.manualEnabled,next_alarm:h.next_alarm??null};
for(const f of original.files){
 const r=await fetch('https://shiny-silence-d892.ngophuonghuy.workers.dev/'+f.path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});
 assert(r.ok,'PUBLIC_ASSET_HTTP_'+f.path);assert.equal(hash(new Uint8Array(await r.arrayBuffer())),f.sha256,'PUBLIC_ASSET_DRIFT_'+f.path);
}
report.checks.active_mobile_assets={status:'PASS',verified:original.files.length};
report.status='PRE_RELEASE_CHECKS_PASS_LIVE_ACCEPTANCE_PENDING';
report.not_verified=['Authenticated candidate provider warm-up','Physical iPhone/PWA and Push receipt','Production quota under candidate traffic','Actual rollback execution (not invoked against healthy production)'];
report.release_gate='HOLD: candidate not deployed; real-device and authenticated live acceptance pending';
save();console.log(JSON.stringify(report));
}catch(e){report.status='FAIL';report.error=e.message;save();throw e;}
