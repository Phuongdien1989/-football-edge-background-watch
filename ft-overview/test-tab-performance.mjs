import assert from 'node:assert/strict';
import {patchMechanismTabs} from './patch-mechanism-tabs.mjs';
const src="const tabs=[['ftv2','FT AI V2']];/* FE_TAB_PERF_V2 */document.body.dataset.feTabsTools='false';render();requestAnimationFrame(";
const p=patchMechanismTabs(src);
assert.equal(p.anchors,1);
assert(p.code.includes("tab==='ht'?'true':'false'"));
assert.throws(()=>patchMechanismTabs(p.code),/ANCHOR_MISSING/);
console.log('HT_NATIVE_RESTORE_PATCH_PASS');
