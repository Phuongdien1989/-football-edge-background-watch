import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
assert(a&&t,'AUTH_MISSING');
const root='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a)+'/workers/scripts/';
const expected={'shiny-silence-d892':'b73642ec-1d4c-41ae-bc28-68c785b6fd79','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
const out='ui-tabs-freeze';mkdirSync(out+'/mobile/ft-overview',{recursive:true});mkdirSync(out+'/source',{recursive:true});
const report={at:new Date().toISOString(),source_commit:process.env.GITHUB_SHA,mode:'READ_ONLY_UI_FREEZE',deployed:false,provider_calls:0,d1_queries:0,scanner_toggled:false,files:[]};
const hash=b=>createHash('sha256').update(b).digest('hex');
async function cf(p){const r=await fetch(api+p,{headers:{Authorization:'Bearer '+t},signal:AbortSignal.timeout(25000)});const j=await r.json();assert(r.ok&&j.success,'CF_READ_FAILED_'+r.status);return j.result;}
async function versions(){const v={};for(const n of Object.keys(expected)){const ds=await cf(n+'/deployments');const x=ds.deployments?.[0]?.versions;assert(x?.length===1&&x[0].percentage===100,'SPLIT_'+n);v[n]=x[0].version_id;}return v;}
try{
report.before=await versions();assert.deepEqual(report.before,expected,'PRODUCTION_DRIFT');
for(const id of ['b73642ec-1d4c-41ae-bc28-68c785b6fd79','ac8c0da2-551c-4561-a554-efd4c09339ad'])await cf('shiny-silence-d892/versions/'+id);
report.rollback_versions_exist=true;report.rollback_exercised=false;
for(const p of ['/','/original/','/ft-overview-live/','/push-sw.js','/manifest.webmanifest',...['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css'].map(f=>'/ft-overview/'+f)]){
const r=await fetch(root+p,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'STATIC_'+r.status+'_'+p);const b=new Uint8Array(await r.arrayBuffer());
const dest=p==='/'?'index.html':p.endsWith('/')?p.slice(1)+'index.html':p.slice(1);
mkdirSync(out+'/mobile/'+dest.slice(0,Math.max(0,dest.lastIndexOf('/'))),{recursive:true});writeFileSync(out+'/mobile/'+dest,b);report.files.push({path:dest,bytes:b.length,sha256:hash(b)});
}
assert.equal(report.files.find(x=>x.path==='index.html').sha256,'9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e','ACTIVE_HTML_DRIFT');
for(const file of ['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css'])assert.equal(hash(readFileSync(out+'/mobile/ft-overview/'+file)),hash(readFileSync('ft-overview/'+file)),'MODULE_DRIFT_'+file);
cpSync('ft-overview',out+'/source/ft-overview',{recursive:true,filter:p=>!/(live-site|build|qa|node_modules)/.test(p)});
cpSync('audits/2026-10-20/UI_TABS_HANDOVER.md',out+'/HANDOVER.md');
writeFileSync(out+'/RESTORE.md','# Frontend recovery\nCurrent frozen version: b73642ec-1d4c-41ae-bc28-68c785b6fd79. Prefer selecting this existing version for rollback after future UI releases. Before doing so verify active version and authorization.\nThe mobile folder contains static assets; restore with an explicitly reviewed assets-only Wrangler configuration for shiny-silence-d892, preserving runtime configuration. Do not execute old live-release.mjs: its drift guards and rollback target refer to an earlier release.\nNo secrets or database backup included. Do not deploy this package to backend Worker. Push service worker is preserved only for original origin; preview must block service worker registration and all network.\n');
report.after=await versions();assert.deepEqual(report.after,report.before,'VERSION_CHANGED_DURING_CAPTURE');report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e.message).slice(0,250);process.exitCode=1;}
finally{writeFileSync(out+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
