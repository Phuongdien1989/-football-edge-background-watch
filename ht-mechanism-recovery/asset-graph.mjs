import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';

// Full deployed Mobile bundle, including the HT pricing module graph.
// Publishing an assets directory replaces its contents: an omitted file is removed.
export const preservedMobileAssets=Object.freeze([
 'index.html','original/index.html','ft-overview-live/index.html','push-sw.js','manifest.webmanifest','favicon.svg',
 'icons/icon-180.png','icons/icon-192.png','icons/icon-512.png',
 'ft-overview/core.mjs','ft-overview/adapter.mjs','ft-overview/charts.mjs','ft-overview/demo.mjs','ft-overview/ui.mjs','ft-overview/style.css',
 'ui-tabs/integrated.css','ui-tabs/integrated.mjs','ui-tabs/read-model.mjs',
 'ht-candidate/assess-item.mjs','ht-candidate/context.mjs','ht-candidate/demo.html','ht-candidate/demo.mjs',
 'ht-candidate/model.mjs','ht-candidate/recommendation-session.mjs','ht-candidate/style.css','ht-candidate/ui.mjs',
 'ht-candidate/valuation-adapter.mjs','ht-candidate/valuation.mjs'
]);

export function assertStaticContent(path,type,body){
 if(/\.(?:m?js)$/.test(path))assert(/javascript|ecmascript/.test(type),'ASSET_MIME_'+path);
 if(path.endsWith('.css'))assert(type.includes('text/css'),'ASSET_MIME_'+path);
 if(/\.(?:m?js|css)$/.test(path))assert(!/^\s*(?:<!doctype|<html)/i.test(Buffer.from(body).toString('utf8')),'ASSET_HTML_FALLBACK_'+path);
}

export function assertAssetClosure(directory){
 const base=resolve(directory),seen=new Set(),queue=[...preservedMobileAssets];
 while(queue.length){
  const path=queue.shift();if(seen.has(path))continue;seen.add(path);
  const local=resolve(base,path);assert(!relative(base,local).startsWith('..'),'ASSET_PATH_ESCAPE');
  assert(existsSync(local),'ASSET_MISSING_'+path);
  if(!/\.(?:mjs|js|css|html|webmanifest)$/.test(path))continue;
  const source=readFileSync(local,'utf8'),refs=[];
  // Preserved /original/ and /ft-overview-live/ HTML copies have old relative
  // manifest links. Audit active entrypoints; preserve archived bytes unchanged.
  if(path==='index.html'||path==='ht-candidate/demo.html'){
   for(const m of source.matchAll(/<(script|link)\b[^>]*>/gi)){
    const tag=m[0];if(m[1].toLowerCase()==='link'&&!/\brel\s*=\s*['"](?:stylesheet|manifest|icon|apple-touch-icon)['"]/i.test(tag))continue;
    const ref=tag.match(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/i);if(ref)refs.push(ref[1]);
   }
  }
  if(/\.(?:m?js)$/.test(path))for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g))refs.push(m[1]);
  if(path.endsWith('.css'))for(const m of source.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))refs.push(m[1]);
  if(path.endsWith('.webmanifest'))for(const icon of JSON.parse(source).icons||[])refs.push(icon.src);
  for(const ref of refs){
   if(/^(?:https?:|data:|blob:|#|\/\/)/i.test(ref)||ref.includes('${'))continue;
   // Bare JS package imports are resolved by build tools, not served as assets.
   if(/\.(?:m?js)$/.test(path)&&!ref.startsWith('.')&&!ref.startsWith('/'))continue;
   const url=new URL(ref,'https://assets.invalid/'+path);
   assert(url.origin==='https://assets.invalid','ASSET_ORIGIN');queue.push(decodeURIComponent(url.pathname).slice(1));
  }
 }
 return {files:seen.size,paths:[...seen].sort()};
}
