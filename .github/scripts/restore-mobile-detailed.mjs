import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Cloudflare credentials unavailable');
const worker='shiny-silence-d892',root='https://'+worker+'.ngophuonghuy.workers.dev';
const before='d6162492-38de-42fa-901d-72fd777a22b3',target='03c1d55d-358a-448b-96f3-f356704831df';
const beforeHash='a9b82cdb5fb6c4742ba8ba1e960fa5f60406204d8bd8ec0f7f62f2d709c6ce7b',targetHash='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28';
const others={'football-edge-background-watch':'2be01a61-cc5d-43c7-9c6d-13e581296453','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
async function cf(path,opts={}){const r=await fetch(api+path,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare request failed '+path+' HTTP '+r.status);return j.result}
async function active(name){const j=await cf(name+'/deployments'),v=j.deployments?.[0]?.versions;if(v?.length!==1||v[0].percentage!==100)throw Error('Unexpected traffic '+name);return v[0].version_id}
async function checkOthers(){for(const [n,v] of Object.entries(others))if(await active(n)!==v)throw Error('Unrelated Worker drift '+n)}
async function bytes(path='/'){const r=await fetch(root+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Public HTTP '+r.status+' '+path);return Buffer.from(await r.arrayBuffer())}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function deploy(version,message){await cf(worker+'/deployments',{method:'POST',body:JSON.stringify({strategy:'percentage',versions:[{version_id:version,percentage:100}],annotations:{'workers/message':message}})})}
async function verify(version,sha){if(await active(worker)!==version)throw Error('Active version mismatch');for(let i=0;i<8;i++){if(hash(await bytes())===sha)return;await new Promise(r=>setTimeout(r,1500))}throw Error('Public HTML hash mismatch')}
mkdirSync('mobile-restore-evidence',{recursive:true});let attempted=false;
try{
 await checkOthers();if(await active(worker)!==before)throw Error('Mobile version drift');
 await cf(worker+'/versions/'+target);await cf(worker+'/versions/'+before);
 const html=await bytes();if(hash(html)!==beforeHash)throw Error('Mobile HTML drift');
 writeFileSync('mobile-restore-evidence/preserved-premium-top-five.html',html);
 const staticHashes={};for(const name of ['push-sw.js','manifest.webmanifest']){const b=await bytes('/'+name);staticHashes[name]=hash(b);writeFileSync('mobile-restore-evidence/'+name,b)}
 writeFileSync('mobile-restore-evidence/before.json',JSON.stringify({version:before,htmlSha256:beforeHash,target,preservedSource:'716ad2a0099951d49630d1c884d5901941d14162',preservedBranch:'checkpoint/mobile-premium-top-five-20261016',staticHashes},null,2));
 attempted=true;await deploy(target,'User requested original detailed Mobile UI; Premium TOP five preserved');
 await verify(target,targetHash);await checkOthers();
 for(const [name,h] of Object.entries(staticHashes))if(hash(await bytes('/'+name))!==h)throw Error('Push resource changed '+name);
 const current=await bytes();if(current.includes(Buffer.from('id="FE_SP_PREMIUM_JS"')))throw Error('Premium UI still served');
 writeFileSync('mobile-restore-evidence/restored-detailed.html',current);
 const result={status:'PASS',mobileVersion:target,htmlSha256:targetHash,preservedPremiumVersion:before,preservedPremiumCommit:'716ad2a0099951d49630d1c884d5901941d14162',backendVersion:others['football-edge-background-watch'],desktopVersion:others['football-edge-desktop-b2-test'],pushResourcesUnchanged:true,scannerToggled:false,productionDataMutated:false};
 writeFileSync('mobile-restore-evidence/result.json',JSON.stringify(result,null,2));console.log('MOBILE_DETAILED_RESTORED',JSON.stringify(result));
}catch(e){if(attempted){await deploy(before,'Restore Premium TOP five after detailed UI restoration verification failed');await verify(before,beforeHash);console.log('PREMIUM_RECOVERY_VERIFIED',before)}throw e}
