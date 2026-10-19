import {createStore,fingerprint,VERSION,goalsToFullWin} from './core.mjs';
import {readLegacy} from './adapter.mjs';
import {trendChart,barsChart,priceChart} from './charts.mjs';
import {demoSnapshots} from './demo.mjs';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>typeof x==='number'&&Number.isFinite(x)?`${(100*x).toFixed(1)}%`:'—';
export function mount(root,{demo=false,bridge=window.FEUIReadBridge,bundleBridge=window.FEOverviewInputBridge,inputSource=null,controlSource=null,archive=false,trialRecommendations=false}={}) {
  trialRecommendations=trialRecommendations&&!demo&&!archive;
  const store=createStore({trialRecommendations});let selected=null,lastHTML='',demoTime=Date.now(),refreshCount=0;
  const storageKey='FE_FT_OVERVIEW_RESEARCH_V1';let lastSaved='';
  if(!demo&&!archive)try{const saved=sessionStorage.getItem(storageKey);if(saved)store.restore(JSON.parse(saved));}catch{}
  const snapshots=demo?demoSnapshots(demoTime):[];
  if(demo) {
    // Seed genuine, explicitly fictional per-contract historical observations.
    for(let step=0;step<5;step++)for(const base of snapshots){
      const at=base.at-(4-step)*60000,p=.37+step*.02;
      const row={...structuredClone(base),at,revision:at,minute:base.minute-(4-step),model:{...base.model,at,pmf:[.2,1-.2-p,p*2/3,p/3]},market:{...base.market,at}};
      store.ingest(row);
    store.read(at);
    }
  }
  function render() {
    if(document.visibilityState==='hidden')return;
    const now=demo?demoTime:Date.now();
    if(!demo)for(const row of inputSource?inputSource():readLegacy(bridge,bundleBridge))store.ingest(row);
    const rows=store.read(now,{controls:demo?[]:controlSource?controlSource():bundleBridge?.readControls?.()||[]}),top=rows.filter(r=>r.rank&&r.rank<=5);
    if(!rows.some(r=>r.id===selected))selected=top[0]?.id||rows[0]?.id;
    const r=rows.find(x=>x.id===selected),s=r?.snapshot,m=s?.market;
    let html=`<header class="fo-header"><div><small>FOOTBALL EDGE · ${demo?'DỮ LIỆU MINH HỌA':archive?'DỮ LIỆU THẬT ĐÃ LƯU':'BẢN THỬ ĐỌC DỮ LIỆU'}</small><h2>FT OVERVIEW</h2></div><span class="fo-chip">${demo?'DEMO':archive?'ARCHIVE':'SHADOW'}</span></header>`;
    html+=`<nav class="fo-top" aria-label="TOP theo dõi">${top.map(x=>`<button data-select="${x.id}" title="${esc(x.snapshot.home+' – '+x.snapshot.away)}" aria-label="TOP ${x.rank}: ${esc(x.snapshot.home+' – '+x.snapshot.away)}" aria-pressed="${x.id===selected}">TOP ${x.rank}<small>${esc(x.snapshot.home)}</small></button>`).join('') || '<span>Chưa có trận đang cập nhật</span>'}</nav>`;
    if(!r)html+='<div class="fo-card fo-empty"><h3>Đang chờ dữ liệu app</h3><p>Mở một trận có dữ liệu trong HT / FT / HC. Overview dùng snapshot sẵn có; không tự gọi API.</p></div>';
    else {
      const contract=m?fingerprint([m.bookmaker,m.period,m.basis,m.line]):null;
      const usable=r.modelOK&&!r.blocked&&r.marketFresh,quote=usable?r.quote:null;
      html+=`<article class="fo-card"><div class="fo-flex"><small>${esc(s.league)}</small><span class="fo-chip">${r.rank?'TOP #'+r.rank:r.entry}</span></div><div class="fo-match"><b>${esc(s.home)}</b><div><strong>${esc(s.goals.home)} – ${esc(s.goals.away)}</strong><small>${esc(s.minute)}′ · ${esc(s.status)}</small></div><b>${esc(s.away)}</b></div>
        <div class="fo-readiness" aria-label="Trạng thái đầu vào"><span data-ready="${r.fresh&&!r.blocked}">DATA ${r.blocked?'WAIT':'OK'}</span><span data-ready="${r.modelOK}">MODEL ${r.modelOK?'RESEARCH':'WAIT'}</span><span data-ready="${r.marketFresh}">PRICE ${r.marketFresh?'OK':'WAIT'}</span></div>
        <section class="fo-recommend"><small>BET RECOMMENDATION · ${esc(r.entry)}</small><h3>${r.blocked?'CHỜ DỮ LIỆU XÁC NHẬN':m&&r.marketFresh?(r.recommendation.action==='TRIAL_OVER'?'CÂN NHẮC TÀI ':demo?'OVER ':'ĐANG ĐỊNH GIÁ OVER ')+esc(m.line)+' FT @ '+Number(m.over).toFixed(2):'CHỜ LINE / GIÁ HỢP LỆ'}</h3><p>${demo?(quote?.ev>0?'MINH HỌA • Cân nhắc trong ví dụ giả định':'MINH HỌA • CHỜ GIÁ — chưa có lợi thế model'):esc(r.reason)}</p>${!demo?'<small>'+(trialRecommendations?'KHUYẾN NGHỊ THỬ NGHIỆM • Mô hình nền chưa được hiệu chỉnh LIVE':'SHADOW • Chưa phát khuyến nghị cược thật')+'</small>':''}${!r.blocked&&m&&r.marketFresh?`<small>Thêm ${goalsToFullWin(s.goals.home+s.goals.away,m.line)} bàn để thắng đủ · quy tắc tổng bàn FT</small>`:''}</section>
        <section class="fo-panel"><div class="fo-flex"><h3>DATA × MARKET</h3><small><i class="fo-blue">●</i> DATA <i class="fo-purple">●</i> MARKET</small></div><small>${m?'Cùng kèo Over '+esc(m.line)+' FT':'Chờ xác định kèo'} · xác suất thắng đủ</small>${trendChart(r.points,contract)}<small>Đổi line/nguồn hoặc thiếu dữ liệu: ngắt đường. Không nối các kèo khác nhau.</small></section>
        <section class="fo-assessment"><h3>EDGE ASSESSMENT</h3><b>${esc(r.reconciliation)}</b><p>${esc(r.synthesis)}</p><details><summary>Cơ sở nhận định</summary><p>${esc(r.data.reason)}</p><p>${r.delta===null?'Chưa đủ cơ sở so hai xác suất.':`Chênh model − thị trường: ${(r.delta*100).toFixed(1)} điểm %. Đây là khác biệt ước tính, chưa xác định bên nào đúng.`}</p>${s.model?.assumptions?.length?'<small>Model nghiên cứu: '+esc(s.model.assumptions.join(' · '))+'</small>':''}</details></section>
        <div class="fo-grid"><section class="fo-panel"><h3>BÀN CÒN LẠI</h3>${barsChart(r.modelOK&&!r.blocked?s.model.pmf:null,s.goals.home+s.goals.away,m?.line)}<small>${quote?'Thắng đủ '+pct(quote.win)+' · thắng nửa '+pct(quote.halfWin)+' · hoàn '+pct(quote.push):'Chưa có ước tính sử dụng được'}</small></section><section class="fo-panel"><h3>PRICE VALUE</h3>${priceChart(quote?.fairOdds,m?.over)}<b class="fo-ev ${quote?.ev<0?'fo-negative':''}">EV ƯỚC TÍNH ${quote?pct(quote.ev):'—'}</b><small>Giá trị thử nghiệm; chưa phải lợi thế đã kiểm chứng.</small></section></div>
        <details class="fo-details"><summary>Dữ liệu, giới hạn & lý do xếp hạng</summary><p>${esc(r.whyChange)}. ${trialRecommendations?'TOP thử nghiệm ưu tiên lợi thế EV ước tính; thứ hạng thay đổi theo dữ liệu và giá, chưa phải hiệu quả đã kiểm chứng.':'TOP hiện là thứ tự ưu tiên theo độ đầy đủ, không dùng EV chưa kiểm chứng để xếp kèo.'}</p><p>HT/FT cũ: ${esc(s.legacy?.engine||'—')} · điểm ${esc(s.legacy?.score??'—')}/100. Không quy đổi điểm này sang xác suất.</p><p>Nguồn giá: ${esc(m?.bookmaker||'—')}; thời điểm: ${m?.at?esc(new Date(m.at).toISOString()):'—'}. ${esc(m?.timestampBasis||'')}</p><p>Chưa có mô hình độc lập được kiểm định cho LIVE và cơ chế bất định. Không tự phát Push hay ghi D1.</p></details>
        <footer class="fo-footer"><small>${r.fresh?'● Dữ liệu trong cửa sổ mới':'● STALE'} · ${Math.max(0,Math.floor((now-r.at)/1000))} giây trước</small><button data-export>Xuất checkpoint</button></footer></article>`;
    }
    html+='<p class="fo-note">Bản thử riêng · HT / FT / HC và TOP gốc vẫn giữ nguyên · '+esc(VERSION)+'</p>';
    if(html!==lastHTML){const open=[...root.querySelectorAll('details')].map(x=>x.open),focus=root.contains(document.activeElement)?document.activeElement?.dataset.select:null;root.innerHTML=html;root.querySelectorAll('details').forEach((x,i)=>{x.open=!!open[i];});if(focus)root.querySelector('[data-select="'+Number(focus)+'"]')?.focus({preventScroll:true});lastHTML=html;}
    if(!demo&&!archive)try{const saved=JSON.stringify(store.export());if(saved!==lastSaved&&saved.length<1500000){sessionStorage.setItem(storageKey,saved);lastSaved=saved;}}catch{}
    refreshCount++;
  }
  const click=e=>{const b=e.target.closest('[data-select]');if(b){selected=Number(b.dataset.select);render();}if(e.target.closest('[data-export]')){
    const body=JSON.stringify({...store.export(),mode:demo?'DEMO':'SHADOW'},null,2),url=URL.createObjectURL(new Blob([body],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='FT_OVERVIEW_CHECKPOINT.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }};
  root.addEventListener('click',click);window.addEventListener('fe-notify-sync-updated',render);document.addEventListener('visibilitychange',render);
  render();const timer=setInterval(render,3000);
  return Object.freeze({read:()=>store.export(),refresh:render,select:id=>{selected=Number(id);render();},get refreshCount(){return refreshCount;},destroy:()=>{clearInterval(timer);root.removeEventListener('click',click);window.removeEventListener('fe-notify-sync-updated',render);document.removeEventListener('visibilitychange',render);}});
}
const root=document.querySelector('[data-ft-overview]');
if(root&&!root.hasAttribute('data-fo-manual'))window.FTOverviewPreview=mount(root,{demo:document.documentElement.dataset.foDemo==='true'&&new URLSearchParams(location.search).get('source')!=='bridge',trialRecommendations:document.documentElement.dataset.foTrial==='true'});
const native=document.querySelector('#ftOverviewCard');
if(native){const label=native.querySelector('.fo-native-toggle');const sync=()=>{if(label)label.textContent=native.open?'CLOSE':'OPEN';};native.addEventListener('toggle',sync);sync();}
