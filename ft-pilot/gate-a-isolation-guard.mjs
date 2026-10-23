// Gate A static isolation contract. No Cloudflare SDK, API access or network.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const root='ft-audit-output/ft-gate-a-isolation';mkdirSync(root,{recursive:true});
const prod=read('wrangler.toml'),stage=read('ft-pilot/staging-isolation.review.toml');
const f=(src,k)=>new RegExp('^'+k+'\\s*=\\s*"([^"]+)"','m').exec(src)?.[1];
const errors=[],checks=[];
const require=(ok,code)=>{if(ok)checks.push(code);else errors.push(code);};
require(f(prod,'name')==='football-edge-background-watch','PRODUCTION_WORKER_BASELINE');
require(f(prod,'main')==='worker_notify_v138_peak_window.js','PRODUCTION_ENTRYPOINT_UNCHANGED');
require(f(prod,'compatibility_date')==='2026-09-11','EXACT_COMPAT_DATE');
require(f(stage,'main')==='ft-pilot/shadow-worker.mjs','STAGING_SHADOW_ONLY');
require(f(stage,'name')!==f(prod,'name'),'STAGING_WORKER_NAME_ISOLATED');
require(f(stage,'FT_PILOT_ENABLED')==='false','PILOT_RECORDER_DISABLED');
require(!stage.includes('FOOTBALL_DB')&&!stage.includes('BACKGROUND_WATCHER'),'NO_PRODUCTION_BINDING_NAMES');
require(!stage.includes('0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4'),'NO_PRODUCTION_D1_UUID');
require(!stage.includes('e82758f2-e533-44a6-b42d-4821d120e082'),'DO_NOT_REUSE_HISTORIC_DB');
require(!/APISPORTS_KEY|API_FOOTBALL|APNS_PRIVATE_KEY|FCM_PRIVATE_KEY|SEND_PUSH|scanner/i.test(stage.replace(/^#.*$/gm,'')),'NO_PROVIDER_OR_PUSH_SECRETS');
require(!/\[\[?triggers\]?\]|crons\s*=|routes?\s*=|route\s*=/.test(stage.replace(/^#.*$/gm,'')),'NO_SCHEDULE_OR_ROUTE');
require(f(stage,'database_id')==='REPLACE_WITH_NEW_ISOLATED_STAGING_UUID','UNRESOLVED_NEW_D1_ID_BLOCKS_DEPLOY');
require(!/\[\[migrations\]\]/.test(stage),'DO_MIGRATION_UNSET_BLOCKS_DEPLOY');
require(f(stage,'FT_PILOT_LOGIC_VERSION')==='REPLACE_WITH_VERIFIED_SHA256','LOGIC_VERSION_NOT_ACTIVATED');
require(!prod.includes('FT_PILOT_ENABLED')&&!prod.includes('FT_PILOT_DB'),'NO_FT_PRODUCTION_HOOK');
const policy={status:errors.length?'FAIL':'PASS_REVIEW_ONLY',checks,errors,
 gateA:{approved:true,cloud_deployed:false,permission_verified_for_create:false,
 account_free_billing_headroom_verified:false,isolated_resources_allocated:false},
 limits_if_free:{rows_read_per_day:5000000,rows_written_per_day:100000},
 snapshot_20261022_prod_rows_written:102420,not_realtime:true,
 staging_template_deployable:false,prod_changed:false,
 require_predeploy:{new_worker_admin:true,new_d1_id:true,do_isolation:true,
 confirmed_remaining_quota:true,recorders_off:true,new_provider_calls:0}};
writeFileSync(root+'/gate-a-isolation.json',JSON.stringify(policy,null,2));
assert.equal(errors.length,0,errors.join(','));
console.log('FE_GATE_A_ISOLATION_STATIC_PASS '+JSON.stringify({checks:checks.length,
 staging_resource_created:false,production_changed:false,cloud_deploy_blocked:true}));
