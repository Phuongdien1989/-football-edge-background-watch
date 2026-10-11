import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../worker_notify_v127.js',import.meta.url),'utf8');
assert.match(src,/const previous=await this\.scanControl\(\)/);
assert.match(src,/if\(\(previous\.manualEnabled\?\?previous\.enabled\)===b\.enabled\)return reply\(\{ok:true,scan_control:previous,unchanged:true\}\)/);
assert.match(src,/if\(control\.enabled\)await this\.ctx\.storage\.setAlarm\(Date\.now\(\)\+1000\)/);
console.log('PASS: scan-control returns without writes on repeated identical pause or resume');
