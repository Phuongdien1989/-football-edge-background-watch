// Current production already contains a detached V2 card. Remove ONLY that card,
// preserve its script, and let the shared tabs own the V2 workspace.
export function injectFTV2IntoCurrentShell(html){
 if(typeof html!=='string'||html.length<20000)throw Error('INVALID_CURRENT_MOBILE_HTML');
 if(!html.includes('ftOverviewCard')||!html.includes('ui-tabs/integrated')||!html.includes('ht-candidate/'))throw Error('CURRENT_SHELL_REQUIRED_FEATURE_MISSING');
 const start='<details class="card fo-native" id="ftAIV2Card"';
 const end='</details>\n<script type="module" src="/ft-ai-v2/integrated.mjs"></script>';
 const a=html.indexOf(start),b=html.indexOf(end,a);
 if(a<0||b<0||html.indexOf(start,a+1)!==-1)throw Error('DETACHED_V2_CARD_ANCHOR_MISMATCH');
 const oldBlock=html.slice(a,b+'</details>'.length);
 const next=html.replace(oldBlock,'');
 if(next.replace('', '')!==next||next.includes('id="ftAIV2Card"'))throw Error('DETACHED_CARD_NOT_REMOVED');
 if(!next.includes('/ft-ai-v2/integrated.mjs'))throw Error('FT_V2_MODULE_SCRIPT_MISSING');
 return {html:next,originalBytes:Buffer.byteLength(html),removedBytes:Buffer.byteLength(oldBlock),
 changedElements:['remove_detached_ftAIV2Card','preserve_module_script']};
}
