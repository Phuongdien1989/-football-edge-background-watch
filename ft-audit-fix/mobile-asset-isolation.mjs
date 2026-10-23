import assert from 'node:assert/strict';

// Source: 2026-10-23 verified HT assets recovery bundle. A Workers asset
// deployment REPLACES the full directory, so preserving only the old 18
// resources silently deletes all 10 HT pricing modules.
export const REQUIRED_MOBILE_ASSETS=Object.freeze([
 'index.html','original/index.html','ft-overview-live/index.html','push-sw.js','manifest.webmanifest','favicon.svg',
 'icons/icon-180.png','icons/icon-192.png','icons/icon-512.png',
 'ft-overview/core.mjs','ft-overview/adapter.mjs','ft-overview/charts.mjs','ft-overview/demo.mjs','ft-overview/ui.mjs','ft-overview/style.css',
 'ui-tabs/integrated.css','ui-tabs/integrated.mjs','ui-tabs/read-model.mjs',
 'ht-candidate/assess-item.mjs','ht-candidate/context.mjs','ht-candidate/demo.html','ht-candidate/demo.mjs',
 'ht-candidate/model.mjs','ht-candidate/recommendation-session.mjs','ht-candidate/style.css','ht-candidate/ui.mjs',
 'ht-candidate/valuation-adapter.mjs','ht-candidate/valuation.mjs'
]);
const set=new Set(REQUIRED_MOBILE_ASSETS);
assert.equal(REQUIRED_MOBILE_ASSETS.length,28);
assert.equal(set.size,28);

export function assertFullMobileAssetInventory(items,{requireHashes=false}={}){
 assert(Array.isArray(items),'MOBILE_ASSET_INVENTORY_MISSING');
 const paths=items.map(x=>typeof x==='string'?x:x?.path);
 assert(paths.every(p=>typeof p==='string'&&p&&!p.includes('..')&&!p.startsWith('/')),'INVALID_MOBILE_ASSET_PATH');
 assert.equal(new Set(paths).size,paths.length,'DUPLICATE_MOBILE_ASSET');
 const present=new Set(paths),missing=REQUIRED_MOBILE_ASSETS.filter(p=>!present.has(p));
 assert.deepEqual(missing,[],'HT_OR_SHARED_ASSET_OMITTED_'+missing.join(','));
 if(requireHashes)for(const f of items){
  assert(f&&typeof f==='object'&&/^[a-f0-9]{64}$/.test(f.sha256),'INVALID_MOBILE_ASSET_HASH_'+String(f?.path));
 }
 return {status:'FULL_28_PRESERVED',required:28,ht_assets:10,asset_count:paths.length};
}

// The FT model itself must not silently alter HT pricing, UI-tabs, SW,
// icons, archived HTML, or unrelated static assets. The main HTML shell
// requires a separately explicit user-approved release; it is NOT authorized
// by passing an FT model test. New FT namespaces are separately appendable.
export function assertFTMobileAssetIsolation(before,after,{allowIndexShell=false}={}){
 assertFullMobileAssetInventory(before,{requireHashes:true});
 assertFullMobileAssetInventory(after,{requireHashes:true});
 const old=new Map(before.map(x=>[x.path,x.sha256]));
 const changed=[];
 for(const asset of after){
  const prev=old.get(asset.path);
  if(prev===undefined){
   assert(/^ft-v2\/|^ft-ai-v2\//.test(asset.path),'NON_FT_ASSET_ADDED_'+asset.path);
   changed.push(asset.path);continue;
  }
  if(prev===asset.sha256)continue;
  if(asset.path==='index.html'&&allowIndexShell){changed.push(asset.path);continue;}
  assert(/^ft-overview\//.test(asset.path),'PROTECTED_MOBILE_ASSET_CHANGED_'+asset.path);
  changed.push(asset.path);
 }
 for(const path of old.keys())assert(after.some(x=>x.path===path),'EXISTING_MOBILE_ASSET_REMOVED_'+path);
 return {status:'FT_STATIC_ISOLATED',preserved_existing:before.length,changed,
  ht_pricing_unchanged:REQUIRED_MOBILE_ASSETS.filter(x=>x.startsWith('ht-candidate/')).every(x=>old.get(x)===after.find(y=>y.path===x)?.sha256),
  requires_independent_ht_hc_runtime_and_d1_acceptance:true};
}
