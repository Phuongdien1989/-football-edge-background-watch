import assert from 'node:assert/strict';
import {evaluateManualScanGate as decide} from './manual-scan-gate.mjs';
const now='2026-10-23T01:08:00Z',utcDay='2026-10-23';
const analytics={status:'PASS',at:'2026-10-23T01:07:00Z',databases:[{day:utcDay,database:'KNOWN_PROD_DB',rowsWritten:15},{day:utcDay,database:'ISOLATED_FT_DB',rowsWritten:2}]};
const live={status:'PASS',at:'2026-10-23T01:07:00Z',
 backend:{status:'OK',versions:[{id:'e7d2090c-d0e1-4f58-9f5a-4360acd2ced3',percentage:100}]},
 mobile:{status:'OK',versions:[{id:'e1beb5bf-3617-4c54-805a-623cfafd7411',percentage:100}]},
 health:{status:'OK',http:200,deploy_commit:'3cd210d2d74aff547de4587ab4a3c96b982a728c',enabled:false,manual_enabled:false,next_alarm:null},
 rollback:{status:'OK',exists:true},
 mobile_rollback:{status:'OK',exists:true}};
let tests=0;
const run=(name,args,expect)=>{const actual=decide({analytics,live,utcDay,now,...args});assert.equal(actual.decision,expect,name+': '+JSON.stringify(actual.reasons));tests++;};
run('fresh healthy and under budget',{},'REVIEW_FOR_MANUAL_SHORT_SCAN');
run('old day only',{utcDay:'2026-10-24'},'NO_GO');
run('quota exceeded',{analytics:{...analytics,databases:[{day:utcDay,database:'KNOWN_PROD_DB',rowsWritten:100001}]}},'NO_GO');
run('headroom not enough',{analytics:{...analytics,databases:[{day:utcDay,database:'KNOWN_PROD_DB',rowsWritten:99500}]}},'NO_GO');
run('unknown live',{live:{}},'NO_GO');
run('missing Mobile rollback',{live:{...live,mobile_rollback:null}},'NO_GO');
run('Mobile rollback missing at Cloudflare',{live:{...live,mobile_rollback:{status:'OK',exists:false}}},'NO_GO');
run('backend rollback missing',{live:{...live,rollback:{status:'OK',exists:false}}},'NO_GO');
run('scanner already enabled',{live:{...live,health:{...live.health,enabled:true}}},'NO_GO');
run('manual already enabled',{live:{...live,health:{...live.health,manual_enabled:true}}},'NO_GO');
run('alarm scheduled',{live:{...live,health:{...live.health,next_alarm:'2026-10-23T01:09:00Z'}}},'NO_GO');
run('version drift',{live:{...live,mobile:{status:'OK',versions:[{id:'unexpected',percentage:100}]}}},'NO_GO');
run('stale stats',{analytics:{...analytics,at:'2026-10-22T20:00:00Z'}},'NO_GO');
run('stale health',{live:{...live,at:'2026-10-22T20:00:00Z'}},'NO_GO');
run('missing production D1',{analytics:{...analytics,databases:[{day:utcDay,database:'ISOLATED_FT_DB',rowsWritten:2}]}},'NO_GO');
run('unknown other account db',{analytics:{...analytics,databases:[...analytics.databases,{day:utcDay,database:'UNLISTED_DB',rowsWritten:3}]}},'NO_GO');
run('no records',{analytics:{...analytics,databases:[]}},'NO_GO');
run('negative metric',{analytics:{...analytics,databases:[{day:utcDay,database:'KNOWN_PROD_DB',rowsWritten:-1}]}},'NO_GO');
run('budget invalid',{plannedMaxWrittenRows:-10},'NO_GO');
console.log('FE_MANUAL_SCAN_GATE_QA_PASS '+JSON.stringify({tests,deploy:false,scanner_actions:0,D1_writes:0}));
