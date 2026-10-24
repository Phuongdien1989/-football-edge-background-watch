// Optimizes the currently deployed six-tab Light Signal Pro display without changing engines.
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']")||!current.includes('light-signal-mechanisms.mjs'))throw Error('CURRENT_LSP_SIX_TABS_REQUIRED');
 if(current.includes('FE_TAB_PERF_V2'))throw Error('ALREADY_OPTIMIZED');
 const anchor="if(body.innerHTML!==shell){body.innerHTML=shell;last=shell;}document.body.dataset.feTabsTab=current;root.dataset.current=current;window.dispatchEvent(new Event('fe-ft-v2-tab-open'));return;";
 const replacement="if(!body.querySelector('#ftAIV2ReadOnly')){body.innerHTML=shell;last=shell;window.dispatchEvent(new Event('fe-ft-v2-tab-open'));}document.body.dataset.feTabsTab=current;root.dataset.current=current;return;/* FE_TAB_PERF_V2 */";
 if(current.split(anchor).length!==2)throw Error('LIVE_FTV2_ROUTER_ANCHOR_MISMATCH');
 const next=current.replace(anchor,replacement);
 if(next.replace(replacement,anchor)!==current)throw Error('TAB_PATCH_NOT_REVERSIBLE');
 return {code:next,anchors:1};
}
