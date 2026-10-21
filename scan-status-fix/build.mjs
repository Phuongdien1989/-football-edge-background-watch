import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {patchStatus} from './patch.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),root='scan-status-release';
const old=JSON.parse(readFileSync('previous-backend/manifest.json'));
const deployed=JSON.parse(readFileSync('previous-backend/deployment.json'));
assert.equal(deployed.version,'7e4bb3b7-2dc6-4f0d-8c8a-9d8e6da2440a');
assert.equal(deployed.source_commit,'15069125837d22f292a04bf111f0f569037793b5');
for(const f of old.candidate){assert(!f.path.includes('..'));assert.equal(hash(readFileSync('previous-backend/candidate/'+f.path)),f.sha256);}
mkdirSync(root,{recursive:true});cpSync('previous-backend/candidate',root+'/backup',{recursive:true});cpSync('previous-backend/candidate',root+'/candidate',{recursive:true});
const names=['worker_notify_v130.js','worker_notify_v138_peak_window.js'];
const files=Object.fromEntries(names.map(p=>[p,readFileSync(root+'/candidate/'+p,'utf8')]));
const after=patchStatus(files);for(const p of names)writeFileSync(root+'/candidate/'+p,after[p]);
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const list=folder=>walk(root+'/'+folder).map(p=>({path:p.slice((root+'/'+folder+'/').length),sha256:hash(readFileSync(p))}));
const backup=list('backup'),candidate=list('candidate'),changed=backup.filter(f=>candidate.find(x=>x.path===f.path)?.sha256!==f.sha256).map(f=>f.path).sort();assert.deepEqual(changed,names);
writeFileSync(root+'/manifest.json',JSON.stringify({source_commit:process.env.GITHUB_SHA,original_version:deployed.version,original_deploy_commit:deployed.source_commit,changed,backup,candidate,exact_scope_reconstruction:true},null,2));
console.log(JSON.stringify({status:'PASS',changed,provider_policy_changed:false,forecast_changed:false,thresholds_changed:false,frontend_changed:false}));
