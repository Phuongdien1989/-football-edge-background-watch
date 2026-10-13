import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../worker_notify_v136_hot_priority.js',import.meta.url),'utf8');
assert.match(source,/now-previousBoost<120000/,'HOT duplicate-write guard missing');
assert.match(source,/now-num\(previous\.at,0\)>=120000/,'scheduler status write throttle missing');
assert.match(source,/await super\.send\(device,payload\)/,'push delivery must remain delegated');
assert.match(source,/await super\.alarm\(\)/,'inherited scan loop must remain active');
assert.match(source,/hotPriorityCandidates\(\)/,'HOT candidate selection must remain active');
console.log('PASS: DO write-throttle source invariants (static only)');
