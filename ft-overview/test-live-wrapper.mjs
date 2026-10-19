import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {liveWrapper} from './live-wrapper.mjs';
let calls=0;const context={original:{fetch:r=>{calls++;return new Response('original:'+new URL(r.url).pathname,{status:202,headers:{'X-Original':'yes'}});}},URL,Response,Object};
const source=liveWrapper({'index.html':'candidate','ft-overview/ui.mjs':'export default 1'},'original.mjs').replace(/^import original[^;]+;/,'').replace('\nexport default','\nglobalThis.handler=');
runInNewContext(source,context);
for(const path of ['/','/push-sw.js','/manifest.webmanifest','/ft-overview/not-owned.mjs']){const r=await context.handler.fetch(new Request('https://example.com'+path),{},{});assert.equal(r.status,202);assert.equal(r.headers.get('x-original'),'yes');}
assert.equal(calls,4);
const r=await context.handler.fetch(new Request('https://example.com/ft-overview-live?x=1'),{},{});assert.equal(await r.text(),'candidate');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(calls,4);
const redirect=await context.handler.fetch(new Request('https://example.com/ft-overview-live/?x=1'),{},{});assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'https://example.com/ft-overview-live?x=1');
const asset=await context.handler.fetch(new Request('https://example.com/ft-overview/ui.mjs'),{},{});assert.equal(await asset.text(),'export default 1');assert.equal(calls,4);
assert.throws(()=>liveWrapper({},'bad\".mjs'));
const rootSource=liveWrapper({'original_index.html':'exact original'},'original.mjs').replace(/^import original[^;]+;/,'').replace('\nexport default','\nglobalThis.handler=');const rootContext={original:context.original,URL,Response,Object};runInNewContext(rootSource,rootContext);const oldRoot=await rootContext.handler.fetch(new Request('https://example.com/'),{},{});assert.equal(await oldRoot.text(),'exact original');assert.equal(calls,4);
console.log(JSON.stringify({status:'PASS',legacy_routes_preserved:true,opt_in_only:true,provider_calls:0}));
