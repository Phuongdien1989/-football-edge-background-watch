import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build,root} from './build.mjs';
import {readPublicStatic} from '../ht-mechanism-recovery/public-read.mjs';
const action=process.argv[2],account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,sha=process.env.GITHUB_SHA;assert(account&&token&&sha);
const api='https://api.cloudflare.com/client/v4/accounts/'+account,mobile='shiny-silence-d892',backend='football-edge-background-watch',desktop='football-edge-desktop-b2-test',origin='https://'+mobile+'.ngophuonghuy.workers.dev',beforeMobile='0f029118-cf5b-456a-bffa-49902f4aa559',beforeBackend='fcf19574-3498-4ef3-9d08-d9fb575df365',beforeDesktop='a332ee39-abb2-422d-a021-db78ef19cc10';
mkdirSync(root,{recursive:true});const file=root+'/release.json';let report=existsSync(file)?JSON.parse(readFileSync(file)):{source:sha,provider_calls:0,production_db_writes:0,backend_modified:false,scanner_modified:false,push_calls:0,rollback:beforeMobile};const save=()=>writeFileSync(file,JSON.stringify(report,null,2));
async function cf(path,opt={}){const r=await fetch(api+path,{...opt,headers:{Authorization:'Bearer '+token,...opt.headers},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,JSON.stringify({path,status:r.status,errors:j.errors}));return j.result;}
async function active(n){const v=(await cf('/workers/scripts/'+n+'/deployments')).deployments[0].versions;assert.equal(v.length,1);assert.equal(v[0].percentage,100);return v[0].version_id;}
async function guards(m=beforeMobile){assert.equal(await active(mobile),m,'MOBILE_DRIFT');assert.equal(await active(backend),beforeBackend,'BACKEND_DRIFT');assert.equal(await active(desktop),beforeDesktop,'DESKTOP_DRIFT');}
async function setVersion(v){await cf('/workers/scripts/'+mobile+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:v,percentage:100}]})});}
async function publicVerify(rows){for(const f of rows){const path=f.path==='index.html'?'/':f.path.endsWith('/index.html')?'/'+f.path.slice(0,-10):'/'+f.path;let ok=false;for(let i=0;i<3;i++){const r=await readPublicStatic(origin+path);if(r.ok&&createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex')===f.sha256){ok=true;break;}}assert(ok,'PUBLIC_HASH_'+f.path);}}
async function health(){const r=await fetch('https://'+backend+'.ngophuonghuy.workers.dev/health');assert(r.ok);const h=await r.json();return {source:h.deploy_commit,scanner:h.peak_status?.enabled,control_updated:h.peak_status?.updated};}
function run(args){try{return execFileSync('npx',['--no-install','wrangler',...args],{encoding:'utf8',stdio:'pipe',timeout:180000,env:{...process.env,WRANGLER_SEND_METRICS:'false'}});}catch(e){throw Error('WRANGLER_FAILED_'+String(e.stderr||e.stdout).slice(-600));}}
try{
 if(action==='prepare'){await guards();assert.equal((await cf('/workers/scripts/'+mobile+'/versions/'+beforeMobile)).id,beforeMobile);report.before=await health();Object.assign(report,build());await publicVerify(report.backup);writeFileSync(root+'/wrangler.json',JSON.stringify({name:mobile,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}}));report.status='PREPARED';save();}
 else if(action==='deploy'){await guards();assert.equal(report.status,'PREPARED');run(['deploy','--dry-run','--config',root+'/wrangler.json']);const output=run(['versions','upload','--keep-vars','--config',root+'/wrangler.json','--tag','fe-pre-scan-'+sha.slice(0,12)]),id=output.match(/(?:Worker )?Version ID:\s*([0-9a-f-]{36})/i)?.[1];assert(id,'VERSION_ID_REQUIRED');report.version=id;save();await setVersion(id);report.status='DEPLOYED';save();}
 else if(action==='verify'){await guards(report.version);await publicVerify(report.candidate);report.after=await health();assert.equal(report.after.source,report.before.source);report.status='VERIFIED';save();}
 else if(action==='rollback'){if(report.version&&await active(mobile)===report.version){await setVersion(beforeMobile);await publicVerify(report.backup);report.status='ROLLED_BACK';save();}}
 else throw Error('UNKNOWN_ACTION');
}catch(e){report.error=String(e.message).slice(0,500);save();process.exitCode=1;}
console.log(JSON.stringify(report));
