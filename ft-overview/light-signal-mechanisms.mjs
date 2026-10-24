// Pure shared view for existing Overview, HT, FT, HC and FT Overview.
// Never evaluates, ranks, mutates, requests or synthesizes a signal.
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
const percent=v=>typeof v==='number'&&Number.isFinite(v)?(v*100).toFixed(1)+'%':'—';
const clock=at=>at?new Date(at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—';
const titles={overview:'Tổng quan tín hiệu',ht:'HT Goals',ft:'FT Goals',hc:'Handicap',valuation:'FT Overview'};
const labels={overview:'TOP 5 chung từ engine hiện hành',ht:'Tín hiệu Hiệp 1',ft:'Tín hiệu Cả trận',hc:'Kèo châu Á',valuation:'Định giá FT'};
const signalOf=(x,tab)=>tab==='overview'?x.signals[x.masterPrimary]||Object.values(x.signals)[0]:x.signals[tab];
const action=(s,fn)=>s?fn(s,Date.now(),'BRIDGE'):'Chờ dữ liệu';
function metricsFor(s){
 const o=s.observation||{},vals=[];
 if(s.engine==='valuation')vals.push(['Line FT',s.line],['Giá Tài',number(s.odds)],['Fair Odds',number(s.fairOdds)],['EV',percent(s.ev)],['Model',s.modelOK?'Có':'Chưa đủ'],['Giá cập nhật',clock(s.marketAt)]);
 else vals.push(['Trạng thái',s.state||'—'],[s.engine==='hc'?'Live Gap':'Engine Score',number(s.engine==='hc'?s.gap:s.score)],['Sút trúng đích',o.metrics?.sot],['Tổng cú sút',o.metrics?.shots],['xG nguồn',number(o.metrics?.xg)],['Lần cập nhật',clock(o.at)]);
 return vals.map(([label,value])=>'<div class="fe-lsp-metric"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>').join('');
}
export function renderSignalMechanism({tab,rows=[],chosen=null,fixture=null,packet,route,displayAction}){
 if(!titles[tab])throw Error('UNKNOWN_MECHANISM_'+tab);
 const heading=titles[tab],focus=chosen?signalOf(chosen,tab):null;
 const ordered=tab==='overview'?rows.slice(0,5):rows.slice(0,5);
 let h='<div class="fe-lsp fe-lsp-mechanism"><div class="fe-lsp-header"><div><h2>'+heading+'</h2><div class="fe-lsp-desc">'+labels[tab]+' · Dữ liệu hiện hành</div></div><span class="fe-lsp-chip">'+rows.length+' trận</span></div>';
 h+='<div class="fe-lsp-layout"><section class="fe-lsp-panel"><h3>TOP 1–5 · Danh sách tín hiệu</h3><div class="fe-lsp-list">';
 if(!ordered.length)h+='<div class="fe-lsp-empty">Chưa có tín hiệu trong nguồn hiện hành. Không tự tạo thứ hạng hoặc dữ liệu trận.</div>';
 for(const [i,x] of ordered.entries()){const s=signalOf(x,tab),o=s?.observation||{},rank=tab==='overview'?x.masterRank:s?.rank;
  const marker=rank&&rank<=5?'TOP '+rank:'Mục '+(i+1);
  h+='<a class="fe-lsp-item" href="'+esc(route(tab,x.id))+'" data-active="'+(x.id===chosen?.id)+'"><span class="fe-lsp-rank">'+esc(rank&&rank<=5?rank:i+1)+'</span><span class="fe-lsp-match"><strong>'+esc(o.home)+' – '+esc(o.away)+'</strong><small>'+esc(o.league)+' · '+esc(o.minute)+'′ · '+esc(o.goals?.home)+'–'+esc(o.goals?.away)+'</small></span><span class="fe-lsp-ev">'+esc(marker)+'</span></a>';
 }
 h+='</div><small class="fe-lsp-note">Thứ tự nguồn được giữ nguyên. Danh sách TOP không tự xếp lại theo điểm số.</small></section><section class="fe-lsp-panel">';
 if(fixture&&!focus)h+='<div class="fe-lsp-empty">Trận này không còn trong dữ liệu nguồn hiện hành.</div><a class="ftabs-back" href="'+esc(route(tab))+'">← Trở lại danh sách</a>';
 else if(!focus)h+='<div class="fe-lsp-empty">Chọn trận trong TOP để xem nhận định và chỉ số từ engine hiện hành.</div>';
 else {const o=focus.observation||{},label=action(focus,displayAction);
 h+='<div class="fe-lsp-fixture"><span class="fe-lsp-league">'+esc(o.league)+' · '+esc(o.minute)+'′ · '+esc(o.status)+'</span><span class="fe-lsp-score">'+esc(o.home)+' <b>'+esc(o.goals?.home)+' – '+esc(o.goals?.away)+'</b> '+esc(o.away)+'</span></div>';
 h+='<div class="fe-lsp-decision" data-tone="neutral"><small>QUYẾT ĐỊNH · NGUỒN '+esc(heading)+'</small><strong>'+esc(label)+'</strong><small>'+esc(focus.freshness)+' · '+esc(focus.source)+'</small></div>';
 h+='<div class="fe-lsp-stats">'+metricsFor(focus)+'</div>';
 h+='<div class="fe-lsp-sections"><details class="fe-lsp-detail" open><summary>Lý do phân tích</summary><p>'+esc(focus.reason||'Nguồn chưa cung cấp lý do')+'</p></details><details class="fe-lsp-detail"><summary>Dữ liệu và độ mới</summary><p>Ghi nhận: '+esc(clock(o.at))+' · '+esc(focus.freshness)+'</p></details><details class="fe-lsp-detail"><summary>Công cụ gốc</summary><p>Phần số liệu, biểu đồ và chức năng đang có được bảo toàn trong công cụ gốc.</p></details></div>';
 h+='<a class="ftabs-back" href="'+esc(route(tab))+'">← Về danh sách</a>';
 }
 if(['ht','ft','hc','valuation','overview'].includes(tab))h+='<div class="fe-lsp-original"><button type="button" data-ftabs-tools aria-label="Mở công cụ và khuyến nghị gốc">Xem khuyến nghị / định giá gốc ↗</button><small>Hiện thông tin Tài/Xỉu và giá kèo từ công cụ gốc khi có dữ liệu. Giao diện này không tính lại kèo.</small></div>';
 h+='</section></div><small class="fe-lsp-note">Giao diện Light Signal Pro chỉ trình bày kết luận có sẵn. Không thay đổi engine, scanner, TOP hoặc Push.</small></div>';
 return h;
}
