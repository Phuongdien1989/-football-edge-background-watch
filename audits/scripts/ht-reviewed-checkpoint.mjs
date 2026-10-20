import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='ht-review/package',old=JSON.parse(readFileSync(root+'/manifest.json'));
assert.equal(old.source_commit,'ab079024c29a3a02f48d8c84a992b4b85667c9ad');
const hash=x=>createHash('sha256').update(x).digest('hex');
for(const f of old.files)assert.equal(hash(readFileSync(root+'/'+f.path)),f.sha256,'ARTIFACT_DRIFT_'+f.path);
const qa=JSON.parse(readFileSync(root+'/qa/browser-report.json'));assert.equal(qa.status,'PASS');assert.equal(qa.cases.length,4);
for(const c of qa.cases){assert.equal(c.status,'PASS');assert.equal(c.real_provider_requests,0);}
copyFileSync('audits/2026-10-21/HT_COMPLETE_CANDIDATE.md',root+'/README.md');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const files=walk(root).filter(p=>p!==root+'/manifest.json').map(p=>({path:p.slice(root.length+1),bytes:readFileSync(p).length,sha256:hash(readFileSync(p))}));
writeFileSync(root+'/manifest.json',JSON.stringify({...old,documentation_commit:process.env.GITHUB_SHA,reviewed:true,files},null,2));
const name='Football_Edge_HT_Reviewed_20261021.zip';
execFileSync('zip',['-qr',name,'package'],{cwd:'ht-review'});
writeFileSync('ht-review/SHA256.txt',hash(readFileSync('ht-review/'+name))+'  '+name+'\n');
console.log('REVIEW_SCREENSHOT '+readFileSync(root+'/qa/chromium-demo-390.png').toString('base64'));
console.log('REVIEW_DONE '+JSON.stringify({status:'PASS',code_commit:old.source_commit,documentation_commit:process.env.GITHUB_SHA,zip_sha256:hash(readFileSync('ht-review/'+name)),production_deployed:false}));
