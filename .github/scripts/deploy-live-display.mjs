import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {patchLiveDisplay,marker} from './live-display-patch.mjs';
import {parse} from 'acorn';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
const name='shiny-silence-d892',url='https://shiny-silence-d892.ngophuonghuy.workers.dev/';
const expected='157af7294df17b997f505a6fa0a4658699c8236808a643e29ca2d71bd1b8b392';
const report={commit:process.env.CANDIDATE_SHA,worker:name,backendDeploy:false,checks:{},deployed:false};
const hash=x=>createHash('sha256').update(x).digest('hex');
const apiURL='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+name;
async function cf(path='',options={}){
 const r=await fetch(apiURL+path,{...options,headers:{authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('CF_HTTP_'+r.status+':'+path);return r;
}
async function json(path,options={}){const b=await (await cf(path,options)).json();if(b.success===false)throw Error('CF_ERROR:'+path);return b.result;}
let oldVersion,deployed=false;
try{
 if(!token||!account)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
 const live=await fetch(url,{signal:AbortSignal.timeout(20000)}).then(r=>{if(!r.ok)throw Error('FRONTEND_FETCH_FAILED');return r.text()});
 report.baselineHash=hash(live);if(report.baselineHash!==expected)throw Error('FRONTEND_BASELINE_CHANGED');
 report.candidateHash=hash(patchLiveDisplay(live));report.checks.patchAnchors='PASS';
 const deployments=await json('/deployments');const versions=deployments.deployments?.[0]?.versions;
 if(versions?.length!==1||versions[0].percentage!==100)throw Error('FRONTEND_ACTIVE_VERSION_AMBIGUOUS');
 oldVersion=versions[0].version_id;report.rollbackVersion=oldVersion;
 const originalVersion=await json('/versions/'+oldVersion);report.checks.rollback='PASS_VERSION_EXISTS';
 const settings=await json('/settings');
 if((settings.bindings||[]).some(b=>b.type==='durable_object_namespace'&&!b.script_name))throw Error('FRONTEND_LOCAL_DO_EXPORT_UNSUPPORTED');
 const response=await cf('/content/v2');const type=response.headers.get('content-type')||'';let main=response.headers.get('cf-entrypoint'),parts=[];
 const raw=await response.arrayBuffer();
 if(type.includes('multipart/form-data')){
  const form=await new Response(raw,{headers:{'content-type':type}}).formData();
  for(const [key,v]of form){if(typeof v==='string')throw Error('UNEXPECTED_SOURCE_METADATA');parts.push({name:v.name||key,type:v.type||'application/javascript+module',body:await v.arrayBuffer()});}
 }else if(type.includes('multipart/mixed')){
  // Multipart mixed uses the same form-data disposition; preserve every module byte.
  const form=await new Response(raw,{headers:{'content-type':type.replace('multipart/mixed','multipart/form-data')}}).formData();
  for(const [key,v]of form){if(typeof v==='string')throw Error('UNEXPECTED_SOURCE_METADATA');parts.push({name:v.name||key,type:v.type||'application/javascript+module',body:await v.arrayBuffer()});}
 }else{parts=[{name:main||'worker.js',type,body:raw}];}
 if(!main&&parts.length===1)main=parts[0].name;
 if(!main||!parts.some(p=>p.name===main))throw Error('FRONTEND_ENTRYPOINT_NOT_IDENTIFIED');
 const source=new TextDecoder().decode(parts.find(p=>p.name===main).body);
 const isModule=/export\s*\{[^}]*default|export\s+default/.test(source);
 const assetsOnly=source.trim()==='';
 report.originalHandlers=originalVersion.resources?.script?.handlers||[];
 report.assetConfigurationPresent=!!(settings.assets||originalVersion.resources?.assets||originalVersion.assets);
 if(assetsOnly&&report.originalHandlers.includes('fetch'))throw Error('EMPTY_SOURCE_WITH_EXISTING_FETCH_HANDLER');
 if(parts.some(p=>['fe-live-wrapper.mjs','fe-live-display-patch.mjs'].includes(p.name)))throw Error('FRONTEND_WRAPPER_ALREADY_PRESENT');
 report.modules=parts.map(p=>({name:p.name,bytes:p.body.byteLength}));report.entrypoint=main;
 writeFileSync('frontend-source-backup.bin',new Uint8Array(raw));
 writeFileSync('frontend-source-backup-metadata.json',JSON.stringify({contentType:type,entrypoint:main,rollbackVersion:oldVersion,baselineHash:expected},null,2));
 const patch=await import('node:fs').then(fs=>fs.readFileSync(new URL('./live-display-patch.mjs',import.meta.url)));
 const wrapper=`import original from ${JSON.stringify('./'+main)};
import {patchLiveDisplay,marker} from './fe-live-display-patch.mjs';
export default {...original,async fetch(request,env,ctx){
 const response=await original.fetch(request,env,ctx);
 if(request.method!=='GET'||!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
 const html=await response.clone().text();
 // Exact baseline only; non-app HTML endpoints are left byte-for-byte intact.
 if(!html.includes('FE_LEGACY_NOTIFY_SYNC_START')||html.includes(marker))return response;
 const body=patchLiveDisplay(html),headers=new Headers(response.headers);
 headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
 headers.set('cache-control','no-store');headers.set('x-fe-live-display',marker);
 return new Response(body,{status:response.status,statusText:response.statusText,headers});
}};`;
 const bindings=(settings.bindings||[]).filter(b=>b.type!=='secret_text');
 const metadata={compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags||[],bindings,keep_bindings:['secret_text']};
 if(assetsOnly){
  metadata.main_module='fe-live-wrapper.mjs';metadata.keep_assets=true;
  metadata.assets={config:{...(settings.assets?.config||originalVersion.resources?.assets?.config||{}),run_worker_first:['/','/index.html']}};
  if(bindings.some(b=>b.name==='FE_ORIGINAL_ASSETS'))throw Error('ASSET_BINDING_NAME_CONFLICT');
  bindings.push({type:'assets',name:'FE_ORIGINAL_ASSETS'});
  const html=JSON.stringify(patchLiveDisplay(live));
  const script=`const html=${html};export default {fetch(request,env){const u=new URL(request.url);if(['/','/index.html'].includes(u.pathname)&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-fe-live-display':${JSON.stringify(marker)}}});return env.FE_ORIGINAL_ASSETS.fetch(request);}};`;
  parse(script,{ecmaVersion:'latest',sourceType:'module'});
  parts=[{name:'fe-live-wrapper.mjs',type:'application/javascript+module',body:new TextEncoder().encode(script)}];
  report.checks.originalFetchHandler='PASS_ASSETS_ONLY_NO_HANDLER';report.checks.assetPreservation='KEEP_EXISTING_ASSETS_ROOT_HTML_ONLY';
 }else if(isModule)metadata.main_module='fe-live-wrapper.mjs';
 else{
  if(parts.length!==1)throw Error('LEGACY_FRONTEND_MULTIPLE_PARTS_UNSUPPORTED');
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script'}),calls=[],literals=[];
  function walk(node,parent){if(!node||typeof node!=='object')return;
   let value;
   if(node.type==='Literal'&&typeof node.value==='string')value=node.value;
   if(node.type==='TemplateLiteral'&&!node.expressions.length&&parent?.type!=='TaggedTemplateExpression')value=node.quasis[0].value.cooked;
   if(node.type==='TaggedTemplateExpression'&&node.tag?.type==='MemberExpression'&&node.tag.object.name==='String'&&node.tag.property.name==='raw'&&!node.quasi.expressions.length)value=node.quasi.quasis[0].value.raw;
   if(typeof value==='string'&&value.length>100000&&hash(value)===expected)literals.push(node);
   if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='respondWith'){
    if(node.arguments.length!==1)throw Error('FETCH_RESPOND_WITH_SHAPE_UNSUPPORTED');calls.push(node.arguments[0]);
   }
   for(const value of Object.values(node))if(Array.isArray(value))value.forEach(n=>walk(n,node));else if(value&&typeof value==='object')walk(value,node);
  }walk(ast);
  if(literals.length!==1&&calls.length!==1)throw Error('LEGACY_FETCH_HANDLER_AMBIGUOUS');
  const arg=calls[0];
  const transform=String(patch).replace(/export (const|function) /g,'$1 ');
  const helper=`\nasync function __feLiveDisplayResponse(input){
   ${transform}
   const response=await input;
   if(!response.ok||!(response.headers.get('content-type')||'').includes('text/html'))return response;
   const html=await response.clone().text();
   if(!html.includes('FE_LEGACY_NOTIFY_SYNC_START')||html.includes(marker))return response;
   const body=patchLiveDisplay(html),headers=new Headers(response.headers);
   headers.delete('content-length');headers.delete('content-encoding');headers.delete('etag');
   headers.set('cache-control','no-store');headers.set('x-fe-live-display',marker);
   return new Response(body,{status:response.status,statusText:response.statusText,headers});
  }\n`;
  const updated=literals.length===1?source.slice(0,literals[0].start)+JSON.stringify(patchLiveDisplay(live))+source.slice(literals[0].end)
    :source.slice(0,arg.start)+'__feLiveDisplayResponse('+source.slice(arg.start,arg.end)+')'+source.slice(arg.end)+helper;
  parse(updated,{ecmaVersion:'latest',sourceType:'script'});
  parts[0].body=new TextEncoder().encode(updated);parts[0].type='application/javascript';metadata.body_part=parts[0].name;
  report.checks.originalFetchHandler=literals.length===1?'PASS_EXACT_HTML_LITERAL_ONLY':'PASS_AST_SINGLE_ARGUMENT_WRAPPER';
 }
 for(const key of ['usage_model','limits','placement','tail_consumers','logpush','observability'])if(settings[key]!=null)metadata[key]=settings[key];
 const current=await json('/deployments');if(current.deployments?.[0]?.versions?.[0]?.version_id!==oldVersion)throw Error('FRONTEND_CHANGED_BEFORE_UPLOAD');
 const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
 for(const p of parts)form.append(p.name,new Blob([p.body],{type:p.type||'application/javascript+module'}),p.name);
 if(isModule){form.append('fe-live-wrapper.mjs',new Blob([wrapper],{type:'application/javascript+module'}),'fe-live-wrapper.mjs');
 form.append('fe-live-display-patch.mjs',new Blob([patch],{type:'application/javascript+module'}),'fe-live-display-patch.mjs');}
 deployed=true;await json('',{method:'PUT',body:form});
 const after=await json('/deployments');report.productionVersion=after.deployments?.[0]?.versions?.[0]?.version_id;
 if(!report.productionVersion||report.productionVersion===oldVersion)throw Error('NEW_FRONTEND_VERSION_NOT_CONFIRMED');
 let verified=false;
 for(let i=0;i<12;i++){const r=await fetch(url+'?fe_verify='+Date.now(),{signal:AbortSignal.timeout(15000)});const html=await r.text();if(r.ok&&hash(html)===report.candidateHash&&html.includes(marker)){verified=true;break;}await new Promise(resolve=>setTimeout(resolve,5000));}
 if(!verified)throw Error('FRONTEND_PUBLIC_HASH_VERIFICATION_FAILED');
 report.checks.publicHTML='PASS_EXACT_PATCHED_HASH';report.deployed=true;
}catch(e){report.error=e.message;process.exitCode=1;
 if(deployed&&oldVersion){try{await json('/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:[{version_id:oldVersion,percentage:100}]})});report.restoredVersion=oldVersion;}catch(e){report.rollbackError=e.message;}}
}finally{writeFileSync('frontend-live-display-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
