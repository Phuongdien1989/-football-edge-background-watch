import {assessHTItem} from './assess-item.mjs';
import {createHTSessionBook} from './recommendation-session.mjs';
const storageKey='FE_HT_RECOMMENDATION_SESSIONS_V1',sessionEvents=[];
let saved=null,lastSaved='';try{if(typeof localStorage!=='undefined')saved=JSON.parse(localStorage.getItem(storageKey)||'null');}catch{}
const book=createHTSessionBook({saved,onEvent:e=>{sessionEvents.push(e);if(sessionEvents.length>100)sessionEvents.shift();}});
function assessWithSession(item,context,now){
 const old=book.read(item.id),line=old&&!old.closedAt&&now<old.expiresAt?old.original.line:null;
 const row=assessHTItem(item,context,now,{line});
 const session=book.update(item,row,now);
 try{const serialized=JSON.stringify(book.export());if(typeof localStorage!=='undefined'&&serialized!==lastSaved){localStorage.setItem(storageKey,serialized);lastSaved=serialized;}}catch{}
 return {...row,session};
}
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>typeof x==='number'?(x*100).toFixed(1)+'%':'—';
const odd=x=>typeof x==='number'?x.toFixed(2):'—';
export function renderHTPricing(root,items,context,now=Date.now()) {
 const rows=(items||[]).slice(0,5).map(item=>({item,row:assessWithSession(item,context,now)}));
 const html=rows.map(({item,row:r})=>{
  const q=r.quote,model=r.model,pmf=model?.pmf||[],bins=[...pmf.slice(0,4),pmf.slice(4).reduce((a,b)=>a+b,0)],session=r.session;
  const seconds=Math.ceil((session?.remainingMs??0)/1000),clock=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  const state=session?.closedAt?session.state:r.action==='TRIAL_OVER'?'ACTIVE':r.state==='MODEL_WAIT'?'MODEL_WAIT':r.state==='WAIT_PRICE'?'WAIT_PRICE':'WAIT_DATA';
  const labels={ACTIVE:'Đang theo dõi',MODEL_WAIT:'Chờ mẫu HT',WAIT_PRICE:'Chờ giá phù hợp',WAIT_DATA:'Chờ dữ liệu mới',INVALIDATED:'Đã kết thúc',EXPIRED:'Hết phiên'};
  const reasons={SCORE_CHANGED:'Tỷ số đã thay đổi',HALF_ENDED:'Hiệp đấu đã kết thúc',RED_STATE_CHANGED:'Trạng thái thẻ đỏ thay đổi',RESET_OR_COOLDOWN:'Đang chờ xác nhận lại dữ liệu',CLOCK_CHANGED:'Đồng hồ thiết bị thay đổi',EXPIRED:'Đã hết thời gian theo dõi'};
  const sessionHTML=session?'<section class="htp-session" data-session-state="'+esc(session.state)+'"><div class="htp-session-head"><span>THEO DÕI 5 PHÚT</span><b>'+clock+'</b></div><div class="htp-progress" role="img" aria-label="Còn '+seconds+' giây"><i style="width:'+Math.max(0,Math.min(100,(session.remainingMs??0)/3000))+'%"></i></div><div class="htp-session-prices"><div><small>Giá ghi nhận · O'+esc(session.original.line)+'</small><b>@'+odd(session.original.odds)+'</b></div><div><small>Giá hiện tại</small><b>'+(r.marketOK?'@'+odd(r.recommendation.odds):'—')+'</b></div></div><p>'+(session.closedAt?esc(reasons[session.closeReason]||'Phiên đã kết thúc'):session.state==='WAIT_DATA'?'Tạm chờ dữ liệu mới; giữ nguyên mốc ban đầu.':session.state==='WAIT_PRICE'?'Giữ mốc ban đầu; giá hiện tại chưa phù hợp.':'Giữ mốc ban đầu · đánh giá lại theo dữ liệu mới.')+'</p></section>':'';
  const chart=model?'<div class="htp-chart" role="img" aria-label="Phân phối nghiên cứu số bàn HT còn lại">'+bins.map((p,i)=>'<div><span>'+pct(p)+'</span><i style="height:'+Math.max(2,p*80)+'px"></i><small>'+(i===4?'4+':i)+' bàn</small></div>').join('')+'</div>':'<p class="htp-wait">Chưa đủ lịch sử tỷ số HT của cả hai đội. Không suy ra xác suất từ điểm sức ép.</p>';
  const binaryLine=q&&Math.abs((r.recommendation.line%1)-.5)<1e-8;
  const comparison=binaryLine?'<div class="htp-comparison" aria-label="So sánh xác suất của cùng kèo HT">'+[['Mô hình thắng kèo',q.win,'model'],['Hòa vốn tại giá '+odd(r.recommendation.odds),1/r.recommendation.odds,'price']].map(([label,p,type])=>'<div class="htp-bar-row"><span>'+esc(label)+'</span><div class="htp-bar"><i class="htp-'+type+'" style="width:'+Math.max(0,Math.min(100,p*100))+'%"></i></div><b>'+pct(p)+'</b></div>').join('')+'</div>':'';
  const note=session?.closedAt?'Phiên cũ đã kết thúc. Chờ đánh giá mới từ dữ liệu hợp lệ.':q?(q.ev>0?'Giá có lợi theo mô hình nền; cần đối chiếu diễn biến trận.':'Giá hiện tại chưa có lợi theo mô hình nền.'):r.state==='MODEL_WAIT'?'Chờ lịch sử HT của hai đội để định giá độc lập.':'Chờ dữ liệu và giá cùng tỷ số, cùng thời điểm.';
  const league=item.latest?.fixture?.league,name=league?.name||(typeof item.league==='string'?item.league:item.league?.name),country=league?.country||item.country;
  const leagueText=name?[name,country].filter(x=>typeof x==='string'&&x.trim()).join(' · '):'Giải đấu chưa xác định';
  return '<article class="htp-card" data-htp-id="'+esc(item.id)+'" data-state="'+state+'"><header><span class="htp-eyebrow">HT INTELLIGENCE</span><span class="htp-trial">Thử nghiệm</span></header><h3>'+esc(item.home)+' – '+esc(item.away)+'</h3>'+
   '<p class="htp-league">'+esc(leagueText)+'</p>'+
   '<div class="htp-game"><span>'+esc(item.latest?.status==='LIVE'?'1H':item.latest?.status)+' · '+esc(item.latest?.minute)+'′</span><b>'+esc(item.latest?.goals?.home)+' – '+esc(item.latest?.goals?.away)+'</b></div>'+
   '<div class="htp-decision"><div><h4>'+(r.marketOK?'TÀI HIỆP 1 · '+esc(r.recommendation.line):'TÀI HIỆP 1')+'</h4><strong class="htp-odds">'+(r.marketOK?'@ '+odd(r.recommendation.odds):'Chờ giá HT')+'</strong></div><span class="htp-state">'+labels[state]+'</span><p>'+note+'</p></div>'+
   comparison+'<div class="htp-values"><div><small>Giá hợp lý ước tính</small><b>'+odd(q?.fairOdds)+'</b></div><div><small>EV mô hình</small><b class="'+(q?.ev>0?'htp-positive':'')+'">'+(q?.ev>0?'+':'')+pct(q?.ev)+'</b></div><div><small>Mẫu HT · H / A</small><b>'+esc(model?.sample.home??0)+' / '+esc(model?.sample.away??0)+'</b></div></div>'+
   sessionHTML+'<details><summary>Chi tiết dữ liệu & định giá</summary>'+chart+'<p>Ước tính thử nghiệm, chưa được kiểm chứng hiệu quả dự báo. Mô hình dùng tỷ số HT lịch sử và số bàn đã ghi; chưa điều chỉnh theo sức mạnh đối thủ, sức ép hay thẻ đỏ. Bù giờ chưa được ước lượng.</p><p>Mẫu mỗi đội tối đa 8 trận. Giá hợp lý và EV phụ thuộc mô hình; không bảo đảm kết quả. Hòa vốn là nghịch đảo giá của kèo nửa bàn, không phải xác suất thị trường đã loại biên. Kèo nguyên và phần tư bàn dùng định giá theo quy tắc hoàn tiền/thắng thua từng phần, không quy thành xác suất nhị phân.</p>'+
   '<p>Số trận lịch sử riêng biệt: '+esc(model?.sample.unique??0)+'. Thống kê quan sát tại '+esc(item.latest?.fresh_at?new Date(item.latest.fresh_at).toLocaleTimeString('vi-VN'):'—')+'.</p>'+
   '<p>'+esc(r.contextError||r.warnings.join(' · '))+'</p>'+(session?.closedAt?'<p>Mã kết thúc: '+esc(session.closeReason)+'</p>':'')+'</details><p class="htp-disclaimer">Ước tính thử nghiệm · chưa kiểm chứng hiệu quả dự báo.</p></article>';
 }).join('');
 if(root.innerHTML!==html){const opened=new Set([...root.querySelectorAll('.htp-card')].filter(c=>c.querySelector('details')?.open).map(c=>c.dataset.htpId));root.innerHTML=html;for(const c of root.querySelectorAll('.htp-card'))if(opened.has(c.dataset.htpId))c.querySelector('details').open=true;}
 return rows.map(x=>x.row);
}
let queued=false,lastData=[];
function update() {
 const bridge=window.FEHTCandidateBridge,mode=window.FETabsIntegrated?.mode?.();
 if(!bridge||!mode?.enabled||mode.current!=='ht')return;
 const data=bridge.read(),body=document.querySelector('#feTabsWorkspace .ftabs-content');
 if(!body)return;
 const items=(data.items||[]).slice(0,5),rows=items.map(item=>({item,row:assessWithSession(item,data.context,Date.now())}));lastData=rows.map(x=>x.row);
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
 window.FEHTPricingView=Object.freeze({read:()=>structuredClone(lastData),sessions:()=>book.export(),events:()=>structuredClone(sessionEvents),refresh:schedule});
 // Display/session expiry only. This timer performs no API or D1 requests.
 setInterval(()=>{if(document.visibilityState==='visible')schedule();},1000);schedule();
}

