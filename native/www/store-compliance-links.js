(()=>{
  'use strict';
  const isStore=()=>document.querySelector('meta[name="football-edge-store-edition"]')?.content==='1';
  function install(){
    if(!isStore()||document.getElementById('feStoreComplianceLinks'))return;
    const host=document.getElementById('feNativePushMeta')||document.getElementById('connectCard');
    if(!host)return;
    const box=document.createElement('div');
    box.id='feStoreComplianceLinks';
    box.setAttribute('data-store-compliance','privacy-support');
    box.innerHTML=`<div style="margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--card)">
      <div style="font-size:8px;font-weight:950;color:var(--text)">PRIVACY & SUPPORT</div>
      <div style="margin-top:5px;font-size:7px;line-height:1.45;color:var(--muted)">Store Edition • Push is optional • Device notification registration can be deleted from this screen.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <a href="./privacy.html" style="display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-size:8px;font-weight:900;color:var(--text)">PRIVACY POLICY</a>
        <a href="./support.html" style="display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid var(--line);border-radius:10px;text-decoration:none;font-size:8px;font-weight:900;color:var(--text)">SUPPORT</a>
      </div>
    </div>`;
    host.insertAdjacentElement('afterend',box);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
  window.FE_STORE_COMPLIANCE_UI=Object.freeze({version:'S1.0',install});
})();
