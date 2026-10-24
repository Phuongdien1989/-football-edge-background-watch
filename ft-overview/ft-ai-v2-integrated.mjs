// Additive FT AI V2 Experimental card for the EXISTING Football Edge Mobile shell.
// Reads existing read-only bridges. No provider requests, D1 writes, engine setters, Push or timers except UI refresh.
import {createStore} from './core.mjs';
import {readLegacy} from './adapter.mjs';
import {reviewFTDecision} from './experimental-decision.mjs';
import {liveProbability} from './live-probability.mjs';
// The host tab owns navigation; this module only renders into its assigned panel.
function attachFTV2Tab(){
 const root=document.getElementById('ftAIV2ReadOnly');
 if(!root||root.dataset.ftV2Mounted==='true')return;
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
  const ranked=rows.filter(x=>x.rank).slice(0,5);
  let html='<div style="font-size:11px;color:#70869e">EXPERIMENTAL · Dữ liệu đang dùng từ app hiện hành · Model chưa hiệu chỉnh LIVE</div>';
  html+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">'+ranked.map((x,i)=>'<button type="button" data-ft-v2-select="'+x.id+'" style="padding:7px 9px;border:1px solid #b6cde6;border-radius:11px;background:'+(x.id===selected?'#d9efff':'white')+'">TOP '+(i+1)+' · '+esc(x.snapshot.home)+'</button>').join('')+'</div>';
  if(!row)html+='<p>Chờ trận từ scanner hiện tại. FT V2 không tự gọi API hoặc bật scanner.</p>';
  else {
   const s=row.snapshot,v=reviewFTDecision(row),live=liveProbability(s),m=s.market;
   html+='<div style="font-size:13px;font-weight:700">'+esc(s.league)+' · '+esc(s.home)+' '+esc(s.goals?.home)+'–'+esc(s.goals?.away)+' '+esc(s.away)+' · '+esc(s.minute)+'′</div>';
   html+='<div style="font-size:17px;font-weight:800;margin:10px 0">'+esc(v.title)+'</div>';
   html+='<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">';
   for(const [name,value] of [['LINE',m?.line??'—'],['ODDS',odd(v.odds)],['MODEL',percent(v.winProbability)],['FAIR',odd(v.fairOdds)],['EV',percent(v.estimatedEV)],['BREAK EVEN',percent(v.breakEven)]])
    html+='<div style="padding:8px;background:#edf6ff;border-radius:10px"><small>'+esc(name)+'</small><strong style="display:block">'+esc(value)+'</strong></div>';
   html+='</div>';
   html+='<p style="font-size:12px;margin:10px 0"><b>Dữ liệu LIVE:</b> '+esc(live.evidence?.status||'NO_WINDOW')+' · '+esc(live.reason)+'</p>';
   html+='<p style="font-size:12px"><b>Lý do:</b> '+esc(v.reason.join(' · ')||'Chưa đủ dữ liệu')+'</p>';
   html+='<details><summary style="font-size:12px">Rủi ro, tính bất định và nguồn dữ liệu</summary><p style="font-size:12px">'+esc(v.warnings.join(' · '))+'</p><p style="font-size:12px">EV nếu xác suất đổi ±5 điểm %: '+percent(v.sensitivity.lowEV)+' đến '+percent(v.sensitivity.highEV)+' (giả định kiểm tra độ nhạy, không phải khoảng tin cậy).</p><p style="font-size:11px">Phiên bản: '+esc(v.modelVersion||'CHƯA CÓ')+' · '+esc(v.policy)+'</p></details>';
  }
  html+='<small style="display:block;margin-top:10px;color:#718cae">Phân tích thử nghiệm; không dự báo chắc thắng. Không làm thay đổi HT/HC/TOP/Push.</small>';
  if(html!==last){root.innerHTML=html;last=html;}
 }
 root.addEventListener('click',event=>{const t=event.target.closest('[data-ft-v2-select]');if(t){selected=Number(t.dataset.ftV2Select);render();}});
 window.addEventListener('fe-notify-sync-updated',render);
 document.addEventListener('visibilitychange',render);
 render();
 // Refresh while this tab is open; keep legacy scanner scheduling untouched.
 const refresh=()=>{if(!root.isConnected){clearInterval(timer);return;}render();};
 const timer=setInterval(refresh,4000);
}
window.addEventListener('fe-ft-v2-tab-open',attachFTV2Tab);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachFTV2Tab,{once:true});else attachFTV2Tab();
