import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='ht-session-release',m=JSON.parse(readFileSync(root+'/manifest.json')),mode=process.argv[2];assert(['prepare','deploy','verify','rollback'].includes(mode));
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;assert(token&&account);
const expected={'shiny-silence-d892':m.previous_mobile,'football-edge-background-watch':m.backend_unchanged,'football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'},name='shiny-silence-d892';
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/',origin='https://'+name+'.ngophuonghuy.workers.dev/';
const hash=b=>createHash('sha256').update(b).digest('hex');
let report;try{report=JSON.parse(readFileSync(root+'/deployment.json'));}catch{report={source_commit:process.env.GITHUB_SHA,rollback_version:m.previous_mobile,backend_unchanged:m.backend_unchanged,status:'PREPARING',scanner_toggled:false};}
const save=()=>writeFileSync(root+'/deployment.json',JSON.stringify(report,null,2));
async function cf(path,opts={}){const r=await fetch(api+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+r.status);return j.result;}
async function active(n){const v=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100);return v[0].version_id;}
async function others(){for(const n of Object.keys(expected).filter(n=>n!==name))assert.equal(await active(n),expected[n],'UNRELATED_VERSION_DRIFT_'+n);}
async function verifyPublic(list){for(const f of list){const r=await fetch(origin+f.path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok);assert.equal(hash(new Uint8Array(await r.arrayBuffer())),f.sha256,'SERVED_FILE_'+f.path);}}
async function restore(){await others();const own=await active(name);if(own!==m.previous_mobile){assert(own===report.version,'UNRELATED_VERSION_REFUSE_ROLLBACK');await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:m.previous_mobile,percentage:100}]})});}assert.equal(await active(name),m.previous_mobile);await verifyPublic(m.backup);report.status='ROLLED_BACK_VERIFIED';report.rollback_verified=true;save();}
try{
 if(mode==='prepare'){
  await others();assert.equal(await active(name),m.previous_mobile,'MOBILE_VERSION_DRIFT');assert.equal((await cf(name+'/versions/'+m.previous_mobile)).id,m.previous_mobile);
  const settings=await cf(name+'/settings');assert((settings.bindings||[]).every(b=>b.type==='assets'),'NON_ASSET_BINDING');await verifyPublic(m.backup);
  report.status='PREPARED';report.backup_files=m.backup.length;report.backup_verified=true;save();
 }else if(mode==='deploy'){
  assert.equal(report.status,'PREPARED');await others();assert.equal(await active(name),m.previous_mobile);await verifyPublic(m.backup);
  for(const f of m.site)assert.equal(hash(readFileSync(root+'/site/'+f.path)),f.sha256);
  report.status='DEPLOYING';save();
  try{execFileSync('npx',['--no-install','wrangler','deploy','--config',root+'/wrangler.json'],{encoding:'utf8',stdio:'pipe',timeout:180000});}catch{throw Error('WRANGLER_MOBILE_UPLOAD_FAILED');}
  report.version=await active(name);assert.notEqual(report.version,m.previous_mobile);save();await others();await verifyPublic(m.site);report.status='DEPLOYED_BROWSER_PENDING';save();
 }else if(mode==='verify'){
  assert.equal(await active(name),report.version);await others();await verifyPublic(m.site);report.status='DEPLOYED_TECHNICAL_ACCEPTANCE_PASS';report.phone_push='NOT_VERIFIED; legacy Push policy unchanged';save();
 }else await restore();
}catch(e){report.error=String(e.message).slice(0,240);report.status='FAIL';save();if(mode==='deploy'||mode==='verify'){try{if(!report.version&&await active(name)!==m.previous_mobile){await verifyPublic(m.site);report.version=await active(name);}await restore();}catch(re){report.rollback_error=String(re.message).slice(0,240);save();}}process.exitCode=1;}
console.log('HT_SESSION_RELEASE '+JSON.stringify(report));
