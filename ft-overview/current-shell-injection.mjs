// Pure additive FT V2 mobile-shell integration. Input MUST be current deployed HTML.
export function injectFTV2IntoCurrentShell(html){
 if(typeof html!=='string'||html.length<20000)throw Error('INVALID_CURRENT_MOBILE_HTML');
 if(!html.includes('ftOverviewCard')||!html.includes('ui-tabs/integrated')||
    !html.includes('ht-candidate/'))throw Error('CURRENT_SHELL_REQUIRED_FEATURE_MISSING');
 if(html.includes('id="ftAIV2Card"'))throw Error('FT_V2_ALREADY_INSTALLED');
 const body='</body>';
 if(html.split(body).length!==2)throw Error('HTML_BODY_ANCHOR_AMBIGUOUS');
 const addition='<details class="card fo-native" id="ftAIV2Card" style="margin:14px 0;padding:14px;border:1px solid #cbdff4;border-radius:18px"><summary style="font-size:14px;font-weight:700">FT AI V2 · EXPERIMENTAL — mở phân tích</summary><div id="ftAIV2ReadOnly" style="padding:12px 0;color:#234761">Đang chờ dữ liệu trận đấu hiện hành…</div></details>\n<script type="module" src="/ft-ai-v2/integrated.mjs"></script>\n';
 const next=html.replace(body,addition+body);
 if(next.replace(addition,'')!==html)throw Error('UNEXPECTED_SHELL_DIFF');
 return {html:next,addedBytes:Buffer.byteLength(addition),changedElements:['ftAIV2Card','ft-ai-v2/integrated.mjs'],originalBytes:Buffer.byteLength(html)};
}
