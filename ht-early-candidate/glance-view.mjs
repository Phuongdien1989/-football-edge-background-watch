// Glanceable presentation of existing HT assessments; no new engine or requests.
import {htProbabilityViewModel} from './probability-view.mjs';
const finite=x=>typeof x==='number'&&Number.isFinite(x),n=x=>finite(x)?x:null;
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const odd=x=>finite(x)?x.toFixed(2):'—',pct=x=>finite(x)?(x*100).toFixed(1)+'%':'—';
const initials=x=>String(x||'?').trim().split(/\s+/).map(w=>[...w][0]).slice(0,3).join('').toUpperCase();
export function htGlanceFacts(item,row,native=null,now=Date.now()){
 const s=item.latest||{},e=native?.eval||{},same=native?.latest?.captured_at===s.captured_at&&finite(s.captured_at),fresh=finite(s.fresh_at)&&now>=s.fresh_at&&now-s.fresh_at<=55000;
 const usable=same&&fresh&&!(item.cooldownUntil>now)&&!['DATA_INCOMPLETE','BASELINE'].includes(e.scoreMode),w=usable?e.recent5:null,complete=w?.status==='complete';
 const sot=complete&&s.stats_presence?.sot===true?n(w.delta?.sot):null,xg=complete&&s.stats_presence?.xg===true?n(w.delta?.xg):null;
 let headline='CHỜ DIỄN BIẾN H1',sub='Chưa có kết luận LIVE từ nguồn hiện hành',tone='wait';
 if(!fresh){headline='CHỜ DỮ LIỆU MỚI';sub='Quan sát cũ hoặc thiếu thời điểm';}
 else if(item.cooldownUntil>now||row.session?.closedAt){headline='ĐANG ĐÁNH GIÁ LẠI';sub='Giữ mốc cũ để đối chiếu';}
 else if(same&&['DATA_INCOMPLETE','BASELINE','PARTIAL_STATS'].includes(e.scoreMode)){headline='ĐANG TÍCH LŨY DỮ LIỆU';sub='Cục diện chưa được xác nhận đầy đủ';}
 else if(usable&&finite(e.accel)&&e.accel>=.35){headline='NHỊP H1 ĐANG TĂNG';sub='Gia tốc từ cơ chế H1 hiện có';tone='positive';}
 else if(usable&&e.core?.pass&&['STRONG','READY'].includes(native.state)){headline='ÁP LỰC H1 ĐƯỢC XÁC NHẬN';sub='Tín hiệu từ cơ chế H1 hiện có';tone='positive';}
 else if(usable&&native.state==='CANDIDATE'){headline='H1 ĐANG CÓ TÍN HIỆU';sub='Tiếp tục theo dõi diễn biến';}
 const momentum=usable&&finite(e.accel)?e.accel>=.35?'Tăng ↑':finite(e.momentum)&&e.momentum<5?'Yếu / giảm':'Đang theo dõi':'Chờ dữ liệu';
 const windows=['recent3','recent5','recent10'].map((key,i)=>{const z=usable?e[key]:null;return {label:[3,5,10][i]+'′',rate:z?.status==='complete'&&s.stats_presence?.sot===true&&finite(z.window_min)&&z.window_min>0&&finite(z.delta?.sot)?z.delta.sot/z.window_min:null};});
 const p=htProbabilityViewModel(row),closed=row.session?.closedAt;
 const action=closed?'HẾT HIỆU LỰC':row.action==='TRIAL_OVER'?'CÂN NHẮC':row.state==='WAIT_PRICE'?'CHỜ GIÁ':row.state==='MODEL_WAIT'?'CHỜ MÔ HÌNH':'CHỜ DỮ LIỆU';
 return {headline,sub,tone,sot,xg,momentum,windows,probability:p,action,actionTone:closed?'closed':row.action==='TRIAL_OVER'?'positive':'wait',age:fresh?Math.floor((now-s.fresh_at)/1000):null};
}
const icon=name=>{const paths={target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',trend:'<path d="M3 18l6-6 4 3 8-10M15 5h6v6"/>',pulse:'<path d="M2 12h5l3-7 4 14 3-7h5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>'};return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+paths[name]+'</svg>';};
function spark(windows){const max=Math.max(0,...windows.map(w=>w.rate??0));return '<div class="htx-spark" role="img" aria-label="SOT mỗi phút trong các cửa sổ 3, 5, 10 phút">'+windows.map(w=>'<div><i style="height:'+(w.rate===null?2:max>0?Math.max(2,w.rate/max*40):2)+'px" data-known="'+(w.rate!==null)+'"></i><small>'+w.label+'</small></div>').join('')+'<span>SOT/phút</span></div>';}
export function renderHTGlance({item,row,native=null,leagueText,sourceItems=[],now=Date.now(),detailsHTML='',recordedHTML='',recorded=null,sessionHTML='',valuesHTML=''}={}){
 const f=htGlanceFacts(item,row,native,now),s=item.latest||{},q=row.quote,p=f.probability,session=row.session,seconds=Math.max(0,Math.ceil((session?.remainingMs??0)/1000));
 const source=sourceItems.slice(0,5),position=source.findIndex(x=>x.id===item.id);
 const period=s.status==='LIVE'?'1H':s.status,score=String(s.goals?.home??'—')+' – '+String(s.goals?.away??'—');
 return '<div class="htx" data-ht-glance="true"><header class="htx-top"><p class="htp-league">'+esc(leagueText)+'</p><span class="htx-tag">HT · Thử nghiệm</span></header>'+
 '<h3 class="htx-teams"><span><i class="htx-crest">'+esc(initials(item.home))+'</i><b>'+esc(item.home)+'</b></span><span class="htx-score"><strong>'+esc(score)+'</strong><small>'+esc(period)+' · '+esc(s.minute)+'′</small></span><span><i class="htx-crest away">'+esc(initials(item.away))+'</i><b>'+esc(item.away)+'</b></span></h3>'+
 '<div class="htx-fresh" data-tone="'+(f.age===null?'wait':'positive')+'">● '+(f.age===null?'Dữ liệu cần cập nhật':'Cập nhật '+f.age+'s trước')+'</div>'+
 '<section class="htx-outlook" data-tone="'+f.tone+'"><div><strong>'+esc(f.headline)+'</strong><small>'+esc(f.sub)+'</small></div>'+spark(f.windows)+'</section>'+
 '<div class="htx-metrics"><div>'+icon('target')+'<small>SOT · 5′</small><b>'+esc(f.sot===null?'—':f.sot)+'</b></div><div>'+icon('trend')+'<small>xG · 5′</small><b>'+(f.xg===null?'—':'+'+odd(f.xg))+'</b></div><div>'+icon('pulse')+'<small>NHỊP H1</small><b>'+esc(f.momentum)+'</b></div></div>'+
 '<section class="htx-prob" data-ht-glance-prob="'+(p.available?'AVAILABLE':'WAIT')+'"><div><b>Có thêm bàn H1</b><strong>'+pct(p.atLeastOneMoreGoal)+'</strong></div><div class="htx-rail" role="img" aria-label="'+esc(p.available?'Có thêm bàn '+pct(p.atLeastOneMoreGoal)+', không thêm bàn '+pct(p.noMoreGoals):'Chưa có xác suất HT hợp lệ')+'"><i style="width:'+(p.available?p.atLeastOneMoreGoal*100:0)+'%"></i></div><small>Ước tính mô hình · thử nghiệm'+(p.available?' · Không thêm bàn '+pct(p.noMoreGoals):' · Chờ dữ liệu')+'</small></section>'+
 '<div class="htx-streams"><div><small>DỮ LIỆU LIVE</small><b>'+esc(f.momentum)+'</b></div><div><small>THỊ TRƯỜNG</small><b>'+(row.marketOK?'Tài H1 '+esc(row.recommendation.line)+' · '+odd(row.recommendation.odds):'Chờ line / giá HT')+'</b></div></div>'+
 '<section class="htx-verdict" data-tone="'+f.actionTone+'"><small>ĐỀ XUẤT THỬ NGHIỆM</small><div class="htx-verdict-grid"><div><strong>'+esc(f.action)+(row.marketOK?' TÀI H1 '+esc(row.recommendation.line):'')+'</strong><span class="htp-odds">'+(row.marketOK?'@ '+odd(row.recommendation.odds):'—')+'</span></div><div class="htx-fair"><small>Fair</small><b>'+odd(q?.fairOdds)+'</b></div><div class="htx-fair"><small>EV</small><b>'+(q?.ev>0?'+':'')+pct(q?.ev)+'</b></div></div><p>'+esc(session?.closedAt?'Mốc cũ mất hiệu lực · Chờ đánh giá mới':q? q.ev>0?'Giá có lợi theo mô hình · Đối chiếu LIVE':'Giá chưa có lợi theo mô hình':'Chờ đủ dữ liệu và giá để định giá')+'</p></section>'+
 (session?'<div class="htx-session-strip">'+icon('clock')+'<b>Mốc 5 phút</b><i><em style="width:'+Math.min(100,seconds/3)+'%"></em></i><span>'+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+'</span></div>':'')+
 (recorded&&now<recorded.until?'<div class="htx-record-line">Mốc đã ghi · Tài H1 '+esc(recorded.original.line)+' @ '+odd(recorded.original.odds)+' <small>Giữ 10′ · tham khảo</small></div>':'')+
 '<details class="htx-details"><summary>Chi tiết phân tích <span>›</span></summary>'+recordedHTML+sessionHTML+valuesHTML+detailsHTML+'</details>'+
 '<nav class="htx-ladder" aria-label="Danh sách HT hiện có"><small>HT · '+source.length+' trận</small>'+source.map((x,i)=>'<a href="#fe-tabs/ht/'+esc(x.id)+'" data-ht-top="'+esc(x.id)+'" aria-current="'+(i===position?'true':'false')+'" aria-label="Xem '+esc(x.home)+' – '+esc(x.away)+'">'+(i+1)+'</a>').join('')+'</nav></div>';
}
