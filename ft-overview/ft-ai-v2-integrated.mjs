// Additive FT AI V2 Experimental card for the EXISTING Football Edge Mobile shell.
// Reads existing read-only bridges. No provider requests, D1 writes, engine setters, Push or timers except UI refresh.
import {createStore} from './core.mjs';
import {readLegacy} from './adapter.mjs';
import {reviewFTDecision,createFTSessions} from './experimental-decision.mjs';
import {liveProbability} from './live-probability.mjs';
import {lightSignalFTV2View} from './light-signal-pro-view.mjs';
// The host tab owns navigation; this module only renders into its assigned panel.
let teardownFTV2=null,activeFTV2Root=null;
const ftSessions=createFTSessions();
function attachFTV2Tab(){
 const root=document.getElementById('ftAIV2ReadOnly');
 if(!root)return;
 if(root===activeFTV2Root&&root.dataset.ftV2Mounted==='true')return;
 if(teardownFTV2){teardownFTV2();teardownFTV2=null;}
 activeFTV2Root=root;
 root.dataset.ftV2Mounted='true';
 const store=createStore({trialRecommendations:true});
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const percent=x=>typeof x==='number'&&Number.isFinite(x)?(x*100).toFixed(1)+'%':'—';
 const odd=x=>typeof x==='number'&&Number.isFinite(x)?x.toFixed(2):'—';
 let selected=null,last='',lastSelected=null,currentSession=null;
 function render(){
  let snapshots=[];
  try{snapshots=readLegacy(window.FEUIReadBridge,window.FEOverviewInputBridge,{conditionedFT:true})}catch(e){
   root.textContent='FT V2: không đọc được dữ liệu nguồn; HT/HC vẫn hoạt động độc lập';return;
  }
  for(const snapshot of snapshots)store.ingest(snapshot);
  const rows=store.read(Date.now());
  if(!rows.some(x=>x.id===selected))selected=rows.find(x=>x.rank)?.id??rows[0]?.id??null;
  const row=rows.find(x=>x.id===selected);
  const review=row?reviewFTDecision(row):null;
  const live=row?liveProbability(row.snapshot):null;
  const session=row?ftSessions.update(row,review,Date.now()):null;currentSession=session;
  const html=lightSignalFTV2View({rows,selected,review,live,session,now:Date.now()});
  if(html!==last){const opened=lastSelected===selected?[...root.querySelectorAll('details')].map(e=>e.open):null;root.innerHTML=html;if(opened)root.querySelectorAll('details').forEach((e,i)=>{if(i<opened.length)e.open=opened[i];});last=html;lastSelected=selected;}
 }
 const onClick=event=>{const t=event.target.closest('[data-ft-v2-select]');if(t){selected=Number(t.dataset.ftV2Select);render();}};
 root.addEventListener('click',onClick);
 let queued=false;
 const sync=()=>{if(queued||document.visibilityState==='hidden'||!root.isConnected)return;queued=true;requestAnimationFrame(()=>{queued=false;if(root.isConnected)render();});};
 window.addEventListener('fe-notify-sync-updated',sync);
 const visibility=()=>{if(document.visibilityState==='visible')sync();};
 document.addEventListener('visibilitychange',visibility);
 render();
 // Refresh while this tab is open; keep legacy scanner scheduling untouched.
 let ticks=0;
 const refresh=()=>{if(!root.isConnected){cleanup();return;}if(document.visibilityState!=='visible')return;
  const clock=root.querySelector('[data-ft-session-clock]');
  if(clock&&currentSession){const seconds=Math.max(0,Math.ceil((currentSession.expiresAt-Date.now())/1000));clock.textContent=currentSession.status+' · '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  if(++ticks%15===0||(currentSession?.status==='ACTIVE'&&Date.now()>=currentSession.expiresAt))sync();
 };
 // One lightweight clock update; valuation reads only source observations.
 const timer=setInterval(refresh,1000);
 function cleanup(){clearInterval(timer);root.removeEventListener('click',onClick);window.removeEventListener('fe-notify-sync-updated',sync);document.removeEventListener('visibilitychange',visibility);root.dataset.ftV2Mounted='false';if(activeFTV2Root===root)activeFTV2Root=null;}
 teardownFTV2=cleanup;
}
window.addEventListener('fe-ft-v2-tab-open',attachFTV2Tab);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachFTV2Tab,{once:true});else attachFTV2Tab();


