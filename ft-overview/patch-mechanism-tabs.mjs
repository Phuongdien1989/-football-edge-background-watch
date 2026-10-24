// Correct only the HT presentation: uncollapse native HT card on HT tab activation.
// Preserve all recommendation/valuation/plot data and scanner/engine code untouched.
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']")||!current.includes('FE_TAB_PERF_V2'))throw Error('CURRENT_SIX_TAB_PERF_BASE_REQUIRED');
 if(current.includes('HT_NATIVE_EXPAND_V2'))throw Error('ALREADY_APPLIED');
 const before="document.body.dataset.feTabsTools=tab==='ht'?'true':'false';render();requestAnimationFrame(";
 const after="document.body.dataset.feTabsTools=tab==='ht'?'true':'false';if(tab==='ht'){const ht=document.getElementById('h1WatchCard');if(ht){ht.classList.remove('fe-p11-collapsed');if(ht.tagName==='DETAILS')ht.open=true;}}/* HT_NATIVE_EXPAND_V2 */render();requestAnimationFrame(";
 if(current.split(before).length!==2)throw Error('HT_ACTIVATION_ANCHOR_MISSING');
 const code=current.replace(before,after);
 if(code.replace(after,before)!==current)throw Error('PATCH_NOT_REVERSIBLE');
 return {code,anchors:1};
}
