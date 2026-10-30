import {matchIdentity,outlook,factTiles,probabilityRail,directions,priceDecision} from '../ui-common/signal-visual.mjs';
// Light Signal Pro UI: display-only. Inputs are already-assessed FT rows.
// Never generates probability, odds, EV, picks or outcomes.
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=v=>typeof v==='number'&&Number.isFinite(v)?(100*v).toFixed(1)+'%':'—';
const odd=v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(2):'—';
export function lightSignalFTV2View({rows=[],selected=null,review=null,live=null,session=null,now=Date.now()}={}){
 const ranking=rows.filter(x=>x.rank).slice(0,5);
 const picked=rows.find(x=>x.id===selected)||ranking[0]||rows[0]||null;
 let html='<div class="fe-lsp"><div class="fe-lsp-header"><div><h2>FT AI V2 <span class="fe-lsp-chip">EXPERIMENTAL</span></h2><div class="fe-lsp-desc">Phân tích FT · Tỷ số & thời gian · Fair Odds · EV</div></div><span class="fe-lsp-chip">Dữ liệu từ Football Edge</span></div>';
 html+='<div class="fe-lsp-layout"><section class="fe-lsp-panel"><h3>TOP 1–5 · Tín hiệu FT</h3><div class="fe-lsp-list">';
 if(!ranking.length)html+='<div class="fe-lsp-empty">Chưa có trận đủ điều kiện để xếp TOP. Không tạo trận hoặc xác suất mẫu.</div>';
 for(const [i,x] of ranking.entries()){const s=x.snapshot||{},v=x.quote||{};html+='<button type="button" class="fe-lsp-item" data-ft-v2-select="'+esc(x.id)+'" data-active="'+(x.id===picked?.id)+'"><span class="fe-lsp-rank">'+(i+1)+'</span><span class="fe-lsp-match"><strong>'+esc(s.home)+' – '+esc(s.away)+'</strong><small>'+esc(s.league)+' · '+esc(s.minute)+'′ · '+esc(s.goals?.home)+'–'+esc(s.goals?.away)+'</small></span><span class="fe-lsp-ev" data-positive="'+(typeof v.ev==='number'&&v.ev>0)+'">'+pct(v.ev)+'</span></button>';}
 html+='</div><small class="fe-lsp-note">TOP là thứ tự của mô hình thử nghiệm, chưa phải tỷ lệ thắng đã kiểm chứng.</small></section><section class="fe-lsp-panel">';
 if(!picked){html+='<div class="fe-lsp-empty">Chờ dữ liệu của scanner hiện hành. Không tự gọi API hoặc kích hoạt quét.</div>';}
 else {
 const s=picked.snapshot||{},v=review||{},m=s.market||{},q=picked.quote||{},tone=v.action==='TRIAL_OVER'?'good':['WAIT_PRICE','MODEL_WAIT'].includes(v.action)?'wait':'neutral';
 const val=v.valuation||{},fair=val.fairOdds??v.fairOdds;
 const sessionBlocked=session&&session.status!=='ACTIVE';
 const decisionTitle=sessionBlocked?(session.status==='INVALIDATED'?'ĐÁNH GIÁ LẠI SAU BIẾN ĐỘNG':session.status==='EXPIRED'?'HẾT PHIÊN · CHỜ CẬP NHẬT':v.title):v.title;
 const metrics=[['Line FT',m.line],['Giá hiện tại',picked.marketFresh?odd(v.odds):'Chờ giá'],['Fair Odds · hiện tại',odd(fair)],['EV hiện tại',pct(v.estimatedEV)],['Thắng đủ · mô hình',pct(v.winProbability)],['Tổng FT kỳ vọng',odd(val.expectedTotal)]];
 const current=!picked.blocked&&picked.fresh===true;
 const currentModel=current&&picked.modelOK===true;
 const currentPrice=current&&picked.marketFresh===true;
 html+='<div class="fe-mc" data-mechanism="ftv2">'+matchIdentity({...s,at:s.at,badge:'FT AI V2 · Thử nghiệm',now});
 html+=outlook(current?val.liveLabel:'CHỜ DỮ LIỆU MỚI',current?'Tỷ số & phút đã quan sát · LIVE chưa hiệu chỉnh xác suất':'Ẩn định giá cũ; chờ nguồn cập nhật');
 html+=factTiles([['SOT',current?s.metrics?.sot??'—':'—','target'],['xG nguồn',current?odd(s.metrics?.xg):'—','trend'],['Phút nguồn',s.minute??'—','data']]);
 html+=probabilityRail('Thắng đủ · Tài FT '+(m.line??'—'),currentModel?v.winProbability:null,{kind:'exact-ft-contract',note:'Xác suất thắng đủ đúng line · khác xác suất có thêm bàn'});
 html+=directions(current?val.liveLabel:'Chờ cập nhật',currentPrice?'Tài FT '+m.line+' · '+odd(v.odds):'Chờ line / giá khớp trận');
 html+=priceDecision({title:decisionTitle,pick:'Tài FT '+(m.line??'—'),odds:currentPrice?v.odds:null,fair:currentModel?fair:null,ev:currentPrice?v.estimatedEV:null,positive:v.action==='TRIAL_OVER'&&!sessionBlocked,note:sessionBlocked?'Mốc đầu được giữ; khuyến nghị hiện tại cần đánh giá lại':'Mô hình thử nghiệm · chưa hiệu chỉnh theo kết quả LIVE'});
 html+='<details class="fe-mc-details" data-ft-full-details><summary>Chi tiết phân tích & định giá <span>›</span></summary>';
 html+='<div class="fe-lsp-fixture"><span class="fe-lsp-league">'+esc(s.league)+' · '+esc(s.minute)+'′</span><span class="fe-lsp-score">'+esc(s.home)+' <b>'+esc(s.goals?.home)+' – '+esc(s.goals?.away)+'</b> '+esc(s.away)+'</span></div>';
 html+='<div class="fe-lsp-ft-reading"><span>Match outlook</span><strong>'+esc(val.liveLabel||'Đang quan sát')+'</strong><small>Nền trước trận: '+odd(val.baselineGoals90)+' bàn / 90′ · '+(val.scoreTimeConditioned?'Đã cập nhật tỷ số & phút':'Mô hình nền')+' · LIVE chưa hiệu chỉnh xác suất</small><small>Quan sát nguồn: '+esc(typeof val.sourceAt==='number'?new Date(val.sourceAt).toLocaleTimeString('vi-VN'):'—')+' · phút không tự tăng theo đồng hồ</small></div>';
 html+='<div class="fe-lsp-decision" data-tone="'+(sessionBlocked?'wait':tone)+'"><small>PRICE DECISION · FT AI V2</small><strong>'+esc(decisionTitle||'CHỜ DỮ LIỆU')+'</strong><div class="fe-lsp-ft-pick">'+(v.action==='TRIAL_OVER'&&!sessionBlocked?'Tài FT '+esc(m.line)+' @ '+odd(v.odds):'Theo dõi Tài FT '+esc(m.line))+'</div><small>'+esc(v.action||'DATA_WAIT')+' · Mô hình thử nghiệm</small></div>';
 html+='<div class="fe-lsp-stats">'+metrics.map(([k,val])=>'<div class="fe-lsp-metric"><small>'+esc(k)+'</small><b>'+esc(val)+'</b></div>').join('')+'</div>';
 html+='<div class="fe-lsp-ft-entry"><strong>Điều kiện giá</strong><span>'+(typeof fair==='number'?'Cùng line '+esc(m.line)+': giá cần lớn hơn '+odd(fair)+' để EV dương theo mô hình nền.':'Chưa đủ dữ liệu để xác định giá công bằng.')+'</span><small>Ngưỡng tính toán từ mô hình; không phải mức lợi nhuận đã được kiểm chứng.</small></div>';
 if(val.marketOver!=null&&val.modelOver!=null&&Math.abs(m.line%1-.5)<1e-8){
  html+='<div class="fe-lsp-ft-compare"><strong>Model ↔ Market · cùng line FT '+esc(m.line)+'</strong>';
  for(const [label,value] of [[val.scoreTimeConditioned?'Mô hình theo trận':'Mô hình nền',val.modelOver],['Thị trường · bỏ biên',val.marketOver]])html+='<div class="fe-lsp-ft-bar"><span>'+label+'</span><div role="meter" aria-label="'+label+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(value*100).toFixed(1)+'"><i style="width:'+Math.max(0,Math.min(100,value*100))+'%"></i></div><b>'+pct(value)+'</b></div>';
  html+='<small>'+esc(val.comparison)+'</small></div>';
 }else html+='<p class="fe-lsp-note">'+esc(val.comparison||'Chưa đủ dữ liệu đối chiếu')+'</p>';
 if(picked.quote){html+='<details class="fe-lsp-detail fe-lsp-ft-settlement"><summary>Phân bố thanh toán · Tài '+esc(m.line)+'</summary>';for(const [label,key] of [['Thắng đủ','win'],['Thắng nửa','halfWin'],['Hoàn tiền','push'],['Thua nửa','halfLose'],['Thua đủ','lose']])html+='<div class="fe-lsp-ft-bar"><span>'+label+'</span><div><i style="width:'+Math.max(0,Math.min(100,(q[key]||0)*100))+'%"></i></div><b>'+pct(q[key])+'</b></div>';html+='</details>';}
 html+='</details>';
 html+='<section class="fe-lsp-ft-session" data-ft-session="'+esc(session?.status||'NONE')+'"><strong>Recommendation window · 5 phút</strong>';
 if(session){const remaining=Math.max(0,Math.ceil((session.expiresAt-now)/1000));html+='<span data-ft-session-clock>'+esc(session.status)+' · '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')+'</span><div>Mốc đầu: Tài '+esc(session.original.line)+' @ '+odd(session.original.odds)+' · Fair '+odd(session.original.fairOdds)+'</div><small>'+esc(session.reason)+'</small>';}
 else html+='<small>Phiên bắt đầu khi có khuyến nghị và giá hợp lệ. Không khóa giả một mức giá chưa có.</small>';
 html+='</section>';
 if(session){
  const original=session.original||{},delta=(current,start)=>typeof current==='number'&&typeof start==='number'?current-start:null;
  const values=[['Fair Odds',odd(original.fairOdds),odd(fair),delta(fair,original.fairOdds),false],['Xác suất thắng đủ',pct(original.winProbability),pct(v.winProbability),delta(v.winProbability,original.winProbability),true],['EV',pct(original.estimatedEV),pct(v.estimatedEV),delta(v.estimatedEV,original.estimatedEV),true],['Bàn còn lại',odd(original.remainingGoals),odd(val.remainingGoals),delta(val.remainingGoals,original.remainingGoals),false]];
  html+='<details class="fe-lsp-detail fe-lsp-ft-change"><summary>Mốc đầu ↔ hiện tại · line hiện tại '+esc(m.line)+'</summary><div class="fe-lsp-ft-change-grid"><small>Chỉ số</small><small>Mốc đầu</small><small>Hiện tại</small><small>Thay đổi</small>';
  for(const [name,start,current,d,probability] of values)html+='<span>'+name+'</span><b>'+start+'</b><b>'+current+'</b><span>'+(session.status==='INVALIDATED'?'Khác trạng thái':d===null?'—':(d>0?'+':'')+(probability?(100*d).toFixed(1)+' đ%':d.toFixed(2)))+'</span>';
  html+='</div><small>Chỉ tính lại theo quan sát nguồn mới; đồng hồ không tự tạo dữ liệu. Mốc đầu được giữ trong phiên 5 phút.</small></details>';
 }

 const reasons=Array.isArray(v.reason)?v.reason:[],warnings=Array.isArray(v.warnings)?v.warnings:[];
 html+='<div class="fe-lsp-sections"><details class="fe-lsp-detail"><summary>Lý do phân tích</summary><p>'+esc(reasons.length?reasons.join(' · '):'Chưa có kết luận đủ điều kiện')+'</p></details>';
 html+='<details class="fe-lsp-detail"><summary>Dữ liệu LIVE và độ mới</summary><p>'+esc(live?.evidence?.status||'NO_WINDOW')+' · '+esc(live?.reason||'Chưa đủ thống kê')+'</p></details>';
 html+='<details class="fe-lsp-detail"><summary>Rủi ro và độ nhạy xác suất</summary><p>'+esc(warnings.join(' · ')||'Chưa có cảnh báo bổ sung')+'</p><p>'+ (v.sensitivity?.lowEV==null?'Line nguyên/¼: không dùng công thức nhị phân 1/odds; xem phân bố thanh toán.':'EV khi xác suất thay đổi giả định ±5 điểm %: '+pct(v.sensitivity.lowEV)+' đến '+pct(v.sensitivity.highEV)+'. Đây không phải khoảng tin cậy.')+'</p></details></div>';
 }
 html+='</section></div><small class="fe-lsp-note">Bản nghiên cứu: không tạo dữ liệu giả, không thay HT/HC, không tự ghi Outcome.</small></div>';
 return html;
}


