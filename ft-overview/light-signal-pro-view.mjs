// Light Signal Pro UI: display-only. Inputs are already-assessed FT rows.
// Never generates probability, odds, EV, picks or outcomes.
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>typeof v==='number'&&Number.isFinite(v)?(100*v).toFixed(1)+'%':'—';
const odd=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
export function lightSignalFTV2View({rows=[],selected=null,review=null,live=null}={}){
 const ranking=rows.filter(x=>x.rank).slice(0,5);
 const picked=rows.find(x=>x.id===selected)||ranking[0]||rows[0]||null;
 let html='<div class="fe-lsp"><div class="fe-lsp-header"><div><h2>FT AI V2 <span class="fe-lsp-chip">EXPERIMENTAL</span></h2><div class="fe-lsp-desc">Phân tích FT · Xác suất nền · Fair Odds · EV</div></div><span class="fe-lsp-chip">Dữ liệu từ Football Edge</span></div>';
 html+='<div class="fe-lsp-layout"><section class="fe-lsp-panel"><h3>TOP 1–5 · Tín hiệu FT</h3><div class="fe-lsp-list">';
 if(!ranking.length)html+='<div class="fe-lsp-empty">Chưa có trận đủ điều kiện để xếp TOP. Không tạo trận hoặc xác suất mẫu.</div>';
 for(const [i,x] of ranking.entries()){const s=x.snapshot||{},v=x.quote||{};html+='<button type="button" class="fe-lsp-item" data-ft-v2-select="'+esc(x.id)+'" data-active="'+(x.id===picked?.id)+'"><span class="fe-lsp-rank">'+(i+1)+'</span><span class="fe-lsp-match"><strong>'+esc(s.home)+' – '+esc(s.away)+'</strong><small>'+esc(s.league)+' · '+esc(s.minute)+'′ · '+esc(s.goals?.home)+'–'+esc(s.goals?.away)+'</small></span><span class="fe-lsp-ev" data-positive="'+(typeof v.ev==='number'&&v.ev>0)+'">'+pct(v.ev)+'</span></button>';}
 html+='</div><small class="fe-lsp-note">TOP là thứ tự của mô hình thử nghiệm, chưa phải tỷ lệ thắng đã kiểm chứng.</small></section><section class="fe-lsp-panel">';
 if(!picked){html+='<div class="fe-lsp-empty">Chờ dữ liệu của scanner hiện hành. Không tự gọi API hoặc kích hoạt quét.</div>';}
 else {
 const s=picked.snapshot||{},v=review||{},m=s.market||{},q=picked.quote||{},tone=v.action==='TRIAL_OVER'?'good':['WAIT_PRICE','MODEL_WAIT'].includes(v.action)?'wait':'neutral';
 const metrics=[['Line FT',m.line],['Giá Tài',odd(v.odds)],['Xác suất',pct(v.winProbability)],['Fair Odds',odd(v.fairOdds)],['EV',pct(v.estimatedEV)],['Hòa vốn',pct(v.breakEven)]];
 html+='<div class="fe-lsp-fixture"><span class="fe-lsp-league">'+esc(s.league)+' · '+esc(s.minute)+'′</span><span class="fe-lsp-score">'+esc(s.home)+' <b>'+esc(s.goals?.home)+' – '+esc(s.goals?.away)+'</b> '+esc(s.away)+'</span></div>';
 html+='<div class="fe-lsp-decision" data-tone="'+tone+'"><small>QUYẾT ĐỊNH · FT AI V2</small><strong>'+esc(v.title||'CHỜ DỮ LIỆU')+'</strong><small>'+esc(v.action||'DATA_WAIT')+' · Không phải xác suất đã hiệu chỉnh</small></div>';
 html+='<div class="fe-lsp-stats">'+metrics.map(([k,val])=>'<div class="fe-lsp-metric"><small>'+esc(k)+'</small><b>'+esc(val)+'</b></div>').join('')+'</div>';
 const reasons=Array.isArray(v.reason)?v.reason:[],warnings=Array.isArray(v.warnings)?v.warnings:[];
 html+='<div class="fe-lsp-sections"><details class="fe-lsp-detail" open><summary>Lý do phân tích</summary><p>'+esc(reasons.length?reasons.join(' · '):'Chưa có kết luận đủ điều kiện')+'</p></details>';
 html+='<details class="fe-lsp-detail"><summary>Dữ liệu LIVE và độ mới</summary><p>'+esc(live?.evidence?.status||'NO_WINDOW')+' · '+esc(live?.reason||'Chưa đủ thống kê')+'</p></details>';
 html+='<details class="fe-lsp-detail"><summary>Rủi ro và độ nhạy xác suất</summary><p>'+esc(warnings.join(' · ')||'Chưa có cảnh báo bổ sung')+'</p><p>EV khi xác suất thay đổi giả định ±5 điểm %: '+pct(v.sensitivity?.lowEV)+' đến '+pct(v.sensitivity?.highEV)+'. Đây không phải khoảng tin cậy.</p></details></div>';
 }
 html+='</section></div><small class="fe-lsp-note">Bản nghiên cứu: không tạo dữ liệu giả, không thay HT/HC, không tự ghi Outcome.</small></div>';
 return html;
}
