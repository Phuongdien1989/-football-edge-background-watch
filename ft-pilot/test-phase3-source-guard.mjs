// Review-only static guard. Actual v138 end-to-end A/B is NOT exercised here.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(p,'utf8');
const config=read('wrangler.toml');
assert.match(config,/^main\s*=\s*"worker_notify_v138_peak_window\.js"/m);
assert.match(config,/^compatibility_date\s*=\s*"2026-09-11"/m);
assert.match(config,/^PEAK_SCAN_ENABLED\s*=\s*"false"/m);
assert.match(config,/^crons\s*=\s*\[\s*\]/m);
assert(!config.includes('FT_PILOT_DB'),'PROD_CONFIG_FT_BINDING_LEAK');
assert(!config.includes('FT_PILOT_ENABLED = "true"'),'PROD_FT_FLAG_ENABLED');
const wanted=[138,137,136,135,132,131,130],seen=new Set(),chain=[];
let path='worker_notify_v138_peak_window.js';
for(const expected of wanted){
 assert(!seen.has(path),'INHERITANCE_CYCLE');seen.add(path);
 const content=read(path);
 assert.equal(Number(/worker_notify_v(\d+)/.exec(path)?.[1]),expected,'INHERITANCE_CHANGED');
 assert(!content.includes("from './ft-pilot/integration.mjs'"),'LEGACY_RUNTIME_MODIFIED');
 chain.push({file:path,hash:createHash('sha256').update(content).digest('hex')});
 if(expected===130){
  assert.match(content,/async notifyTick\s*\(/,'REAL_NOTIFY_TICK_MISSING');
  assert.match(content,/createEngine/,'REAL_H1_FT_HC_SCORER_MISSING');
 }else{
  const parents=[...content.matchAll(/from ['"]\.\/(worker_notify_v\d+[^'"]+\.js)['"]/g)];
  assert.equal(parents.length,1,'AMBIGUOUS_INHERITANCE');
  path=parents[0][1];
 }
}
assert(read('ft-audit-fix/mobile-asset-isolation.mjs').includes('REQUIRED_MOBILE_ASSETS'));
assert(read('ft-pilot/integration.mjs').includes("FT_PILOT_ENABLED!=='true'"));
const output={result:'PASS_STATIC_ONLY',target_compatibility_date:'2026-09-11',
 source_branch_head:process.env.GITHUB_SHA||null,source_chain:chain,
 production_deployment:false,provider_requests_made:0,
 complete_v138_runtime_parity:false,real_top_and_ht_valuation_tested:false,
 cloudflare_actual_d1_billing_measured:false};
mkdirSync('ft-audit-output/ft-pilot-phase3',{recursive:true});
writeFileSync('ft-audit-output/ft-pilot-phase3/source-guard.json',JSON.stringify(output,null,2));
console.log('FE_FT_PHASE3_STATIC_V138_CHAIN_PASS '+JSON.stringify(chain.map(x=>x.file)));
