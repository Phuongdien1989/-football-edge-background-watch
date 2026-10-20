import {assessHTItem} from './assess-item.mjs';
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>typeof x==='number'?(x*100).toFixed(1)+'%':'—';
const odd=x=>typeof x==='number'?x.toFixed(2):'—';
export function renderHTPricing(root,items,context,now=Date.now()) {
 const rows=(items||[]).slice(0,5).map(item=>({item,row:assessHTItem(item,context,now)}));
 const html=rows.map(({item,row:r})=>{
  const q=r.quote,model=r.model,pmf=model?.pmf||[],bins=[...pmf.slice(0,4),pmf.slice(4).reduce((a,b)=>a+b,0)];
  const action=r.action==='TRIAL_OVER'?'TRIAL OVER':r.state==='MODEL_WAIT'?'MODEL WAIT':r.state==='WAIT_PRICE'?'WAIT PRICE':'WAIT DATA';
  const chart=model?'<div class="htp-chart" role="img" aria-label="Phân phối nghiên cứu số bàn HT còn lại">'+bins.map((p,i)=>'<div><span>'+pct(p)+'</span><i style="height:'+Math.max(2,p*80)+'px"></i><small>'+(i===4?'4+':i)+' bàn</small></div>').join('')+'</div>':'<p class="htp-wait">Chưa đủ lịch sử tỷ số HT của cả hai đội. Không suy ra xác suất từ điểm sức ép.</p>';
  return '<article class="htp-card" data-htp-id="'+esc(item.id)+'"><header><div><small>HT GOALS · RESEARCH</small><h3>'+esc(item.home)+' – '+esc(item.away)+'</h3></div><b class="htp-state">'+action+'</b></header>'+
   '<div class="htp-game">'+esc(item.latest?.minute)+'′ · '+esc(item.latest?.goals?.home)+'–'+esc(item.latest?.goals?.away)+'<span>Mẫu HT: H '+esc(model?.sample.home??0)+'/8 · A '+esc(model?.sample.away??0)+'/8</span></div>'+
   '<div class="htp-values"><div><small>LINE / GIÁ</small><b>'+(r.marketOK?'O'+esc(r.recommendation.line)+' @'+odd(r.recommendation.odds):'Chờ giá HT')+'</b></div><div><small>GIÁ CÔNG BẰNG ƯỚC TÍNH</small><b>'+odd(q?.fairOdds)+'</b></div><div><small>EV NGHIÊN CỨU</small><b>'+pct(q?.ev)+'</b></div></div>'+
   chart+'<p class="htp-note">'+(q?(q.ev>0?'Giá có lợi theo mô hình nền; cần đối chiếu diễn biến trận.':'Giá hiện tại chưa có lợi theo mô hình nền.'):r.state==='MODEL_WAIT'?'Chờ dữ liệu HT độc lập để định giá.':'Chờ dữ liệu và giá cùng tỷ số, cùng thời điểm.')+'</p>'+
   '<details><summary>Dữ liệu & giới hạn</summary><p>Ước tính thử nghiệm, chưa được kiểm chứng hiệu quả dự báo. Mô hình dùng tỷ số HT lịch sử và số bàn đã ghi; chưa điều chỉnh theo sức mạnh đối thủ, sức ép hay thẻ đỏ. Bù giờ chưa được ước lượng.</p>'+
   '<p>Số trận lịch sử riêng biệt: '+esc(model?.sample.unique??0)+'. Thống kê quan sát tại '+esc(item.latest?.fresh_at?new Date(item.latest.fresh_at).toLocaleTimeString('vi-VN'):'—')+'.</p>'+
   '<p>'+esc(r.contextError||r.warnings.join(' · '))+'</p></details></article>';
 }).join('');
 if(root.innerHTML!==html)root.innerHTML=html;
 return rows.map(x=>x.row);
}
let queued=false,lastData=[];
function update() {
 const bridge=window.FEHTCandidateBridge,mode=window.FETabsIntegrated?.mode?.();
 if(!bridge||!mode?.enabled||mode.current!=='ht')return;
 const data=bridge.read(),body=document.querySelector('#feTabsWorkspace .ftabs-content');
 if(!body)return;
 const items=(data.items||[]).slice(0,5),rows=items.map(item=>({item,row:assessHTItem(item,data.context,Date.now())}));lastData=rows.map(x=>x.row);
 for(const link of body.querySelectorAll('[data-ftabs-fixture]')) {
   const found=rows.find(x=>x.item.id===Number(link.dataset.ftabsFixture));if(!found)continue;
   const target=link.querySelector('.ftabs-signal');if(!target)continue;
   let badge=target.querySelector('[data-ht-price]');
   if(!badge){badge=document.createElement('small');badge.dataset.htPrice='true';target.append(badge);}
   badge.textContent=found.row.quote?'HT O'+found.row.recommendation.line+' · fair '+odd(found.row.quote.fairOdds)+' · '+(found.row.action==='TRIAL_OVER'?'TRIAL':'WAIT'):found.row.state==='MODEL_WAIT'?'HT model: chờ mẫu HT':'HT: chờ giá / dữ liệu';
 }
 if(mode.fixture) {
   const item=items.find(x=>x.id===mode.fixture),detail=body.querySelector('.ftabs-detail');
   if(item&&detail){let root=detail.querySelector('[data-ht-pricing]');if(!root){root=document.createElement('section');root.dataset.htPricing='true';detail.append(root);}renderHTPricing(root,[item],data.context);}
 }
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update();});}
if(typeof document!=='undefined'&&typeof window!=='undefined') {
 for(const name of ['hashchange','fe-notify-sync-updated','fe-ht-context-updated'])window.addEventListener(name,schedule);
 const body=document.querySelector('#feTabsWorkspace .ftabs-content');if(body)new MutationObserver(schedule).observe(body,{childList:true});
 const list=document.getElementById('h1WatchList');if(list)new MutationObserver(schedule).observe(list,{childList:true,subtree:true});
 window.FEHTPricingView=Object.freeze({read:()=>structuredClone(lastData),refresh:schedule});schedule();
}
