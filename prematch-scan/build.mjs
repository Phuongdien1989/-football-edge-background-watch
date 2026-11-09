import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const root='prematch-scan/generated';
export function hashes(dir){const rows=[];function walk(p,rel=''){for(const f of readdirSync(p,{withFileTypes:true})){if(f.isDirectory())walk(p+'/'+f.name,rel+f.name+'/');else rows.push({path:rel+f.name,sha256:createHash('sha256').update(readFileSync(p+'/'+f.name)).digest('hex')});}}walk(dir);return rows;}
export function build(){mkdirSync(root,{recursive:true});const previous='prematch-scan/previous/site',backup=hashes(previous),manifest=JSON.parse(readFileSync('prematch-scan/previous/release.json'));assert.equal(backup.length,70);assert.deepEqual(backup,manifest.candidate);cpSync(previous,root+'/backup',{recursive:true});cpSync(previous,root+'/site',{recursive:true});
 const site=root+'/site';
 const entries={
 'prematch-ai/decision.mjs':'prematch-ai/decision.mjs',
 'prematch-ai/decision-ledger.mjs':'prematch-ai/decision-ledger.mjs',
 'prematch-ai/view.final-v1.mjs':'prematch-ai/view.mjs',
 'prematch-ai/view.final-v1.css':'prematch-ai/view.css',
 'prematch-ai/runtime.final-v1.mjs':'prematch-ai/runtime.mjs',
 'prematch-ai/worker.final-v1.mjs':'prematch-ai/worker.mjs',
 'prematch-release/production.final-v1.mjs':'prematch-release/production.mjs'};
 for(const [target,source]of Object.entries(entries)){let content=readFileSync(source,'utf8');if(target.includes('worker.final-v1'))content=content.replace("'./runtime.mjs'","'./runtime.final-v1.mjs'");if(target.includes('production.final-v1'))content=content.replace("../prematch-ai/view.mjs","../prematch-ai/view.final-v1.mjs").replace("../prematch-ai/worker.mjs","../prematch-ai/worker.final-v1.mjs");writeFileSync(site+'/'+target,content);}
 let html=readFileSync(site+'/index.html','utf8');const marker='// FE_OVERVIEW_INPUT_BRIDGE_END';assert.equal(html.split(marker).length,2);const start=html.indexOf(marker)+marker.length,end=html.indexOf('  // PREMATCH_V1_READ_ONLY_CACHE_BRIDGE',start);assert(end>start);html=html.slice(0,start)+'\n'+readFileSync('prematch-scan/bridge.txt','utf8')+'\n'+html.slice(end);html=html.replace('/prematch-ai/view.css','/prematch-ai/view.final-v1.css').replace('/prematch-release/production.mjs','/prematch-release/production.final-v1.mjs');writeFileSync(site+'/index.html',html);
 const candidate=hashes(site),changed=backup.filter(x=>candidate.find(y=>y.path===x.path)?.sha256!==x.sha256).map(x=>x.path).sort();assert.deepEqual(changed,['index.html']);assert.equal(candidate.length,77);return {backup,candidate,changed};}
if(process.argv[1]?.endsWith('/build.mjs')){const r=build();writeFileSync(root+'/manifest.json',JSON.stringify(r,null,2));console.log(JSON.stringify({status:'BUILT',assets:r.candidate.length,changed:r.changed,unchangedOriginalMechanisms:true}));}
