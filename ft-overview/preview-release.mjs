// Only creates a new, isolated demo Worker; existing production scripts are GET-only.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('CLOUDFLARE_AUTH_MISSING');
const root=`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/`,headers={Authorization:`Bearer ${token}`};
const expected={
 'football-edge-background-watch':'04cc044d-412f-4844-9b83-c7c786eedd13',
 'shiny-silence-d892':'03c1d55d-358a-448b-96f3-f356704831df',
 'football-edge-desktop-b2-test':'a332ee39-abb2-422d-a021-db78ef19cc10'
};
async function readVersions(){const out={};for(const [name,version]of Object.entries(expected)){
 const r=await fetch(root+name+'/deployments',{headers,signal:AbortSignal.timeout(20000)}),j=await r.json(),v=j.result?.deployments?.[0]?.versions;
 if(!r.ok||!j.success||v?.length!==1||v[0].version_id!==version||v[0].percentage!==100)throw Error('PRODUCTION_DRIFT_'+name);out[name]=v[0].version_id;
}return out;}
const before=await readVersions();
const name='football-edge-ft-overview-preview';
const exists=await fetch(root+name+'/settings',{headers,signal:AbortSignal.timeout(20000)});
if(exists.status!==404){
 const existing=await exists.json();
 if(!exists.ok||!existing.success||!existing.result?.tags?.includes('ft-overview-demo-only-20261019')||(existing.result.bindings||[]).length)throw Error('PREVIEW_TARGET_NOT_OWNED_ISOLATED_DEMO_'+exists.status);
}
const files={};for(const p of ['index.html','style.css','core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs'])files['/'+p]=readFileSync('ft-overview/'+p,'utf8');
for(const p of ['replay.html','replay-ui.mjs','replay-data.mjs'])files['/'+p]=readFileSync('ft-overview/'+p,'utf8');
// Render the actual pinned original app at a separate, read-only layout route.
const original=await fetch('https://shiny-silence-d892.ngophuonghuy.workers.dev/',{signal:AbortSignal.timeout(30000)});
if(!original.ok)throw Error('ORIGINAL_HTML_UNAVAILABLE');writeFileSync('/tmp/fo-preview-original.html',await original.text());
execFileSync(process.execPath,['ft-overview/build-integration.mjs','/tmp/fo-preview-original.html'],{stdio:'inherit'});
let integrated=readFileSync('ft-overview/build/index.html','utf8');
integrated=integrated.replace(/(<body[^>]*>)/,'$1<div class="fo-preview-banner">GIAO DIỆN THỬ • API / QUÉT / PUSH KHÓA<a href="/">Xem mẫu dữ liệu</a></div>');
files['/app/index.html']=integrated;
for(const p of ['style.css','core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs'])files['/app/ft-overview/'+p]=files['/'+p];
const module=`const files=${JSON.stringify(files)};export default {async fetch(request){const u=new URL(request.url);const p=u.pathname==='/'?'/index.html':u.pathname==='/app/'||u.pathname==='/app'?'/app/index.html':u.pathname;if(!(p in files))return new Response('Not found',{status:404});const integrated=p.startsWith('/app/');return new Response(files[p],{headers:{'Content-Type':p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self' "+(integrated?"'unsafe-inline' ":"")+"; style-src 'self' 'unsafe-inline'; connect-src 'none'; worker-src 'none'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}};`;
const form=new FormData();form.append('metadata',new Blob([JSON.stringify({main_module:'preview.mjs',compatibility_date:'2026-09-11',bindings:[],tags:['ft-overview-demo-only-20261019']})],{type:'application/json'}));form.append('preview.mjs',new Blob([module],{type:'application/javascript+module'}),'preview.mjs');
const r=await fetch(root+name,{method:'PUT',headers,body:form,signal:AbortSignal.timeout(60000)}),j=await r.json();if(!r.ok||!j.success)throw Error('PREVIEW_UPLOAD_FAILED_'+r.status);
const sub=await fetch(root+name+'/subdomain',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({enabled:true,previews_enabled:false}),signal:AbortSignal.timeout(20000)});if(!sub.ok)throw Error('PREVIEW_SUBDOMAIN_FAILED_'+sub.status);
const after=await readVersions();
const active=await fetch(root+name+'/deployments',{headers,signal:AbortSignal.timeout(20000)}),activeJSON=await active.json();
if(!active.ok||!activeJSON.success)throw Error('PREVIEW_ACTIVE_VERSION_NOT_VERIFIED');
const report={status:'PASS',script:name,url:'https://'+name+'.ngophuonghuy.workers.dev/',integrated_layout_url:'https://'+name+'.ngophuonghuy.workers.dev/app/#ftOverviewCard',demo_only:true,integrated_layout_read_only:true,bindings:0,provider_calls:0,production_before:before,production_after:after,version:activeJSON.result?.deployments?.[0]?.versions?.[0]?.version_id||null,source_commit:process.env.GITHUB_SHA||null};
writeFileSync('ft-overview/preview-release-result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
