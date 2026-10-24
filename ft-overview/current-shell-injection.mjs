// Presentation-only injection into the current six-tab production Mobile shell.
export function injectFTV2IntoCurrentShell(html){
 if(typeof html!=='string'||html.length<20000)throw Error('INVALID_CURRENT_MOBILE_HTML');
 for(const marker of ['ftOverviewCard','ui-tabs/integrated','ht-candidate/','/ft-ai-v2/integrated.mjs']){
   if(!html.includes(marker))throw Error('REQUIRED_CURRENT_FEATURE_MISSING_'+marker);
 }
 if(html.includes('id="ftAIV2Card"'))throw Error('LEGACY_DETACHED_CARD_PRESENT');
 if(html.includes('/ft-ai-v2/light-signal-pro.css'))return {html,originalBytes:Buffer.byteLength(html),addedBytes:0,changedElements:[]};
 if(html.split('</head>').length!==2)throw Error('HTML_HEAD_ANCHOR_AMBIGUOUS');
 const link='<link rel="stylesheet" href="/ft-ai-v2/light-signal-pro.css">\n';
 const next=html.replace('</head>',link+'</head>');
 if(next.replace(link,'')!==html)throw Error('SHELL_UNEXPECTED_CHANGE');
 return {html:next,originalBytes:Buffer.byteLength(html),addedBytes:Buffer.byteLength(link),changedElements:['light-signal-css-only']};
}
