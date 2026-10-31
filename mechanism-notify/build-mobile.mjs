import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {patchMobile,patchFTAdapter,patchFTSelection} from './patch-mobile.mjs';
import {assertAssetClosure} from '../ht-mechanism-recovery/asset-graph.mjs';
const dir='mechanism-mobile',prior='previous-mobile',hash=b=>createHash('sha256').update(b).digest('hex');
const m=JSON.parse(readFileSync(prior+'/manifest.json')),d=JSON.parse(readFileSync(prior+'/deployment.json'));
assert.equal(d.version,'c9b86303-7031-4068-a4fe-808de4a0093a');assert.equal(m.candidate.length,54);
for(const f of m.candidate){assert(!f.path.includes('..'));assert.equal(hash(readFileSync(prior+'/site/'+f.path)),f.sha256);}
mkdirSync(dir,{recursive:true});cpSync(prior+'/site',dir+'/backup',{recursive:true});cpSync(prior+'/site',dir+'/site',{recursive:true});
const patch=(p,fn)=>writeFileSync(dir+'/site/'+p,fn(readFileSync(dir+'/site/'+p,'utf8')));
patch('index.html',patchMobile);for(const p of ['ft-overview/adapter.mjs','ft-ai-v2/adapter.mjs'])patch(p,patchFTAdapter);patch('ft-ai-v2/integrated.mjs',patchFTSelection);
const candidate=m.candidate.map(f=>({...f,sha256:hash(readFileSync(dir+'/site/'+f.path))}));
const changed=candidate.filter(f=>m.candidate.find(b=>b.path===f.path).sha256!==f.sha256).map(f=>f.path);
assert.deepEqual(changed,['ft-ai-v2/adapter.mjs','ft-ai-v2/integrated.mjs','ft-overview/adapter.mjs','index.html']);
const html=readFileSync(dir+'/site/index.html','utf8');let parsed=0;
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc\s*=|type\s*=\s*["'](?:module|application\/)/i.test(match[1])||!match[2].trim())continue;new vm.Script(match[2]);parsed++;}
assert(parsed>1);assertAssetClosure(dir+'/site');
for(const p of ['ht-candidate/model.mjs','ht-candidate/valuation.mjs','ft-ai-v2/core.mjs','ft-ai-v2/live-probability.mjs','hc-model/core.mjs','hc-model/valuation.mjs','push-sw.js','ui-tabs/scan-runtime.mjs'])assert.equal(hash(readFileSync(dir+'/site/'+p)),hash(readFileSync(dir+'/backup/'+p)),'MODEL_OR_SCANNER_DRIFT_'+p);
writeFileSync(dir+'/manifest.json',JSON.stringify({source_commit:process.env.GITHUB_SHA||'LOCAL',before_version:d.version,backup:m.candidate,candidate,changed,unchanged:50,classicScriptsParsed:parsed},null,2));
writeFileSync(dir+'/wrangler.json',JSON.stringify({name:'shiny-silence-d892',compatibility_date:'2026-10-01',keep_vars:true,assets:{directory:'./site'}},null,2));
for(const name of ['test-browser.cjs','test-controls.cjs']){
 let s=readFileSync('overview-scan-release/'+name,'utf8').replaceAll('overview-scan-package','mechanism-mobile');
 if(name==='test-browser.cjs')s=s.replace("await ft.locator('[data-mechanism=ftv2]').screenshot",`await page.evaluate(()=>{location.hash='#fe-tabs/ftv2/910002';});
    await page.waitForSelector('[data-ft-v2-select="910002"][data-active="true"]',{timeout:3000});
    await page.evaluate(()=>{location.hash='#fe-tabs/ftv2/910001';});
    await page.waitForSelector('[data-ft-v2-select="910001"][data-active="true"]',{timeout:3000});
    await ft.locator('[data-mechanism=ftv2]').screenshot`);
 writeFileSync(dir+'/'+name,s);
}
console.log(JSON.stringify({status:'PASS',changed,unchanged:50,classicScriptsParsed:parsed}));
