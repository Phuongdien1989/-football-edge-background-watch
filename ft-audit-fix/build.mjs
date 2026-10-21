import {patchWorker,patchUI} from './patch-events.mjs';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=process.argv[2]||'baseline',out=process.argv[3]||'ft-audit-output';
const manifest=JSON.parse(readFileSync(source+'/manifest.json'));
assert.equal(manifest.source_commit,'3cd210d2d74aff547de4587ab4a3c96b982a728c');
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const f of manifest.candidate){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(source+'/candidate/'+f.path)),f.sha256,f.path);}
mkdirSync(out,{recursive:true});cpSync(source+'/candidate',out+'/candidate',{recursive:true});
let code=readFileSync(out+'/candidate/notify-core.js','utf8');
function replaceOnce(a,b){assert.equal(code.split(a).length,2,'PATCH_ANCHOR');code=code.replace(a,b);}
const begin=code.indexOf('    const over=valid.filter('),end=code.indexOf('\n',begin);
assert(begin>0&&end>begin);
replaceOnce(code.slice(begin,end),"    const over=valid.filter(r=>r.category==='over_under');");
replaceOnce('line:Number.isFinite(Number(line))?Number(line):null,odd,main:v.main===true,label:raw','line:line!=null&&Number.isFinite(Number(line))?Number(line):null,odd,main:v.main===true,label:raw');
writeFileSync(out+'/candidate/notify-core.js',code);
writeFileSync(out+'/candidate/worker_notify_v130.js',patchWorker(readFileSync(out+'/candidate/worker_notify_v130.js','utf8')));
writeFileSync(out+'/candidate/notify-ui-state.mjs',patchUI(readFileSync(out+'/candidate/notify-ui-state.mjs','utf8')));
cpSync(new URL('./ft-events.mjs',import.meta.url),out+'/candidate/ft-events.mjs');
const candidate=manifest.candidate.map(f=>({path:f.path,sha256:hash(readFileSync(out+'/candidate/'+f.path))}));
const changed=candidate.filter(f=>f.sha256!==manifest.candidate.find(x=>x.path===f.path).sha256).map(x=>x.path);
assert.deepEqual([...changed].sort(),['notify-core.js','notify-ui-state.mjs','worker_notify_v130.js']);
candidate.push({path:'ft-events.mjs',sha256:hash(readFileSync(out+'/candidate/ft-events.mjs'))});
writeFileSync(out+'/manifest.json',JSON.stringify({baseline_commit:manifest.source_commit,baseline_artifact:12330995383,changed,candidate,deployed:false,scope:'FT market corrections, early FT-only event invalidation and receipt/change clocks; provider freshness not certified'},null,2));
console.log('BUILD PASS: baseline hashes verified; three existing files changed plus FT-only event module');
