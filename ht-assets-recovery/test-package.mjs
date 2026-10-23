import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preservedMobileAssets,assertAssetClosure,assertStaticContent} from '../mobile-outbox-candidate/preserved-mobile-assets.mjs';
const source=process.argv[2]||'previous-ht/ht-event-release/site',root=mkdtempSync(join(tmpdir(),'fe-ht-assets-'));
try{
 cpSync(source,root,{recursive:true});assert.equal(preservedMobileAssets.length,28);assert.equal(new Set(preservedMobileAssets).size,28);
 assert(assertAssetClosure(root).files>=28);
 rmSync(join(root,'ht-candidate'),{recursive:true});
 assert.throws(()=>assertAssetClosure(root),/ASSET_MISSING_ht-candidate/,'REPRODUCE_18_FILE_RELEASE_OMISSION');
 cpSync(join(source,'ht-candidate'),join(root,'ht-candidate'),{recursive:true});assert(assertAssetClosure(root).files>=28);
 writeFileSync(join(root,'ht-candidate/ui.mjs'),readFileSync(join(root,'ht-candidate/ui.mjs'),'utf8')+"\nimport './missing-dependency.mjs';\n");
 assert.throws(()=>assertAssetClosure(root),/ASSET_MISSING_ht-candidate\/missing-dependency.mjs/);
 assert.throws(()=>assertStaticContent('ht-candidate/ui.mjs','text/html','<!doctype html>'),/ASSET_MIME/);
 assert.throws(()=>assertStaticContent('ht-candidate/ui.mjs','text/javascript','<html>'),/ASSET_HTML_FALLBACK/);
 assert.throws(()=>assertStaticContent('ht-candidate/style.css','text/html','html'),/ASSET_MIME/);
 assert.doesNotThrow(()=>assertStaticContent('ht-candidate/ui.mjs','application/javascript','export const x=1;'));
 assert.doesNotThrow(()=>assertStaticContent('ht-candidate/style.css','text/css','body{}'));
 const preflight=readFileSync('mobile-outbox-candidate/production-preflight.mjs','utf8');
 assert(preflight.includes('const files=preservedMobileAssets;'));assert(preflight.includes("assertAssetClosure(directory+'/site')"));assert(preflight.includes('assertStaticContent(path,'));
 console.log(JSON.stringify({status:'PASS',old_release_omission_reproduced:true,full_bundle_files:28,missing_transitive_dependency:'BLOCKED',html_fallback:'BLOCKED',future_outbox_preflight:'GUARDED'}));
}finally{rmSync(root,{recursive:true,force:true});}
