// Pure additive FT V2 mobile-shell integration. Input MUST be current deployed HTML.
export function injectFTV2IntoCurrentShell(html){
 if(typeof html!=='string'||html.length<20000)throw Error('INVALID_CURRENT_MOBILE_HTML');
 if(!html.includes('ftOverviewCard')||!html.includes('ui-tabs/integrated')||
    !html.includes('ht-candidate/'))throw Error('CURRENT_SHELL_REQUIRED_FEATURE_MISSING');
 if(html.includes('/ft-ai-v2/integrated.mjs'))throw Error('FT_V2_ALREADY_INSTALLED');
 const body='</body>';
 if(html.split(body).length!==2)throw Error('HTML_BODY_ANCHOR_AMBIGUOUS');
 const addition='<script type="module" src="/ft-ai-v2/integrated.mjs"></script>\n';
 const next=html.replace(body,addition+body);
 if(next.replace(addition,'')!==html)throw Error('UNEXPECTED_SHELL_DIFF');
 return {html:next,addedBytes:Buffer.byteLength(addition),changedElements:['ft-ai-v2/integrated.mjs'],originalBytes:Buffer.byteLength(html)};
}
