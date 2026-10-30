import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';import{patchScanHost,HOST_MARK}from'./patch-host.mjs';
const before=readFileSync('overview-scan-baseline/site/index.html','utf8'),after=patchScanHost(before);
assert.equal(after.split(HOST_MARK).length,2);assert.throws(()=>patchScanHost(after));
const start='  async function startUnifiedLiveScan(',end='  function handicapWatchEligible(';
assert.equal(after.slice(after.indexOf(start),after.indexOf(end)),before.slice(before.indexOf(start),before.indexOf(end)),'SCANNER_ALGORITHM_DRIFT');
for(const key of ['setInterval(','setTimeout('])assert.equal(after.split(key).length,before.split(key).length,'NEW_SCANNER_TIMER');
for(const m of after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!m[2].trim()||/type=["']module["']/.test(m[1]))continue;new vm.Script(m[2]);}
assert(after.includes('if(controlEpoch!==(FE_SCAN_HEALTH.controlEpoch||0))return;'));
assert(after.includes("method:'POST',body:{enabled},timeout:15000"));assert(after.includes('setAuto:values=>'));
console.log('OVERVIEW_SCAN_HOST_PASS native_unified_bytes_unchanged no_new_timers syntax_valid stale_GET_guard');
