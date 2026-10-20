import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
// Preview-only builder. Never deploy this sandbox boot/QA hook to production.
const original=process.argv[2]||'ft-overview/frozen-original-mobile.html';
execFileSync(process.execPath,['ft-overview/build-integration.mjs',original],{stdio:'inherit'});
let base=readFileSync('ft-overview/build/index.html','utf8').replace('<head>','<head><base href="/">').replaceAll('./ft-overview/','/ft-overview/').replace(/<html\b/,'<html data-fo-trial="true"');
assert.equal(createHash('sha256').update(base).digest('hex'),'9c557b2b20744aaad5b14ddd367517bd4afb00a7af182ead93e346f857f9947e','CURRENT_MOBILE_HTML_DRIFT');
const boot=`<script id="fe-tabs-sandbox-boot">
window.__FETabsSandbox={fetchAttempts:0,intervals:new Set()};
window.fetch=()=>{window.__FETabsSandbox.fetchAttempts++;return Promise.reject(Error('PREVIEW_NETWORK_DISABLED'));};
const feTabsNativeInterval=window.setInterval.bind(window),feTabsNativeClear=window.clearInterval.bind(window);
window.setInterval=(...args)=>{const id=feTabsNativeInterval(...args);window.__FETabsSandbox.intervals.add(id);return id;};
window.clearInterval=id=>{window.__FETabsSandbox.intervals.delete(id);return feTabsNativeClear(id);};
</script>`;
const banner='<div id="feTabsSandboxLabel">BẢN GHÉP THỬ · API / QUÉT / PUSH KHÓA · KHÔNG NHẬP API KEY</div>';
const panel='<section id="feTabsWorkspace" aria-label="Football Edge mechanism tabs"><nav class="ftabs-nav" role="tablist" aria-label="Cơ chế phân tích"></nav><div class="ftabs-content"></div><div class="ftabs-actions"><button type="button" data-ftabs-tools>Hiện công cụ gốc</button><button type="button" data-ftabs-legacy>Về bố cục cũ</button></div></section>';
const css='<link rel="stylesheet" href="/ui-tabs/integrated.css">',module='<script type="module" src="/ui-tabs/integrated.mjs"></script>';
const anchor='  // FE_OVERVIEW_INPUT_BRIDGE_END';assert.equal(base.split(anchor).length,2);
const qa=`
  // Only a local, labelled browser QA state hook on the isolated preview hostname.
  if(window.__FETabsSandbox&&['football-edge-tabs-preview.ngophuonghuy.workers.dev','127.0.0.1','localhost'].includes(location.hostname)&&new URLSearchParams(location.search).get('qa')==='1'){
   window.__FETabsQA=Object.freeze({seed:p=>{FE_LEGACY_SYNC.state='IDLE';FE_LEGACY_SYNC.error='';watchState.items=feUICopy(p.ft||[]);h1WatchState.items=feUICopy(p.ht||[]);handicapWatchState.pool=feUICopy(p.hc||[]);window.dispatchEvent(new Event('fe-notify-sync-updated'));},raw:()=>feUICopy({ft:watchState.items,ht:h1WatchState.items,hc:handicapWatchState.pool,active:[watchState.active,h1WatchState.active,handicapWatchState.active]})});
  }
`;
let html=base.replace('<head>','<head>'+boot).replace('<body>','<body>'+banner).replace('<section class="fe-p1-command"',panel+'<section class="fe-p1-command"').replace('</head>',css+'</head>').replace('</body>',module+'</body>').replace(anchor,anchor+qa);
const restored=html.replace(boot,'').replace(banner,'').replace(panel,'').replace(css,'').replace(module,'').replace(qa,'');
assert.equal(restored,base,'NON_ADDITIVE_INTEGRATION');assert.equal(html.split('id="feTabsWorkspace"').length,2);
mkdirSync('ui-tabs-preview/generated',{recursive:true});writeFileSync('ui-tabs-preview/generated/integrated.html',html);
const report={status:'PASS',additive_reconstruction:true,baseline_sha256:createHash('sha256').update(base).digest('hex'),candidate_sha256:createHash('sha256').update(html).digest('hex'),production_deployed:false,sandbox_network_lock:true,qa_hook:'preview hostname + qa=1 only'};
writeFileSync('ui-tabs-preview/generated/integration-build.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
