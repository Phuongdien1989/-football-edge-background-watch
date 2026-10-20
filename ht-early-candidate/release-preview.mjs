// Publishes a labelled demo only, never the Mobile or backend production Worker.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
assert(token&&account,'CONFIGURED_CLOUDFLARE_AUTH_REQUIRED');
const prefix='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const name='football-edge-ht-candidate',tag='fe-ht-candidate-demo-20261021';
const expected={'shiny-silence-d892':'3c0e47ed-275b-410c-b527-77f1ff65a28a','football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13','football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'};
async function cf(path,opts={}){const r=await fetch(prefix+path,{...opts,headers:{Authorization:'Bearer '+token,...opts.headers},signal:AbortSignal.timeout(30000)});const j=await r.json();assert(r.ok&&j.success,'CLOUDFLARE_'+r.status);return j.result;}
async function active(){const out={};for(const n of Object.keys(expected)){const v=(await cf(n+'/deployments')).deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'PRODUCTION_SPLIT');out[n]=v[0].version_id;}return out;}
const before=await active();assert.deepEqual(before,expected,'PRODUCTION_BASELINE_DRIFT_REVIEW_REQUIRED');
const existing=await fetch(prefix+name+'/settings',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
if(existing.status!==404){const j=await existing.json();assert(existing.ok&&j.success&&j.result.tags?.includes(tag)&&(j.result.bindings||[]).length===0,'REFUSE_NON_CANDIDATE_TARGET');}
const root='ht-release/package/preview',files={};
function walk(dir){for(const d of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+d.name;if(d.isDirectory())walk(p);else files[p.slice(root.length)]=readFileSync(p,'utf8');}}
walk(root);
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const code='const files='+JSON.stringify(files)+';export default{fetch(req){const p=new URL(req.url).pathname,key=p==="/" ? "/index.html":p;if(!["GET","HEAD"].includes(req.method)||!(key in files))return new Response("Not found",{status:404});return new Response(req.method==="HEAD"?null:files[key],{headers:{"Content-Type":key.endsWith(".html")?"text/html; charset=utf-8":key.endsWith(".css")?"text/css; charset=utf-8":"text/javascript; charset=utf-8","Content-Security-Policy":'+JSON.stringify(csp)+',"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}})}}';
const form=new FormData();
form.append('metadata',new Blob([JSON.stringify({main_module:'preview.mjs',compatibility_date:'2026-10-01',bindings:[],tags:[tag]})],{type:'application/json'}));
form.append('preview.mjs',new Blob([code],{type:'application/javascript+module'}),'preview.mjs');
await cf(name,{method:'PUT',body:form});
await cf(name+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false})});
const settings=await cf(name+'/settings');assert.equal(settings.bindings.length,0);assert(settings.tags.includes(tag));
const after=await active();assert.deepEqual(after,before,'PRODUCTION_CHANGED_DURING_PREVIEW_PUBLICATION');
const versions=(await cf(name+'/deployments')).deployments?.[0]?.versions;
const url='https://'+name+'.ngophuonghuy.workers.dev/';
const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert(response.ok);assert((await response.text()).includes('DỮ LIỆU GIẢ LẬP'));
const report={status:'PASS',source_commit:process.env.GITHUB_SHA,url,preview_version:versions?.[0]?.version_id,production_before:before,production_after:after,production_deployed:false,preview_bindings:0,demo_only:true,real_provider_calls:0,d1_queries:0,scanner_toggled:false};
writeFileSync('ht-release/preview-deployment.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
