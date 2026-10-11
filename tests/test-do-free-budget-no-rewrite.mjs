import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../worker_notify_v130.js',import.meta.url),'utf8');
assert.match(s,/const previousBudget=await this\.ctx\.storage\.get\('notify:budget'\)/);
assert.match(s,/if\(budgetChanged\)await this\.ctx\.storage\.put\('notify:budget',budget\)/);
assert.doesNotMatch(s,/storage\.put\(\{'notify:status':status,'notify:budget':budget\}\)/);
assert.match(s,/await this\.ctx\.storage\.put\('notify:status',status\)/);
console.log('PASS: notification budget is only persisted when day or usage changes');
