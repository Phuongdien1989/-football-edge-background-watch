import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createHTEvents} from './events.mjs';
const pkg='accept-package/package',root='ht-backend-event-release',hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(readFileSync(pkg+'/manifest.json'));assert.equal(manifest.source_commit,'a9e9cc68cc07af27bdca0305b6f227da12f64cb9');
for(const f of manifest.files){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(pkg+'/'+f.path)),f.sha256);}
mkdirSync(root,{recursive:true});cpSync(pkg+'/backend',root+'/backup',{recursive:true});cpSync(pkg+'/backend',root+'/candidate',{recursive:true});
const file=root+'/candidate/worker_notify_v130.js',original=readFileSync(file,'utf8');let worker=original;const start=worker.indexOf('function resetType(');assert(start>=0);let before;
for(let end=worker.indexOf('}',start);end>=0;end=worker.indexOf('}',end+1)){try{const s=worker.slice(start,end+1);new vm.Script('('+s+')');before=s;break;}catch{}}assert(before);
const after='function resetType(prev,cur){return ('+createHTEvents.toString()+')().classify(prev,cur);}';assert.equal(worker.split(before).length,2);worker=worker.replace(before,after);
const oldCooldown="stamp+(ev==='GOAL'?120000:180000)",newCooldown="stamp+(['GOAL','SCORE_CORRECTION'].includes(ev)?120000:180000)";assert.equal(worker.split(oldCooldown).length,2);worker=worker.replace(oldCooldown,newCooldown);
assert.equal(worker.replace(after,before).replace(newCooldown,oldCooldown),original);writeFileSync(file,worker);
const reset=vm.runInNewContext('('+after+')');assert.equal(reset({goals:{home:1,away:0}},{goals:{home:0,away:0}}),'SCORE_CORRECTION');assert.equal(reset({goals:{home:1,away:0}},{goals:{home:0,away:1}}),'SCORE_CORRECTION');assert.equal(reset({metrics:{total:{red:1}}},{metrics:{total:{red:0}}}),'RED_CORRECTION');
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);const list=folder=>walk(root+'/'+folder).map(p=>({path:p.slice((root+'/'+folder+'/').length),sha256:hash(readFileSync(p))}));const backup=list('backup'),candidate=list('candidate');const changed=backup.filter(f=>candidate.find(x=>x.path===f.path)?.sha256!==f.sha256).map(f=>f.path);assert.deepEqual(changed,['worker_notify_v130.js']);
writeFileSync(root+'/manifest.json',JSON.stringify({source_commit:process.env.GITHUB_SHA,original_version:'fe5c9fb5-ae1d-4aa6-8850-8cbdeb2b8e73',original_deploy_commit:'76eae2e373138adeb0acaa0fff567b784ecd5016',changed,backup,candidate,exact_scope_reconstruction:true},null,2));console.log(JSON.stringify({status:'PASS',changed,backend_correction_tests:3}));
