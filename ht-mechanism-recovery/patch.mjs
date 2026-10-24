import assert from 'node:assert/strict';
export function restoreHTTabs(tabs){
 if(tabs.includes('HT_PRICING_ROUTE_RESTORED_V1')){assert(tabs.includes("if(current!=='ht')html=renderSignalMechanism"));return tabs;}
 const replacements=[
  ['html=renderSignalMechanism({tab:current,rows,chosen,fixture,packet,route,displayAction});',"if(current!=='ht')html=renderSignalMechanism({tab:current,rows,chosen,fixture,packet,route,displayAction});/* HT_PRICING_ROUTE_RESTORED_V1 */"],
  ["document.body.dataset.feTabsTools=tab==='ht'?'true':'false';if(tab==='ht'){const ht=document.getElementById('h1WatchCard');if(ht){ht.classList.remove('fe-p11-collapsed');if(ht.tagName==='DETAILS')ht.open=true;}}/* HT_NATIVE_EXPAND_V2 */", "document.body.dataset.feTabsTools='false';/* HT_PRICING_ROUTE_RESTORED_V1 */"]
 ];
 let out=tabs;for(const [a,b] of replacements){assert.equal(out.split(a).length,2,'HT_ROUTE_ANCHOR_DRIFT');out=out.replace(a,b);}
 let reversed=out;for(const [a,b]of [...replacements].reverse())reversed=reversed.replace(b,a);assert.equal(reversed,tabs);
 return out;
}
export function restoreHTView(tabs,css){
 const out=restoreHTTabs(tabs);
 const hide='body.fe-tabs-mode[data-fe-tabs-tab="ht"] #feTabsWorkspace .ftabs-content{display:none!important}';
 const native='body.fe-tabs-mode[data-fe-tabs-tab="ht"] .app>#h1WatchCard{display:block!important}';
 assert.equal(css.split(hide).length,2,'HT_HIDDEN_RULE_DRIFT');assert.equal(css.split(native).length,2,'HT_NATIVE_RULE_DRIFT');
 const style=css.replace(hide,'/* HT pricing content remains visible; legacy tools remain opt-in. */').replace(native,'');
 assert.equal(style.replace('/* HT pricing content remains visible; legacy tools remain opt-in. */',hide)+'',css.replace(native,''));
 return {tabs:out,css:style,changed:['ui-tabs/integrated.mjs','ft-ai-v2/light-signal-pro.css']};
}
