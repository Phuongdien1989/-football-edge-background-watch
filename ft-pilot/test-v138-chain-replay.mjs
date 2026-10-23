// Phase 3 actual inherited v138 -> v130 parity using the existing 7x3 replay.
// Copies ONLY to generated local files. Unmodified original Worker modules.
// Lowest v128/transport, HTTP and Push delivery are still deterministic stubs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
let replay=readFileSync('ft-pilot/test-dual-replay.mjs','utf8');
const one=(a,b)=>{
 assert.equal(replay.split(a).length,2,'V138_HARNESS_ANCHOR_DRIFT '+a.slice(0,90));
 replay=replay.replace(a,b);
};
const folder='ft-audit-output/ft-pilot-v138-parity';
mkdirSync(folder,{recursive:true});
one("const root='ft-audit-output/ft-pilot-parity';mkdirSync(root,{recursive:true});",
"const root='ft-audit-output/ft-pilot-v138-parity';mkdirSync(root,{recursive:true});");
const oldBlock=[
"writeFileSync(root+'/before.mjs',adapt(original,false));",
"writeFileSync(root+'/after.mjs',adapt(patched,true));",
"const {BackgroundWatcher:Before}=await import(pathToFileURL(resolve(root+'/before.mjs')));",
"const {BackgroundWatcher:After}=await import(pathToFileURL(resolve(root+'/after.mjs')));"
].join('\n');
const newBlock=[
"writeFileSync(root+'/before.mjs',adapt(original,false));",
"writeFileSync(root+'/after.mjs',adapt(patched,true));",
"const layers=[",
" ['131','worker_notify_v131.js','worker_notify_v130.js'],",
" ['132','worker_notify_v132_native.js','worker_notify_v131.js'],",
" ['135','worker_notify_v135_full_pause.js','worker_notify_v132_native.js'],",
" ['136','worker_notify_v136_hot_priority.js','worker_notify_v135_full_pause.js'],",
" ['137','worker_notify_v137_quota50000.js','worker_notify_v136_hot_priority.js'],",
" ['138','worker_notify_v138_peak_window.js','worker_notify_v137_quota50000.js']",
"];",
"for(const side of ['before','after'])for(const [version,path,parent] of layers){",
" let s=readFileSync(path,'utf8');",
" const p=Number(/worker_notify_v(\\d+)/.exec(parent)?.[1]);",
" const newParent=p===130?side+'.mjs':side+'-v'+p+'.mjs';",
" const oldImport=\"from './\"+parent+\"'\";",
" if(s.split(oldImport).length!==2)throw Error('INHERITANCE_IMPORT_DRIFT '+path);",
" s=s.replace(oldImport,\"from './\"+newParent+\"'\");",
" s=s.replace(/from (['\"])\\.\\/([^'\"]+)\\1/g,(full,q,file)=>",
"  file===newParent?full:'from '+q+'../../'+file+q);",
" s=\"import {clockNow} from './clock.mjs';\\n\"+s.replaceAll('Date.now()','clockNow()');",
" writeFileSync(root+'/'+side+'-v'+version+'.mjs',s);",
"}",
"const {BackgroundWatcher:Before}=await import(pathToFileURL(resolve(root+'/before-v138.mjs')));",
"const {BackgroundWatcher:After}=await import(pathToFileURL(resolve(root+'/after-v138.mjs')));"
].join('\n');
one(oldBlock,newBlock);
one("const tasks=[],storage={\n  get:async key=>clone(data.get(key)),",
"const tasks=[],storage={\n  list:async({prefix=''}={})=>new Map([...data.entries()].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,clone(v)])),\n  get:async key=>clone(data.get(key)),");
one("const env={NOTIFY_DAILY_BUDGET:'43000',FT_PILOT_ENABLED:mode.flag,",
"const env={NOTIFY_DAILY_BUDGET:'43000',LIVE_STATE_D1_ENABLED:'false',MANUAL_SCAN_MODE_ENABLED:'false',PEAK_SCAN_ENABLED:'false',FT_PILOT_ENABLED:mode.flag,");
one("const result={checks,scenarios:cases.length,modes:modes.map(x=>x.name),",
"const result={checks,actual_full_inherited_v138_chain:true,full_real_io:false,real_top_ranker_tested:false,real_push_transport_tested:false,scenarios:cases.length,modes:modes.map(x=>x.name),");
one("console.log('FE_FT_PILOT_REAL_ENGINE_DUAL_REPLAY_PASS '+JSON.stringify({",
"console.log('FE_FT_PILOT_V138_INHERITED_AB_PASS '+JSON.stringify({");
writeFileSync(folder+'/run.mjs',replay);
await import(pathToFileURL(resolve(folder+'/run.mjs')));
