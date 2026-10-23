// Pure string templates for standalone FT V2 mobile preview. No fetch,
// storage, global window mutation or legacy HT/HC engine calls.
import {normalizeFTPreviewPacket} from './read-model.mjs';
import {reviewFTTotalPrice} from '../ft-audit-fix/ft-total-settlement.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const fixed=(v,d=2)=>num(v)===null?'—':v.toFixed(d);
const pct=(v,d=1)=>num(v)===null?'—':(v*100).toFixed(d)+'%';
const signed=v=>num(v)===null?'—':(v>=0?'+':'')+(v*100).toFixed(1)+'%';
const label=v=>v==='OVER'?'TÀI':v==='UNDER'?'XỈU':'CHỜ ĐỊNH GIÁ';
const lineText=v=>num(v)===null?'—':String(v);
const timeLabel=at=>num(at)===null?'—':new Date(at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'});
const isDemo=p=>p.mode==='DEMO'&&p.demo===true;
const meter=(v,klass)=>'<div class="ftv2-meter"><span class="'+klass+'" style="width:'+Math.max(0,Math.min(100,num(v)===null?0:v*100)).toFixed(1)+'%"></span></div>';
function header(p,view){
 return `<div class="ftv2-demo-banner">${isDemo(p)?'BẢN DEMO • SỐ LIỆU GIẢ LẬP — KHÔNG PHẢI KHUYẾN NGHỊ CƯỢC':'READ ONLY • FT V2 CHƯA PHÁT HÀNH KHUYẾN NGHỊ THẬT'}</div>
 <header class="ftv2-header"><div><span class="ftv2-logo">FE</span><div><strong>Football Edge</strong><small>DATA · MODEL · MARKET · EDGE</small></div></div><span class="ftv2-header-tag">FT AI V2 · PREVIEW</span></header>
 <nav class="ftv2-mechanisms" aria-label="Các cơ chế Football Edge"><span>Overview</span><span>HT Goals</span><span class="active">FT Goals</span><span>Handicap</span><span>FT Overview</span></nav>
 <div class="ftv2-context"><span>FT AI V2</span><span>${view==='detail'?'Chi tiết trận':'Danh sách & TOP FT'}</span></div>`;
}
function footer(){
 return '<footer class="ftv2-footer"><span>⌂<small>Trang chủ</small></span><span class="active">▥<small>FT Goals</small></span><span>☆<small>TOP</small></span><span>♧<small>Theo dõi</small></span><span>⚙<small>Cài đặt</small></span></footer>';
}
function tags(row,demo){
 const rank=demo&&Number.isInteger(row.recommendation?.rank)?'<span class="ftv2-rank">TOP '+row.recommendation.rank+'</span>':'<span class="ftv2-rank neutral">CHƯA XẾP HẠNG</span>';
 const age=row.quote?.received_at&&row.decision_at-row.quote.received_at>300000?' <span class="ftv2-rank warn">GIÁ CŨ</span>':'';
 return rank+' '+(demo?'<span class="ftv2-rank demo">DEMO</span>':'<span class="ftv2-rank neutral">CHỜ MODEL</span>')+age;
}
function card(row,p){
 const demo=isDemo(p),quote=row.quote,rec=row.recommendation,shown=demo&&rec?.side;
 const pick=shown?`${label(rec.side)} ${lineText(rec.line)} @${fixed(rec.odds)}`:
  quote?`FT Tài/Xỉu ${lineText(quote.line)}`:'Đang chờ giá FT hợp lệ';
 return `<article class="ftv2-match-card">
 <div class="ftv2-match-league"><span>${esc(row.country?row.country+' · ':'')}${esc(row.league)}</span><span class="ftv2-live">${esc(row.state||'LIVE')} ${esc(row.minute)}′</span></div>
 <div class="ftv2-scoreline"><span class="ftv2-team">${esc(row.home)}</span><strong>${esc(row.home_goals)} – ${esc(row.away_goals)}</strong><span class="ftv2-team right">${esc(row.away)}</span></div>
 <div class="ftv2-card-mid"><div><small>${shown?'KÈO MINH HỌA':quote?'GIÁ NHÀ CÁI (CHƯA KHUYẾN NGHỊ)':'FT AI V2'}</small>
 <b>${esc(pick)}</b><span class="ftv2-subline">${quote?'O '+fixed(quote.over_odds)+' · U '+fixed(quote.under_odds):'Chờ cặp giá Over/Under đã xác minh'}</span></div>
 <div class="ftv2-ev ${shown&&num(rec.ev)>=0?'positive':'neutral'}"><small>${shown?'EV DEMO':'EV THỰC TẾ'}</small><strong>${shown?signed(rec.ev):'—'}</strong></div></div>
 <div class="ftv2-card-foot"><div>${tags(row,demo)}</div><button type="button" data-ft-open="${row.id}" aria-label="Xem chi tiết FT trận ${esc(row.home)} - ${esc(row.away)}">Chi tiết <span aria-hidden="true">→</span></button></div>
 </article>`;
}
function listView(rows,p,filter){
 const items=filter==='all'?rows:rows.filter(r=>isDemo(p)&&r.recommendation?.side===filter);
 const buttons=[['all','Tất cả'],['OVER','Tài'],['UNDER','Xỉu']].map(([v,name])=>`<button type="button" data-ft-filter="${v}" aria-pressed="${filter===v}">${name}</button>`).join('');
 return `<section class="ftv2-list-head"><div><h1>FT AI V2 <span>· ${isDemo(p)?'DEMO':'THỬ NGHIỆM'}</span></h1><p>${isDemo(p)?'5 trận giả lập để duyệt cách hiển thị':'Các trận có dữ liệu FT xác minh; chưa phát khuyến nghị V2'}</p></div><span class="ftv2-count">${rows.length} TRẬN</span></section>
 <div class="ftv2-filter">${buttons}</div>
 <section class="ftv2-list" aria-label="Danh sách trận FT">${items.length?items.map(r=>card(r,p)).join(''):'<div class="ftv2-empty">Chưa có trận đủ dữ liệu trong nhóm này. Không tự thêm trận hoặc tạo kèo.</div>'}</section>
 <p class="ftv2-note">Giá thị trường không đồng nghĩa lợi thế. Chỉ hiển thị EV và xếp TOP thật sau khi mô hình FT được kiểm chứng.</p>`;
}
function keyMetrics(row,demo){
 const rec=row.recommendation,model=row.model,quote=row.quote,side=rec.side;
 const fair=side==='UNDER'?model.fair_under:model.fair_over;
 const ev=demo?rec.ev:null;
 return `<div class="ftv2-valuation-hero"><div class="ftv2-eyebrow">ĐỊNH GIÁ FT ${demo?'· VÍ DỤ GIẢ LẬP':'· CHƯA KÍCH HOẠT'}</div>
 <div class="ftv2-big-pick">${demo&&side?esc(label(side)+' '+lineText(rec.line)):'CHỜ MÔ HÌNH FT ĐƯỢC KIỂM CHỨNG'}</div>
 <div class="ftv2-stat-grid">
 <div><small>Giá nhà cái</small><strong>${quote&&side?fixed(side==='OVER'?quote.over_odds:quote.under_odds):quote?fixed(quote.over_odds)+' / '+fixed(quote.under_odds):'—'}</strong></div>
 <div><small>Giá AI (fair)</small><strong>${demo?fixed(fair):'—'}</strong></div>
 <div><small>EV ${demo?'DEMO':'THỰC TẾ'}</small><strong class="${num(ev)>=0&&demo?'ftv2-green':''}">${demo?signed(ev):'—'}</strong></div>
 </div><p class="ftv2-valuation-note">${demo?'Tính toán từ xác suất giả lập để duyệt card. Không dùng để vào cược.':'Chỉ ghi nhận giá thị trường khi nguồn hợp lệ; chưa suy diễn xác suất từ điểm Goal Radar.'}</p></div>`;
}
function graph(rows,title){
 const max=Math.max(1,...rows.map(r=>r.probability));
 return `<section class="ftv2-panel"><h3>${title}</h3><p class="ftv2-subheading">Tỷ lệ từng tổng bàn chung cuộc, không phải tỷ lệ điểm tín hiệu</p>
 <div class="ftv2-bars" role="img" aria-label="${esc(rows.map(x=>x.finalTotalGoals+': '+pct(x.probability,0)).join(', '))}">
 ${rows.map(r=>`<div class="ftv2-bar-group"><span class="ftv2-bar-value">${pct(r.probability,0)}</span><span class="ftv2-bar-track"><span class="ftv2-bar-fill" style="height:${Math.max(2,100*r.probability/max).toFixed(1)}%"></span></span><small>${esc(r.finalTotalGoals>=6?'6+':r.finalTotalGoals)}</small></div>`).join('')}
 </div></section>`;
}
function timeline(history){
 const points=Array.isArray(history)?history.filter(r=>num(r.minute)!==null&&num(r.score)!==null&&r.score>=0&&r.score<=100).slice(-30):[];
 if(points.length<2)return '<div class="ftv2-empty small">Chưa đủ chuỗi tín hiệu trước quyết định để vẽ diễn biến.</div>';
 const minX=Math.min(...points.map(x=>x.minute)),maxX=Math.max(...points.map(x=>x.minute));
 const width=320,height=110;
 const path=points.map((r,j)=>{
  const x=16+((r.minute-minX)/Math.max(1,maxX-minX))*(width-32);
  const y=height-14-(r.score/100)*(height-28);
  return (j?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
 }).join(' ');
 return `<svg class="ftv2-trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="Diễn biến điểm tín hiệu Goal Radar FT, không phải xác suất bàn thắng"><path d="${path}"/></svg>
 <div class="ftv2-graph-range"><span>${minX}′</span><span>${maxX}′</span></div>`;
}
function chartTab(row,demo){
 const p=demo&&Array.isArray(row.model?.pmf)?row.model.pmf:null;
 return `${p?graph(p,'Phân phối tổng bàn FT (minh họa)'):'<section class="ftv2-panel"><h3>Phân phối tổng bàn FT</h3><div class="ftv2-empty small">Đang chờ xác suất tổng bàn FT được kiểm chứng. Không dùng điểm Goal Radar để dựng biểu đồ xác suất.</div></section>'}
 <section class="ftv2-panel"><h3>Diễn biến điểm tín hiệu FT</h3><p class="ftv2-subheading">Điểm tín hiệu FT không phải xác suất bàn thắng hay xác suất Tài/Xỉu.</p>${timeline(row.history)}</section>`;
}
function pricingTab(row,demo){
 const quote=row.quote,pmf=demo?row.model?.pmf:null,lines=[2,2.25,2.5,2.75,3,3.25,3.5];
 const times={modelReceivedAt:row.decision_at-180000,marketReceivedAt:row.decision_at-60000,decisionAt:row.decision_at,modelVersion:'DEMO_ONLY'};
 const recPrice=(line,side)=>!Array.isArray(pmf)?null:reviewFTTotalPrice({...times,line,side,decimalOdds:2,distribution:pmf});
 const trows=lines.map(line=>{
  const o=recPrice(line,'OVER'),u=recPrice(line,'UNDER'),
   chosen=quote?.line===line,evO=chosen&&demo?row.model.ev_over:null,evU=chosen&&demo?row.model.ev_under:null;
  return `<tr class="${chosen?'ftv2-highlight':''}"><td>${line}</td><td>${demo?fixed(o?.fair_decimal_odds):'—'}</td><td>${demo?fixed(u?.fair_decimal_odds):'—'}</td><td>${chosen?fixed(quote.over_odds)+' / '+fixed(quote.under_odds):'—'}</td><td class="${num(evO)>=0&&demo?'ftv2-green':''}">${demo&&chosen?signed(evO):'—'}</td><td>${demo&&chosen?signed(evU):'—'}</td></tr>`;
 }).join('');
 return `<section class="ftv2-panel"><h3>Bảng định giá theo mốc kèo ${demo?'(DEMO)':''}</h3><div class="ftv2-scroll"><table class="ftv2-table"><thead><tr><th>Line</th><th>AI Tài</th><th>AI Xỉu</th><th>Giá NC O/U</th><th>EV O</th><th>EV U</th></tr></thead><tbody>${trows}</tbody></table></div>
 <p class="ftv2-subheading">${demo?'Giá AI và EV minh họa từ phân phối giả lập, không phải mô hình đã nghiệm thu.':'Không có mô hình đã hiệu chỉnh: fair odds và EV được để trống có chủ đích.'}</p></section>
 <section class="ftv2-panel"><h3>Độ tin cậy nguồn</h3><div class="ftv2-source-row"><span>Giá Over/Under</span><strong>${quote?demo?'Minh họa':'Đối chiếu API gốc':'Chưa có cặp giá hợp lệ'}</strong></div><div class="ftv2-source-row"><span>Giờ nhận giá</span><strong>${quote?timeLabel(quote.received_at):'—'}</strong></div><div class="ftv2-source-row"><span>Mô hình tổng bàn</span><strong>Chưa hiệu chỉnh</strong></div></section>`;
}
function historyTab(row,demo){
 const records=Array.isArray(row.history)?row.history:[];
 return `<section class="ftv2-panel"><h3>Lịch sử ghi nhận FT</h3><p class="ftv2-subheading">Chỉ hiển thị các snapshot đã nhận; không điền thêm thời điểm còn thiếu.</p>
 ${records.length?`<div class="ftv2-scroll"><table class="ftv2-table"><thead><tr><th>Phút</th><th>Nhận lúc</th><th>Điểm FT</th><th>Kết quả</th></tr></thead><tbody>${records.slice(-12).reverse().map(x=>`<tr><td>${esc(x.minute)}′</td><td>${timeLabel(x.at)}</td><td>${num(x.score)===null?'—':fixed(x.score,0)+'/100'}</td><td>Chưa quyết toán</td></tr>`).join('')}</tbody></table></div>`:'<div class="ftv2-empty small">Chưa có lịch sử snapshot hợp lệ.</div>'}</section>`;
}
function factors(row,demo){
 const factors=[['Tỷ số hiện tại',row.home_goals+'–'+row.away_goals],
  ['Phút thi đấu',row.minute+'′'],['Giá FT',''+(row.quote?'Có cặp O/U':'Đang chờ')],
  ['Dữ liệu mô hình',demo?'Giả lập':'Chưa kiểm chứng']];
 return `<section class="ftv2-panel"><h3>Các yếu tố đang được theo dõi</h3><div class="ftv2-factor-grid">${factors.map(([a,b])=>`<div><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join('')}</div>
 <p class="ftv2-subheading">Chưa xác minh đóng góp định lượng riêng của từng yếu tố; không hiển thị tỷ lệ ảnh hưởng tự tạo.</p></section>`;
}
function detailView(row,p,tab){
 const demo=isDemo(p);
 const tabs=[['summary','Tổng quan'],['chart','Biểu đồ'],['pricing','Định giá'],['history','Lịch sử']];
 const selected=tabs.some(x=>x[0]===tab)?tab:'summary';
 return `<button type="button" class="ftv2-back" data-ft-back="true">← Trở về danh sách FT</button>
 <section class="ftv2-detail-head"><div class="ftv2-match-league">${esc(row.country?row.country+' · ':'')}${esc(row.league)} <span class="ftv2-live">${esc(row.minute)}′</span></div>
 <div class="ftv2-scoreline"><span class="ftv2-team">${esc(row.home)}</span><strong>${esc(row.home_goals)} – ${esc(row.away_goals)}</strong><span class="ftv2-team right">${esc(row.away)}</span></div>
 <div class="ftv2-detail-flag">${tags(row,demo)}</div></section>
 <nav class="ftv2-detail-tabs" aria-label="Phần phân tích FT">${tabs.map(([v,l])=>`<button data-ft-subtab="${v}" type="button" aria-pressed="${selected===v}">${l}</button>`).join('')}</nav>
 ${selected==='summary'?keyMetrics(row,demo)+factors(row,demo)+chartTab(row,demo):selected==='chart'?chartTab(row,demo):selected==='pricing'?pricingTab(row,demo):historyTab(row,demo)}
 <p class="ftv2-note">FT AI V2 chỉ là bản xem trước. HT/HC/TOP, scanner, Push và Mobile production không bị thay đổi.</p>`;
}
export function renderFTScreen(input,{selectedId=null,tab='summary',filter='all',demo=false}={}){
 const p=normalizeFTPreviewPacket(input,{demo});
 const row=p.rows.find(x=>x.id===selectedId);
 const main=row?detailView(row,p,tab):listView(p.rows,p,filter);
 return `<div class="ftv2-app" data-ft-mode="${p.mode}" data-ft-screen="${row?'detail':'list'}">${header(p,row?'detail':'list')}<main class="ftv2-main">${main}</main>${footer()}</div>`;
}
export function mountFTPreview(root,{packet,demo=false}={}){
 if(!root||typeof root.innerHTML!=='string')throw Error('FT_ROOT_REQUIRED');
 const state={selectedId:null,tab:'summary',filter:'all'};
 const refresh=()=>root.innerHTML=renderFTScreen(packet,{...state,demo});
 function click(event){
  const element=event.target?.closest?.('[data-ft-open],[data-ft-back],[data-ft-subtab],[data-ft-filter]');
  if(!element||!root.contains(element))return;
  if(element.hasAttribute('data-ft-open')){state.selectedId=Number(element.dataset.ftOpen);state.tab='summary';}
  if(element.hasAttribute('data-ft-back')){state.selectedId=null;state.tab='summary';}
  if(element.hasAttribute('data-ft-subtab'))state.tab=element.dataset.ftSubtab;
  if(element.hasAttribute('data-ft-filter'))state.filter=element.dataset.ftFilter;
  refresh();
 }
 root.addEventListener('click',click);
 refresh();
 return {refresh,dispose(){root.removeEventListener('click',click);},getState(){return {...state};}};
}
