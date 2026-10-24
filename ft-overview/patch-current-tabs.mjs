// Add FT V2 route to the EXACT currently deployed UI-tabs file, not a stale repo copy.
export function patchCurrentTabs(current){
 if(typeof current!=='string'||!current.includes("const tabs=[['overview','Overview']"))throw Error('CURRENT_TABS_SOURCE_ANCHOR_MISSING');
 const steps=[
  ["['valuation','FT Overview']],names","['valuation','FT Overview'],['ftv2','FT AI V2']],names"],
  ["valuation:'ftOverviewCard'}","valuation:'ftOverviewCard',ftv2:'feTabsWorkspace'}"],
  ["const selectedSignal=(x,tab)=>tab==='overview'?","const selectedSignal=(x,tab)=>tab==='ftv2'?null:tab==='overview'?"],
  [" if(!enabled||!root)return;\n try{packet=read();",
   " if(!enabled||!root)return;\n try{if(current==='ftv2'){const nav=root.querySelector('.ftabs-nav');const navHTML=tabs.map(([k,t])=>`<button type=\"button\" role=\"tab\" data-ftabs-tab=\"${k}\" aria-controls=\"feTabsContent\" aria-selected=\"${k===current}\">${t}</button>`).join('');if(navHTML!==lastNav){nav.innerHTML=navHTML;lastNav=navHTML;}const body=root.querySelector('.ftabs-content');body.id='feTabsContent';body.setAttribute('role','tabpanel');const shell='<h2>FT AI V2 · EXPERIMENTAL</h2><p class=\"ftabs-sub\">Phân tích độc lập · Chung dữ liệu quét với HT/HC · Chưa hiệu chỉnh LIVE</p><section id=\"ftAIV2ReadOnly\" aria-label=\"FT AI V2 danh sách và phân tích\">Đang nhận dữ liệu hiện hành…</section>';if(body.innerHTML!==shell){body.innerHTML=shell;last=shell;}document.body.dataset.feTabsTab=current;root.dataset.current=current;window.dispatchEvent(new Event('fe-ft-v2-tab-open'));return;}packet=read();"]
 ];
 let output=current;
 for(const [before,after] of steps){
  if(output.split(before).length!==2)throw Error('CURRENT_TABS_PATCH_ANCHOR_NOT_UNIQUE_'+before.slice(0,25));
  output=output.replace(before,after);
 }
 if(output.replace(steps[3][1],steps[3][0]).replace(steps[2][1],steps[2][0]).replace(steps[1][1],steps[1][0]).replace(steps[0][1],steps[0][0])!==current)
  throw Error('CURRENT_TABS_UNEXPECTED_CHANGE');
 return {code:output,changedAnchors:steps.length};
}
