// Restore the original HT card inside the six-tab app while preserving all engines.
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']")||!current.includes('FE_TAB_PERF_V2'))throw Error('CURRENT_SIX_TAB_PERF_BASE_REQUIRED');
 const before="document.body.dataset.feTabsTools='false';render();requestAnimationFrame(";
 const after="document.body.dataset.feTabsTools=tab==='ht'?'true':'false';render();requestAnimationFrame(";
 if(current.split(before).length!==2)throw Error('HT_ACTIVATION_ANCHOR_MISSING');
 const code=current.replace(before,after);
 if(code.replace(after,before)!==current)throw Error('PATCH_NOT_REVERSIBLE');
 return {code,anchors:1};
}
