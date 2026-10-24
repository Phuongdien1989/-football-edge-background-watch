import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
assert(a&&t,'CLOUDFLARE_AUTH_MISSING');
const name='shiny-silence-d892',base='https://'+name+'.ngophuonghuy.workers.dev',api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a)+'/workers/scripts/';
const rollback='ac8c0da2-551c-4561-a554-efd4c09339ad',originalHash='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28';
const expected={[name]:'eec395ab-328f-4be2-9da5-17611e7bade3','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'},hash=x=>createHash('sha256').update(x).digest('hex');
async function cf(path,options={}){const r=await fetch(api+path,{...options,headers:{Authorization:'Bearer '+t,...options.headers},signal:AbortSignal.timeout(30000)}),j=await r.json();assert(r.ok&&j.success,'CF_'+r.status+'_'+(j.errors||[]).map(x=>x.code).join(','));return j.result;}
async function active(n){const v=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT');return v[0].version_id;}
async function versions(){const out={};for(const n of Object.keys(expected))out[n]=await active(n);return out;}
async function resource(path){const r=await fetch(base+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'RESOURCE_'+r.status+'_'+path);return new Uint8Array(await r.arrayBuffer());}
async function setVersion(v){await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:v,percentage:100}]})});assert.equal(await active(name),v);}
async function checkHash(path,want){for(let i=0;i<8;i++){try{if(hash(await resource(path))===want)return true;}catch{}await new Promise(r=>setTimeout(r,1500));}return false;}
const resultPath='ft-overview/live-release-result.json';
if(process.argv[2]==='rollback'){
 if(!existsSync(resultPath)){console.log('NO_DEPLOYMENT_ATTEMPTED');process.exit(0);}const state=JSON.parse(readFileSync(resultPath));if(!state.deployed&&!state.version){console.log('NO_DEPLOYMENT_ATTEMPTED');process.exit(0);}
 const v=await active(name);assert(v===state.version||v===rollback,'UNRELATED_VERSION_REFUSE_ROLLBACK');await setVersion(rollback);state.rollback_verified=await checkHash('/',originalHash);state.deployed=false;writeFileSync(resultPath,JSON.stringify(state,null,2));assert(state.rollback_verified,'ROLLBACK_ROOT_NOT_VERIFIED');console.log('ORIGINAL_ROLLBACK_VERIFIED');process.exit(0);
}
const report={source_commit:process.env.GITHUB_SHA,mode:'MAIN_APP_TRIAL_RECOMMENDATIONS',rollback,deployed:false,provider_calls:0,scanner_toggled:false,backend_changed:false,production_root_changed:true};let attempted=false;
try{
 report.before=await versions();assert.deepEqual(report.before,expected,'PRODUCTION_DRIFT');await cf(name+'/versions/'+rollback);
 const original=readFileSync('ft-overview/frozen-original-mobile.html');assert.equal(hash(original),originalHash,'FROZEN_ORIGINAL_DRIFT');
 const site='ft-overview/live-site';mkdirSync(site+'/ft-overview-live',{recursive:true});mkdirSync(site+'/original',{recursive:true});mkdirSync(site+'/ft-overview',{recursive:true});
 writeFileSync(site+'/original/index.html',new TextDecoder().decode(original).replace('<head>','<head><base href="/">'));const hashes={};
 for(const path of ['/push-sw.js','/manifest.webmanifest']){const bytes=await resource(path);hashes[path]=hash(bytes);writeFileSync(site+path,bytes);}
 for(const path of ['/sw.js','/favicon.ico','/favicon.svg','/icons/icon-180.png','/icons/icon-192.png','/icons/icon-512.png']){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)}),type=r.headers.get('content-type')||'';if(r.ok&&(/image\//.test(type)||/javascript/.test(type))){const bytes=new Uint8Array(await r.arrayBuffer());mkdirSync(site+path.slice(0,path.lastIndexOf('/')),{recursive:true});writeFileSync(site+path,bytes);hashes[path]=hash(bytes);}}
 execFileSync(process.execPath,['ft-overview/build-integration.mjs','ft-overview/frozen-original-mobile.html'],{stdio:'inherit'});
 let candidate=readFileSync('ft-overview/build/index.html','utf8').replace('<head>','<head><base href="/">').replace(/<html\b/,'<html data-fo-trial="true"').replaceAll('./ft-overview/','/ft-overview/');writeFileSync(site+'/index.html',candidate);writeFileSync(site+'/ft-overview-live/index.html',candidate);
 for(const file of ['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css','experimental-decision.mjs','live-probability.mjs'])copyFileSync('ft-overview/'+file,site+'/ft-overview/'+file);
 writeFileSync('ft-overview/assets-release.json',JSON.stringify({name,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./live-site'}}));
 const args=['--yes','wrangler@4','deploy','--config','ft-overview/assets-release.json'];const dry=spawnSync('npx',[...args,'--dry-run'],{stdio:'inherit',timeout:120000});assert.equal(dry.status,0,'ASSET_DRY_RUN_FAILED');
 assert.deepEqual(await versions(),expected,'PRE_UPLOAD_DRIFT');attempted=true;const deploy=spawnSync('npx',args,{stdio:'inherit',timeout:180000});assert.equal(deploy.status,0,'ASSET_DEPLOY_FAILED');
 report.version=await active(name);assert.notEqual(report.version,rollback);assert(await checkHash('/',hash(candidate)),'MAIN_APP_NOT_SERVED');assert(await checkHash('/original/',hash(readFileSync(site+'/original/index.html'))),'ORIGINAL_FALLBACK_NOT_SERVED');
 assert(await checkHash('/ft-overview-live/',hash(candidate)),'OPT_IN_PAGE_NOT_SERVED');
 for(const [path,want]of Object.entries(hashes))assert(await checkHash(path,want),'ORIGINAL_STATIC_CHANGED_'+path);
 report.after=await versions();for(const n of Object.keys(expected).filter(n=>n!==name))assert.equal(report.after[n],expected[n],'UNRELATED_VERSION_CHANGED');
 report.status='PASS';report.deployed=true;report.original_html_sha256=originalHash;report.main_html_sha256=hash(candidate);report.trial_recommendations_enabled=true;report.experimental_policy='FT_OVERVIEW_TRIAL_EV_V1';report.static_resources_preserved=Object.keys(hashes);report.url=base+'/#ftOverviewCard';report.original_view_url=base+'/original/';report.roll_back_version_exists=true;
}catch(e){report.error=String(e.message).slice(0,240);process.exitCode=1;if(attempted){try{report.version=report.version||await active(name);await setVersion(rollback);report.rollback_verified=await checkHash('/',originalHash);}catch(e){report.rollback_error=String(e.message).slice(0,120);}}}
finally{writeFileSync(resultPath,JSON.stringify(report,null,2));console.log('FT_OVERVIEW_LIVE_RELEASE '+JSON.stringify(report));}
