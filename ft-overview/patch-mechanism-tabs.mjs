// Patch current deployed six-tab display only. Preserve all existing engine and navigation bytes.
export function patchMechanismTabs(current){
 if(typeof current!=='string'||!current.includes("['ftv2','FT AI V2']"))throw Error('SIX_TAB_BASE_REQUIRED');
 if(current.includes('light-signal-mechanisms.mjs'))throw Error('MECHANISMS_ALREADY_PATCHED');
 const anchor=" html+='<div class=\"ftabs-note\">Cùng dữ liệu nguồn và kết luận của từng cơ chế. Chuyển tab không gọi quét, không thay Smart Follow.</div>';";
 if(current.split(anchor).length!==2)throw Error('PRESENTATION_ANCHOR_MISSING');
 const header="import {renderSignalMechanism} from '../ft-ai-v2/light-signal-mechanisms.mjs';\n";
 const patched=current.replace(anchor,anchor+"\n html=renderSignalMechanism({tab:current,rows,chosen,fixture,packet,route,displayAction});");
 const next=header+patched;
 if(next.replace(header,'').replace("\n html=renderSignalMechanism({tab:current,rows,chosen,fixture,packet,route,displayAction});",'')!==current)throw Error('UNEXPECTED_TABS_CHANGE');
 return {code:next,anchors:1};
}
