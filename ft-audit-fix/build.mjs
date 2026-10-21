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
const candidate=manifest.candidate.map(f=>({path:f.path,sha256:hash(readFileSync(out+'/candidate/'+f.path))}));
const changed=candidate.filter(f=>f.sha256!==manifest.candidate.find(x=>x.path===f.path).sha256).map(x=>x.path);
assert.deepEqual(changed,['notify-core.js']);
writeFileSync(out+'/manifest.json',JSON.stringify({baseline_commit:manifest.source_commit,baseline_artifact:12330995383,changed,candidate,deployed:false,scope:'FT market category and null preservation only; event freshness follow-up pending'},null,2));
console.log('BUILD PASS: baseline hashes verified; only notify-core.js changed');
