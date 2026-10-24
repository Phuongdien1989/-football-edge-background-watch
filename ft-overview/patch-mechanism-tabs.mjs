// Existing production tab router already contains the Light Signal Pro performance fix.
// Protect it byte-for-byte while updating only the shared visual asset.
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']")||!current.includes('light-signal-mechanisms.mjs')||!current.includes('FE_TAB_PERF_V2'))throw Error('CURRENT_SIX_TAB_PERF_BASE_REQUIRED');
 return {code:current,anchors:0,unchanged:true};
}
