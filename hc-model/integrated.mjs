// Opt-in candidate integration. Does not change the legacy tab renderer or engines.
import {readHCPricing} from './valuation-adapter.mjs';
import {renderHCResearch} from './view.mjs';
import {auditHCContract} from './contract-audit.mjs';
import {createHCResearchSessions} from './session.mjs';
import {hcReadiness} from './live-evidence.mjs';
export function attachHCResearch({win=window,doc=document,verifiedRules=[]}={}){
 const sessions=createHCResearchSessions();
 const workspace=doc.getElementById('feTabsWorkspace');if(!workspace)return null;
 const existing=workspace.querySelector('[data-hc-research-panel]');if(existing)return null;
 const panel=doc.createElement('section');panel.setAttribute('data-hc-research-panel','');panel.setAttribute('aria-label','HC Research · đối chiếu độc lập');panel.hidden=true;workspace.append(panel);
 let rows=[],last='',queued=false,destroyed=false,renders=0,reads=0,nextRefresh=0;
 function active(){return win.FETabsIntegrated?.mode?.().enabled&&win.FETabsIntegrated.mode().current==='hc'&&doc.visibilityState!=='hidden';}
 function render(){if(destroyed)return;if(!active()){panel.hidden=true;return;}panel.hidden=false;
  try{const packet=win.FETabsIntegrated.read(),ids=[...new Set(packet?.lists?.hc||[])].slice(0,5),selected=win.FETabsIntegrated.mode().fixture;
   // Preserve the actual displayed HC list order. Research prices never rank it.
   reads++;rows=readHCPricing(win.FEUIReadBridge,win.FEOverviewInputBridge,{now:Date.now(),verifiedRules,fixtureIds:ids});
   rows=sessions.update(rows,Date.now());
   const chosen=selected?rows.filter(r=>r.id===selected):rows.slice(0,1);
   if(selected&&!chosen.length){const held=sessions.read(selected,Date.now());if(held)chosen.push({id:selected,home:held.original.home,away:held.original.away,league:held.original.league,at:null,reason:'SOURCE_MISSING',recordedOnly:true,session:held,valuations:[]});}
   const at=Date.now(),deadlines=rows.flatMap(r=>[r.at+60001,r.session?.expiresAt,...r.valuations.map(v=>v.quote?.quoteAt+60001)]).filter(t=>Number.isFinite(t)&&t>at);nextRefresh=Math.min(at+15000,...deadlines);
   const html=renderHCResearch(chosen,{now:Date.now()});
   if(html!==last){const opened=[...panel.querySelectorAll('details[open]')].map(e=>e.dataset.hcDetail);const previous=panel.querySelector('[data-fixture]')?.dataset.fixture;panel.innerHTML=html;
    panel.querySelectorAll('details').forEach((e,i)=>{e.dataset.hcDetail=String(i);if(previous===panel.querySelector('[data-fixture]')?.dataset.fixture&&opened.includes(String(i)))e.open=true;});last=html;renders++;}
  }catch{rows=[];panel.textContent='HC Research: chưa đọc được dữ liệu; công cụ HC gốc vẫn giữ nguyên.';last='';}
 }
 function sync(){if(destroyed||queued)return;queued=true;win.requestAnimationFrame(()=>{queued=false;render();});}
 // The legacy document has <base href="/">. Plain fragment anchors would
 // navigate to '/' and silently drop the opt-in query flag/reload the document.
 // Only opt-in workspace mechanism links use the existing same-document hash route.
 const routeClick=event=>{const a=event.target.closest?.('a[href^="#fe-tabs/"]');if(!a||!workspace.contains(a)||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();win.location.hash=a.getAttribute('href');};
 workspace.addEventListener('click',routeClick);
 const observer=new win.MutationObserver(records=>{if(records.some(r=>!panel.contains(r.target)))sync();});
 observer.observe(workspace,{childList:true,subtree:true,attributes:true,attributeFilter:['data-current','data-fixture']});
 for(const event of ['fe-notify-sync-updated','hashchange'])win.addEventListener(event,sync);
 doc.addEventListener('visibilitychange',sync);
 // UI-only expiry refresh, only reads while HC tab is visible. No scanner tick.
 const timer=win.setInterval(()=>{if(!active())return;const now=Date.now();for(const clock of panel.querySelectorAll('[data-hc-session-clock]')){const seconds=Math.max(0,Math.ceil((Number(clock.dataset.hcSessionClock)-now)/1000));clock.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}if(now>=nextRefresh)sync();},1000);
 const api={readiness:()=>rows.map(hcReadiness),sessions:()=>sessions.list(Date.now()),read:()=>structuredClone(rows),contracts:()=>rows.flatMap(row=>row.valuations.map(v=>({fixtureId:row.id,...auditHCContract(v.quote,{verifiedRules})}))),stats:()=>({reads,renders}),refresh:sync,destroy(){destroyed=true;observer.disconnect();workspace.removeEventListener('click',routeClick);win.clearInterval(timer);for(const event of ['fe-notify-sync-updated','hashchange'])win.removeEventListener(event,sync);doc.removeEventListener('visibilitychange',sync);panel.remove();}};
 sync();return Object.freeze(api);
}
if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('hcResearch')==='1'){
 const boot=()=>{if(!window.FEHCResearchPreview)window.FEHCResearchPreview=attachHCResearch();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
}
