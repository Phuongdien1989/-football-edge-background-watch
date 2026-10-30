// Preserve the original HT pricing route while retaining current FT/HC/V2 views.
import {restoreHTTabs} from '../ht-mechanism-recovery/patch.mjs';
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']")||!current.includes('FE_TAB_PERF_V2'))throw Error('CURRENT_SIX_TAB_PERF_BASE_REQUIRED');
 const code=restoreHTTabs(current);return {code,anchors:code===current?0:2};
}
