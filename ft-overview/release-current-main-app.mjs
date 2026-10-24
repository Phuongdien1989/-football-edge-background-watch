// Controlled same-app Mobile FT V2 release. Current production version pinned and preserved.
// No backend, D1, scanner, provider, cron, Push or Desktop modifications.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {REQUIRED_MOBILE_ASSETS} from '../ft-audit-fix/mobile-asset-isolation.mjs';
import {injectFTV2IntoCurrentShell} from './current-shell-injection.mjs';
import {patchMechanismTabs} from './patch-mechanism-tabs.mjs';
const name='shiny-silence-d892',base='https://'+name+'.ngophuonghuy.workers.dev';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const pin='510ef35e-b23e-4729-b0fe-e2e75f3b319f';
const pinHtml='24e012d6c3ca3c21b32982a5b37f0adb9827c16d7354c3d5657d63f546e2b0ae';
const sha=x=>createHash('sha256').update(x).digest('hex');
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const result={schema:'FT_V2_SAME_APP_RELEASE_V1',source_commit:process.env.GITHUB_SHA,
 status:'NOT_STARTED',production_deployed:false,backend_changed:false,scanner_toggled:false,d1_queries:0,provider_calls:0,rollback_version:pin};
const out='ft-overview/current-main-app-package',site=out+'/site';let attempted=false;
async function cf(path,options={}){const r=await fetch(api+path,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CF_ERROR_'+path+'_'+r.status);return j.result;}
async function active(n){const d=await cf(n+'/deployments'),v=d.deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT_'+n);return v[0].version_id;}
async function get(path){const route=path==='/'?'/':path.endsWith('/index.html')?'/'+path.slice(1,-10):path;let last;for(let k=0;k<3;k++){try{const r=await fetch(base+route,{headers:{'Cache-Control':'no-cache'},redirect:'follow',signal:AbortSignal.timeout(25000)});assert.equal(r.status,200,'MISSING_LIVE_ASSET_'+path+'_'+r.status);const bytes=Buffer.from(await r.arrayBuffer());assert(bytes.length>0&&bytes.length<4000000,'INVALID_LIVE_ASSET_'+path);return bytes;}catch(e){last=e;if(k<2)await new Promise(resolve=>setTimeout(resolve,700*(k+1)));}}throw Error('ASSET_FETCH_EXHAUSTED_'+path+'_'+String(last.message).slice(0,90));}
function save(path,bytes){mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
async function verifyPublished(path,expected,{tries=14,delay=2500}={}){
 for(let attempt=0;attempt<tries;attempt++){
  try{
   const url=base+path+(path.includes('?')?'&':'?')+'fe_ft_v2_release_verify='+Date.now()+'_'+attempt;
   const r=await fetch(url,{headers:{'Cache-Control':'no-cache, no-store'},cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(r.ok&&sha(Buffer.from(await r.arrayBuffer()))===expected)return true;
  }catch{}
  if(attempt<tries-1)await new Promise(resolve=>setTimeout(resolve,delay));
 }
 return false;
}
async function rollback(){
 await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:pin,percentage:100}]})});
 assert.equal(await active(name),pin,'ROLLBACK_NOT_ACTIVE');
}
async function run(){
 assert(token&&account,'CLOUDFLARE_AUTH_MISSING');
 assert(process.env.FT_V2_SAME_APP_RELEASE==='APPROVED_20261024','OWNER_RELEASE_GATE_NOT_SET');
 const others=['football-edge-background-watch','football-edge-desktop-b2-test'];
 const before={mobile:await active(name),backend:await active(others[0]),desktop:await active(others[1])};
 result.before=before;assert.equal(before.mobile,pin,'CURRENT_MOBILE_VERSION_DRIFT');
 const htmlBytes=await get('/'),html=htmlBytes.toString('utf8');
 assert.equal(sha(htmlBytes),pinHtml,'CURRENT_HTML_HASH_DRIFT');
 const injection=injectFTV2IntoCurrentShell(html);result.injection={addedBytes:injection.addedBytes,changedElements:injection.changedElements,originalBytes:injection.originalBytes};
 const existing=new Set(REQUIRED_MOBILE_ASSETS);
 // Additional paths referenced in current shell are preserved when identifiable as public static assets.
 for(const match of html.matchAll(/(?:src|href)=["']\/?((?:ft-overview|ui-tabs|ht-candidate|icons)\/[^"'?#\s]+)["']/g)){
  if(!match[1].startsWith('http'))existing.add(match[1]);
 }
 existing.add('sw.js');existing.add('favicon.ico');
 const retained={};
 for(const file of [...existing].sort()){
  try{const raw=await get('/'+file);save(site+'/'+file,raw);retained[file]=sha(raw);}
  catch(e){
   if(file==='sw.js'||file==='favicon.ico'){continue;}
   throw e;
  }
 }
 assert(REQUIRED_MOBILE_ASSETS.every(x=>retained[x]),'INCOMPLETE_PROTECTED_ASSET_SET');
 const tabsCode=readFileSync(site+'/ui-tabs/integrated.mjs','utf8');
 assert(tabsCode.includes("['ftv2','FT AI V2']")&&tabsCode.includes('fe-ft-v2-tab-open'),'SIX_TAB_PRODUCTION_NOT_PRESENT');
 result.tabs_preserved=true;
 const mechanics=patchMechanismTabs(tabsCode);
 save(site+'/ui-tabs/integrated.mjs',mechanics.code);
 result.mechanism_tab_anchors=mechanics.anchors;
 save(site+'/index.html',injection.html);
 const modules=['core.mjs','adapter.mjs','experimental-decision.mjs','live-probability.mjs','light-signal-pro-view.mjs','light-signal-pro.css','light-signal-mechanisms.mjs'];
 for(const file of modules)save(site+'/ft-ai-v2/'+file,readFileSync('ft-overview/'+file));
 save(site+'/ft-ai-v2/integrated.mjs',readFileSync('ft-overview/ft-ai-v2-integrated.mjs'));
 result.preserved_count=Object.keys(retained).length;
 result.ht_preserved=REQUIRED_MOBILE_ASSETS.filter(x=>x.startsWith('ht-candidate/')).length===10;
 result.mobile_root_changed_only_by_ft_v2=true;
 result.changed_static_assets=['ui-tabs/integrated.mjs','ft-ai-v2/light-signal-pro.css'];
 const config={name,compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}};
 save(out+'/wrangler.json',JSON.stringify(config));
 const command=['--yes','wrangler@4','deploy','--config',out+'/wrangler.json'];
 const dry=spawnSync('npx',[...command,'--dry-run'],{stdio:'inherit',timeout:150000});
 assert.equal(dry.status,0,'WRANGLER_DRY_RUN_FAILED');
 assert.equal(await active(name),pin,'MOBILE_DRIFT_AFTER_PACKAGING');
 assert.equal(await active(others[0]),before.backend,'BACKEND_DRIFT_BEFORE_RELEASE');
 assert.equal(await active(others[1]),before.desktop,'DESKTOP_DRIFT_BEFORE_RELEASE');
 result.status='READY_FOR_UPLOAD';
 // Fail closed on incomplete asset knowledge: require a signed, exhaustive asset manifest from
 // the deployed Workers version before upload. Public-URL discovery alone is not exhaustive.
 if(result.preserved_count!==28||process.env.FT_V2_COMPLETE_MANIFEST_VERIFIED!=='RECOVERY_28_VERIFIED_20261023'){
  result.status='BLOCKED_INCOMPLETE_ASSET_MANIFEST';
  return;
 }
 attempted=true;const deployed=spawnSync('npx',command,{stdio:'inherit',timeout:180000});
 assert.equal(deployed.status,0,'WRANGLER_DEPLOY_FAILED');
 result.version=await active(name);
 assert.notEqual(result.version,pin,'VERSION_NOT_CHANGED');
 assert(await verifyPublished('/',sha(Buffer.from(injection.html))),'LIVE_HTML_MISMATCH_AFTER_RETRIES');
 assert(await verifyPublished('/ft-ai-v2/integrated.mjs',sha(readFileSync('ft-overview/ft-ai-v2-integrated.mjs'))),'V2_ASSET_NOT_SERVED_AFTER_RETRIES');
 assert(await verifyPublished('/ui-tabs/integrated.mjs',sha(Buffer.from(mechanics.code))),'MECHANISM_TABS_NOT_SERVED');
 assert(await verifyPublished('/ft-ai-v2/light-signal-pro.css',sha(readFileSync('ft-overview/light-signal-pro.css'))),'LIGHT_SIGNAL_CSS_NOT_SERVED');
 assert(await verifyPublished('/ft-ai-v2/light-signal-pro-view.mjs',sha(readFileSync('ft-overview/light-signal-pro-view.mjs'))),'LIGHT_SIGNAL_VIEW_NOT_SERVED');
 assert(await verifyPublished('/ft-ai-v2/light-signal-mechanisms.mjs',sha(readFileSync('ft-overview/light-signal-mechanisms.mjs'))),'LIGHT_SIGNAL_MECHANISMS_NOT_SERVED');
 for(const file of Object.keys(retained).filter(x=>!['index.html','ui-tabs/integrated.mjs'].includes(x)))assert.equal(sha(await get('/'+file)),retained[file],'PROTECTED_ASSET_CHANGED_'+file);
 assert.equal(await active(others[0]),before.backend,'BACKEND_CHANGED');
 assert.equal(await active(others[1]),before.desktop,'DESKTOP_CHANGED');
 result.status='DEPLOYED_ACCEPTANCE_PASS';result.production_deployed=true;
}
try{await run();}catch(e){result.status='FAILED';result.error=String(e.message||e).slice(0,190);process.exitCode=1;
 if(attempted){try{const now=await active(name);assert(now===pin||now===result.version||now!==result.before?.mobile&&result.before?.mobile===pin,'UNRELATED_MOBILE_VERSION');await rollback();result.rolled_back=true;result.production_deployed=false;}catch(err){result.rollback_error=String(err.message).slice(0,120);}}
}finally{mkdirSync(out,{recursive:true});writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log('FT_V2_SAME_APP_RELEASE '+JSON.stringify(result));}
