import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {liveWrapper} from './live-wrapper.mjs';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN;
assert(a&&t,'CLOUDFLARE_AUTH_MISSING');
const root='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a)+'/workers/scripts/',name='shiny-silence-d892',publicRoot='https://'+name+'.ngophuonghuy.workers.dev';
const rollback='03c1d55d-358a-448b-96f3-f356704831df',expected={'shiny-silence-d892':rollback,'football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
const headers={Authorization:'Bearer '+t},hash=x=>createHash('sha256').update(x).digest('hex');
const report={source_commit:process.env.GITHUB_SHA,mode:'OPT_IN_SAME_ORIGIN_SHADOW',rollback,production_root_changed:false,backend_changed:false,scanner_toggled:false,provider_calls:0,deployed:false};let attempted=false;
async function cf(path,options={}){const r=await fetch(root+path,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CF_OPERATION_FAILED_'+r.status);return j.result;}
async function active(n){const v=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT');return v[0].version_id;}
async function versions(){const out={};for(const n of Object.keys(expected))out[n]=await active(n);return out;}
async function bytes(path){const r=await fetch(publicRoot+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert(r.ok,'PUBLIC_RESOURCE_READ_FAILED_'+r.status+'_'+path);return new Uint8Array(await r.arrayBuffer());}
if(process.argv[2]==='rollback'){
 if(!existsSync('ft-overview/live-release-result.json')){console.log('NO_RELEASE_TO_ROLL_BACK');process.exit(0);}
 const state=JSON.parse(readFileSync('ft-overview/live-release-result.json'));if(!state.deployed){console.log('NO_SUCCESSFUL_RELEASE_TO_ROLL_BACK');process.exit(0);}
 assert.equal(await active(name),state.version,'REFUSE_ROLLBACK_UNRELATED_VERSION');
 await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:rollback,percentage:100}]})});assert.equal(await active(name),rollback);assert.equal(hash(await bytes('/')),'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28');state.rollback_verified=true;state.deployed=false;writeFileSync('ft-overview/live-release-result.json',JSON.stringify(state,null,2));console.log('BROWSER_FAILURE_ROLLBACK_VERIFIED');process.exit(0);
}
try{
 report.before=await versions();assert.deepEqual(report.before,expected,'PRODUCTION_DRIFT');await cf(name+'/versions/'+rollback);
 const settings=await cf(name+'/settings');assert((settings.bindings||[]).every(b=>['assets','plain_text','secret_text'].includes(b.type)),'UNSUPPORTED_MOBILE_BINDING');
 const content=await fetch(root+name+'/content/v2',{headers,signal:AbortSignal.timeout(30000)});assert(content.ok,'ORIGINAL_MODULE_READ_FAILED');
 const modules=[];let entry=content.headers.get('cf-entrypoint');
 if((content.headers.get('content-type')||'').includes('multipart/')){
  for(const [key,value]of await content.formData()){if(key==='metadata'){const meta=JSON.parse(typeof value==='string'?value:await value.text());entry=entry||meta.main_module;continue;}assert(typeof value!=='string','UNEXPECTED_MODULE_PART');modules.push({name:value.name||key,type:value.type||'application/javascript+module',bytes:new Uint8Array(await value.arrayBuffer())});}
 }else{entry=entry||'original.mjs';modules.push({name:entry,type:'application/javascript+module',bytes:new Uint8Array(await content.arrayBuffer())});}
 if(!entry&&modules.length===1)entry=modules[0].name;
 assert(entry&&modules.some(m=>m.name===entry),'ORIGINAL_ENTRYPOINT_UNKNOWN');
 const main=modules.find(m=>m.name===entry),code=new TextDecoder().decode(main.bytes),assetBindings=(settings.bindings||[]).filter(b=>b.type==='assets');
 report.original_shape={content_type:content.headers.get('content-type'),entry,bytes:main.bytes.length,module_names:modules.map(m=>m.name),asset_bindings:assetBindings.map(b=>b.name),default_export:/export\s*(?:default|\{[^}]*default)/.test(code),classic_fetch:/addEventListener\s*\(\s*['"]fetch/.test(code),json_keys:(()=>{try{return Object.keys(JSON.parse(code));}catch{return null;}})()};
 if(!report.original_shape.default_export){
  const stripped=code.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'').trim();
  assert(stripped===''&&assetBindings.length<=1,'UNSUPPORTED_ORIGINAL_HANDLER_SHAPE');
  if(!assetBindings.length)assetBindings.push({type:'assets',name:'FE_OVERVIEW_ORIGINAL_ASSETS'});
  main.bytes=new TextEncoder().encode('export default {fetch(request,env){return env['+JSON.stringify(assetBindings[0].name)+'].fetch(request)}};');
  main.type='application/javascript+module';report.original_shape.assets_only_adapter=true;
 }
 report.original_modules=modules.map(m=>({name:m.name,sha256:hash(m.bytes)}));
 const original=await bytes('/');assert.equal(hash(original),'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28','ORIGINAL_HTML_DRIFT');
 const staticHashes={};for(const path of ['/push-sw.js','/manifest.webmanifest'])staticHashes[path]=hash(await bytes(path));
 for(const path of ['/icons/icon-180.png','/icons/icon-192.png']){const r=await fetch(publicRoot+path,{signal:AbortSignal.timeout(15000)});if(r.ok&&(r.headers.get('content-type')||'').startsWith('image/'))staticHashes[path]=hash(new Uint8Array(await r.arrayBuffer()));}
 mkdirSync('ft-overview/release',{recursive:true});writeFileSync('ft-overview/release/original.html',original);
 execFileSync(process.execPath,['ft-overview/build-integration.mjs','ft-overview/release/original.html'],{stdio:'inherit'});
 const files={'index.html':readFileSync('ft-overview/build/index.html','utf8'),'original_index.html':new TextDecoder().decode(original)};
 for(const p of ['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css'])files['ft-overview/'+p]=readFileSync('ft-overview/'+p,'utf8');
 // Absolute addon paths also support trailing-slash use without a redirect.
 files['index.html']=files['index.html'].replaceAll('./ft-overview/','/ft-overview/');
 const worker=liveWrapper(files,entry),form=new FormData();
 const config={...(settings.assets?.config||{})};const oldFirst=config.run_worker_first;config.run_worker_first=oldFirst===true?true:[...new Set([...(Array.isArray(oldFirst)?oldFirst:[]),'/','/index.html','/ft-overview-live','/ft-overview-live/','/ft-overview/*'])];
 const metadata={main_module:'fe-overview-entry.mjs',compatibility_date:settings.compatibility_date||'2026-10-01',compatibility_flags:settings.compatibility_flags||[],keep_assets:true,assets:{config},keep_bindings:['plain_text','secret_text'],bindings:assetBindings.map(b=>({name:b.name,type:'assets'})),tags:settings.tags||[]};
 form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 for(const m of modules)form.append(m.name,new Blob([m.bytes],{type:m.type}),m.name);
 form.append('fe-overview-entry.mjs',new Blob([worker],{type:'application/javascript+module'}),'fe-overview-entry.mjs');
 assert.deepEqual(await versions(),expected,'PRE_UPLOAD_DRIFT');attempted=true;
 await cf(name,{method:'PUT',body:form});report.version=await active(name);assert.notEqual(report.version,rollback);
 assert.equal(hash(await bytes('/')),hash(original),'ORIGINAL_ROOT_CHANGED');
 for(const [path,h]of Object.entries(staticHashes))assert.equal(hash(await bytes(path)),h,'STATIC_RESOURCE_CHANGED_'+path);
 assert.equal(hash(await bytes('/ft-overview-live')),hash(files['index.html']),'OPT_IN_HTML_NOT_SERVED');
 for(const p of Object.keys(files).filter(p=>p.startsWith('ft-overview/')))assert.equal(hash(await bytes('/'+p)),hash(files[p]),'ADDON_RESOURCE_MISMATCH');
 report.after=await versions();for(const n of Object.keys(expected).filter(n=>n!==name))assert.equal(report.after[n],expected[n],'UNRELATED_VERSION_CHANGED');
 report.deployed=true;report.url=publicRoot+'/ft-overview-live#ftOverviewCard';report.status='PASS';
}catch(e){report.error=String(e.message).slice(0,200);process.exitCode=1;
 if(attempted){try{await cf(name+'/deployments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:rollback,percentage:100}]})});assert.equal(await active(name),rollback);assert.equal(hash(await bytes('/')),'aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28');report.rollback_verified=true;}catch{report.rollback_verified=false;}}
}finally{writeFileSync('ft-overview/live-release-result.json',JSON.stringify(report,null,2));console.log('FT_OVERVIEW_LIVE_RELEASE '+JSON.stringify(report));}
