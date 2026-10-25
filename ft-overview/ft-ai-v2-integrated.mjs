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
 let selected=null,last='';
 function render(){
  let snapshots=[];
  try{snapshots=readLegacy(window.FEUIReadBridge,window.FEOverviewInputBridge)}catch(e){
   root.textContent='FT V2: không đọc được dữ liệu nguồn; HT/HC vẫn hoạt động độc lập';return;
  }
  for(const snapshot of snapshots)store.ingest(snapshot);
  const rows=store.read(Date.now());
  if(!rows.some(x=>x.id===selected))selected=rows.find(x=>x.rank)?.id??rows[0]?.id??null;
  const row=rows.find(x=>x.id===selected);
  const review=row?reviewFTDecision(row):null;
  const live=row?liveProbability(row.snapshot):null;
  const session=row?ftSessions.update(row,review,Date.now()):null;
  const html=lightSignalFTV2View({rows,selected,review,live,session,now:Date.now()});
  if(html!==last){root.innerHTML=html;last=html;}
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
 const refresh=()=>{if(!root.isConnected){cleanup();return;}if(document.visibilityState==='visible')sync();};
 const timer=setInterval(refresh,15000);
 function cleanup(){clearInterval(timer);root.removeEventListener('click',onClick);window.removeEventListener('fe-notify-sync-updated',sync);document.removeEventListener('visibilitychange',visibility);root.dataset.ftV2Mounted='false';if(activeFTV2Root===root)activeFTV2Root=null;}
 teardownFTV2=cleanup;
}
window.addEventListener('fe-ft-v2-tab-open',attachFTV2Tab);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachFTV2Tab,{once:true});else attachFTV2Tab();

