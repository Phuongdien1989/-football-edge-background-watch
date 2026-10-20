// Publishes only the separately tagged, zero-binding UI mockup. No production writes.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert(account&&token,'AUTH_MISSING');
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/',headers={Authorization:'Bearer '+token};
const expected={'shiny-silence-d892':'b73642ec-1d4c-41ae-bc28-68c785b6fd79','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
async function call(path,opts={}){const r=await fetch(api+path,{...opts,headers:{...headers,...opts.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CF_'+r.status);return j.result;}
async function versions(){const out={};for(const name of Object.keys(expected)){const v=(await call(name+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT');out[name]=v[0].version_id;}assert.deepEqual(out,expected,'PRODUCTION_DRIFT');return out;}
const before=await versions(),name='football-edge-tabs-preview',tag='fe-ui-tabs-demo-only-20261020';
const existing=await fetch(api+name+'/settings',{headers,signal:AbortSignal.timeout(25000)});
if(existing.status!==404){const j=await existing.json();assert(existing.ok&&j.success&&j.result.tags?.includes(tag)&&(j.result.bindings||[]).length===0,'REFUSE_NON_PREVIEW_TARGET');}
const files=Object.fromEntries(['index.html','style.css','app.mjs'].map(f=>['/'+f,readFileSync('ui-tabs-preview/'+f,'utf8')]));
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const code=`const files=${JSON.stringify(files)};export default {fetch(request){const u=new URL(request.url),p=u.pathname==='/'?'/index.html':u.pathname;if(!(p in files))return new Response('Not found',{status:404});return new Response(files[p],{headers:{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':${JSON.stringify(csp)},'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}};`;
const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'preview.mjs',compatibility_date:'2026-10-01',bindings:[],tags:[tag]})],{type:'application/json'}));form.append('preview.mjs',new Blob([code],{type:'application/javascript+module'}),'preview.mjs');
await call(name,{method:'PUT',body:form});await call(name+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
const settings=await call(name+'/settings');assert.equal(settings.bindings.length,0);assert(settings.tags.includes(tag));
const v=(await call(name+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100);
const report={status:'PASS',source_commit:process.env.GITHUB_SHA,url:'https://'+name+'.ngophuonghuy.workers.dev/',version:v[0].version_id,bindings:0,production_before:before,production_after:await versions(),production_deployed:false,provider_calls:0,d1_queries:0,scanner_toggled:false,demo_only:true};writeFileSync('ui-tabs-preview/release-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
