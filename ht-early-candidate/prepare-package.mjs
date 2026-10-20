import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const out='ht-early-candidate/generated/package',mobile=out+'/site',backend=out+'/backend',baseline=process.argv[2]||'ht-prod-baseline';
const manifest=JSON.parse(readFileSync('audits/2026-10-20/ui-tabs-mobile-release-manifest.json'));
const hash=x=>createHash('sha256').update(x).digest('hex');
function save(p,x){mkdirSync(dirname(p),{recursive:true});writeFileSync(p,x);}
mkdirSync(out,{recursive:true});
for(const entry of manifest.files) {
 const url='https://shiny-silence-d892.ngophuonghuy.workers.dev/'+entry.path;
 const r=await fetch(url,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(30000)});
 assert(r.ok,'BASELINE_ASSET_HTTP_'+entry.path);
 const bytes=new Uint8Array(await r.arrayBuffer());assert.equal(hash(bytes),entry.sha256,'BASELINE_ASSET_DRIFT_'+entry.path);
 save(out+'/backup/mobile/'+entry.path,bytes);save(mobile+'/'+entry.path,bytes);
}
let html=readFileSync('ht-early-candidate/generated/index.html','utf8');
html=html.replace('</head>','<link rel="stylesheet" href="/ht-candidate/style.css"></head>').replace('</body>','<script type="module" src="/ht-candidate/ui.mjs"></script></body>');
save(mobile+'/index.html',html);
for(const name of ['model.mjs','context.mjs','assess-item.mjs','valuation.mjs','valuation-adapter.mjs','ui.mjs','style.css','demo.mjs','demo.html'])save(mobile+'/ht-candidate/'+name,readFileSync('ht-early-candidate/'+name));
save(out+'/preview/index.html',readFileSync('ht-early-candidate/demo.html'));
for(const name of ['model.mjs','assess-item.mjs','valuation.mjs','valuation-adapter.mjs','ui.mjs','style.css','demo.mjs'])save(out+'/preview/ht-candidate/'+name,readFileSync('ht-early-candidate/'+name));
save(out+'/preview/ft-overview/core.mjs',readFileSync('ft-overview/core.mjs'));
for(const name of readdirSync(baseline).filter(n=>/\.(?:js|mjs|sql)$/.test(n)||n==='wrangler.toml')) {
 const bytes=readFileSync(baseline+'/'+name);save(out+'/backup/backend/'+name,bytes);save(backend+'/'+name,bytes);
}
const blob=x=>createHash('sha1').update('blob '+Buffer.byteLength(x)+'\0').update(x).digest('hex');
assert.equal(blob(readFileSync(backend+'/notify-core-h1.js')),'c3e364aaee870468bc6b2d0f63ccdc833ba06cdd');
assert.equal(blob(readFileSync(backend+'/worker_notify_v130.js')),'013e7b05d394a9d4544cfe2d9d8cbec5817e6e93');
for(const name of ['notify-core-h1.js','worker_notify_v130.js']) {
 const original=readFileSync('ht-early-candidate/generated/backend/'+name,'utf8');
 const normalized=original.replaceAll("from '../../../","from './").replaceAll("from '../../","from './ht-early-candidate/");
 save(backend+'/'+name,normalized);
}
for(const name of ['temporal.mjs','collection.mjs','history.mjs','model.mjs','context.mjs','assess-item.mjs','valuation.mjs','valuation-adapter.mjs'])save(backend+'/ht-early-candidate/'+name,readFileSync('ht-early-candidate/'+name));
save(backend+'/ft-overview/core.mjs',readFileSync('ft-overview/core.mjs'));
// The new valuation folder is one level below backend; preserve its existing ../ft-overview imports.
for(const name of ['build-report.json','test-report.json','collection-test-report.json','valuation-test-report.json','model-test-report.json','history-test-report.json'])save(out+'/evidence/'+name,readFileSync('ht-early-candidate/generated/'+name));
save(out+'/README.md',readFileSync('ht-early-candidate/README.md'));
const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name]);
const files=walk(out).map(p=>({path:p.slice(out.length+1),sha256:hash(readFileSync(p)),bytes:readFileSync(p).length}));
const report={status:'PASS',source_commit:process.env.GITHUB_SHA,candidate_only:true,production_deployed:false,backend_source_baseline:'da5242bb41b2401271f52dda17b0e2208e7e3819',mobile_source_baseline:'723ae37eac825ef1fe8285c8395826b09eba35c5',backup_is_source_and_assets_not_database:true,files};
save(out+'/manifest.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:'PASS',files:files.length,production_deployed:false}));
