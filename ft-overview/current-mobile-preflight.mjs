// Read-only current production Mobile acceptance baseline; never prints tokens or HTML.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
assert(token&&account,'MISSING_CLOUDFLARE_READ_CREDENTIALS');
const origin='https://shiny-silence-d892.ngophuonghuy.workers.dev';
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers/scripts/';
const names=['shiny-silence-d892','football-edge-background-watch','football-edge-desktop-b2-test'];
async function active(name){
 const r=await fetch(api+name+'/deployments',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(25000)});
 assert(r.ok,'CF_DEPLOYMENT_HTTP_'+r.status);
 const j=await r.json();assert(j.success,'CF_DEPLOYMENT_READ_FAILED');
 const v=j.result?.deployments?.[0]?.versions;assert(v?.length===1&&v[0].percentage===100,'SPLIT_DEPLOYMENT_'+name);
 return v[0].version_id;
}
async function publicAsset(path,html=false){
 const r=await fetch(origin+path,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000),redirect:'error'});
 assert.equal(r.status,200,'MOBILE_ASSET_HTTP_'+path+'_'+r.status);
 const data=Buffer.from(await r.arrayBuffer());
 assert(data.length>0&&data.length<4000000,'INVALID_BYTES_'+path);
 if(html)assert((r.headers.get('content-type')||'').includes('text/html'),'INVALID_HTML_TYPE');
 return {sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,content:html?data.toString('utf8'):null};
}
const report={schema:'FT_V2_CURRENT_MOBILE_PREFLIGHT_V1',checked_at:new Date().toISOString(),mode:'GET_ONLY',production_changed:false,scanner_changed:false,d1_queries:0,provider_calls:0,status:'UNKNOWN'};
try{
 report.versions={};for(const name of names)report.versions[name]=await active(name);
 const root=await publicAsset('/',true);report.root_sha256=root.sha256;report.root_bytes=root.bytes;
 report.markers={ft_overview:root.content.includes('ftOverviewCard'),
 ui_tabs:root.content.includes('ui-tabs/integrated'),
 ht_valuation:root.content.includes('ht-candidate/valuation'),
 ft_v2_review:root.content.includes('FT V2 · QUYẾT ĐỊNH')||root.content.includes('FT V2'),
 detached_v2_card:root.content.includes('id="ftAIV2Card"'),
 ft_v2_module:root.content.includes('/ft-ai-v2/integrated.mjs'),
 light_signal_pro:root.content.includes('/ft-ai-v2/light-signal-pro.css'),
 tab_workspace:root.content.includes('feTabsWorkspace')};
 const paths=['/ft-overview/core.mjs','/ft-overview/ui.mjs','/ft-overview/adapter.mjs',
 '/ui-tabs/integrated.mjs','/ht-candidate/valuation.mjs','/push-sw.js','/manifest.webmanifest'];
 report.required_assets={};
 for(const path of paths){try{const a=await publicAsset(path);report.required_assets[path]={status:'PRESENT',sha256:a.sha256,bytes:a.bytes};}
 catch(e){report.required_assets[path]={status:'MISSING_OR_ERROR',reason:String(e.message).slice(0,100)};}}
 const present=Object.values(report.required_assets).every(x=>x.status==='PRESENT');
 report.status=present?'BASELINE_CAPTURED':'RELEASE_BLOCKED_MISSING_CURRENT_ASSET';
 report.release_authorized_by_preflight=false;
 report.note='A current-version/hash inventory is not a complete Cloudflare assets manifest; do not deploy old pinned-release scripts.';
}catch(e){report.status='PREFLIGHT_ERROR';report.error=String(e.message||e).slice(0,170);process.exitCode=1;}
console.log('FT_V2_MOBILE_PREFLIGHT '+JSON.stringify(report));
