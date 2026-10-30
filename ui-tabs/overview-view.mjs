// Overview presentation only. Existing rankings, assessment actions and prices are inputs.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const odd=x=>finite(x)?x.toFixed(2):'—';
const fresh=(s,now)=>!!s&&finite(s.observation?.at)&&s.observation.at<=now&&now-s.observation.at<=60000&&!['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(s.observation.status);
const sourceSignal=x=>x.signals[x.masterPrimary]||Object.values(x.signals)[0];
const phaseDone=s=>['HT','2H','ET','BT','P','FT','AET','PEN'].includes(s?.observation?.status);
const translated={STRONG:'Tín hiệu mạnh',READY:'Có tín hiệu',CANDIDATE:'Đang theo dõi',WATCH:'Đang theo dõi',WAIT:'Đang chờ',WAIT_PRICE:'Chờ giá',MODEL_WAIT:'Chờ dữ liệu nền',DATA_WAIT:'Chờ dữ liệu',DATA_INCOMPLETE:'Chờ dữ liệu',BASELINE:'Đang tích lũy',PARTIAL_STATS:'Đang tích lũy',COOLDOWN:'Đánh giá lại',STALE:'Chờ cập nhật',BALANCED:'Cân bằng',HOME_STRONG:'Chủ nhà có ưu thế',STRONG_HOME:'Chủ nhà có ưu thế',AWAY_STRONG:'Khách có ưu thế',STRONG_AWAY:'Khách có ưu thế',HOME_LEAN:'Nghiêng chủ nhà',AWAY_LEAN:'Nghiêng khách',HOME_BIAS:'Theo dõi chủ nhà',AWAY_BIAS:'Theo dõi khách',DIVERGENCE:'Dữ liệu và giá khác hướng',MARKET_WATCH:'Theo dõi thị trường'};
function nativeChip(s,key,now){
 if(key==='ht'&&phaseDone(s))return {label:'Đã kết thúc',tone:'neutral',source:'HT'};
 if(!s)return {label:'Chưa có nguồn',tone:'neutral',source:key.toUpperCase()};
 if(!fresh(s,now))return {label:['FT','AET','PEN'].includes(s.observation.status)?'Đã kết thúc':'Chờ cập nhật',tone:'wait',source:key.toUpperCase()};
 const label=({HOME_STRONG:'Có tín hiệu',STRONG_HOME:'Có tín hiệu',AWAY_STRONG:'Có tín hiệu',STRONG_AWAY:'Có tín hiệu',HOME_LEAN:'Theo dõi',AWAY_LEAN:'Theo dõi',HOME_BIAS:'Theo dõi',AWAY_BIAS:'Theo dõi'})[s.state]||translated[s.state]||'Theo dõi';return {label,tone:/Chờ|Đang chờ|tích lũy|Đánh giá/.test(label)?'wait':'neutral',source:key.toUpperCase()};
}
function htChip(x,rows,now){
 const s=x.signals.ht,native=nativeChip(s,'ht',now);if(!s||phaseDone(s)||!fresh(s,now)||now-s.observation.at>55000)return native;
 const r=rows.find(r=>r.id===x.id&&r.at===s.observation.at),g=r?.model?.condition?.goals,o=s.observation;
 // A cached HT assessment must match the current source time, score and minute.
 if(!r||!g||g.home!==o.goals.home||g.away!==o.goals.away||r.model.condition.minute!==o.minute)return native;
 if(r.session&&(r.session.closedAt||finite(r.session.expiresAt)&&now>=r.session.expiresAt||r.session.state!=='ACTIVE'))return {...native,label:'Đánh giá lại',tone:'wait'};
 if(r.dataOK&&r.modelOK&&r.marketOK&&r.action==='TRIAL_OVER'&&finite(r.quote?.fairOdds)&&finite(r.quote?.ev)&&finite(r.recommendation?.odds)&&r.recommendation.odds>1)return {label:'Cân nhắc',tone:'good',source:'HT',pick:{period:'HT',line:r.recommendation.line,odds:r.recommendation.odds,fair:r.quote.fairOdds,ev:r.quote.ev,source:'HT Goals'}};
 return {...native,label:translated[r.state]||native.label,tone:'wait'};
}
function ftChip(x,displayAction,now){
 const s=x.signals.valuation;if(s&&fresh(s,now)&&s.modelOK&&s.marketFresh&&!s.blocked&&String(displayAction(s,now,'BRIDGE')).startsWith('Cân nhắc Tài FT ')&&finite(s.ev)&&finite(s.fairOdds))return {label:'Cân nhắc',tone:'good',source:'FT Overview',pick:{period:'FT',line:s.line,odds:s.odds,fair:s.fairOdds,ev:s.ev,source:'FT Overview'}};
 const native=nativeChip(x.signals.ft,'ft',now);if(s&&fresh(s,now)&&!s.blocked)return {...native,label:translated[s.state]||(!s.marketFresh?'Chờ giá':!s.modelOK?'Chờ dữ liệu nền':native.label),tone:'wait'};
 return native;
}
export function overviewCards({rows=[],displayAction,display={},now=Date.now()}={}){
 const seen=new Set();return rows.filter(x=>Number.isSafeInteger(x.id)&&!seen.has(x.id)&&seen.add(x.id)).slice(0,5).map(x=>{
  const primary=sourceSignal(x),o=x.observation||primary?.observation||{},chips={ht:htChip(x,display.ht||[],now),ft:ftChip(x,displayAction,now),hc:nativeChip(x.signals.hc,'hc',now)},priority=x.masterPrimary==='ht'?'ht':x.masterPrimary==='ft'||x.masterPrimary==='valuation'?'ft':null;
  if(phaseDone({observation:o}))chips.ht={label:'Đã kết thúc',tone:'neutral',source:'HT'};
  for(const key of ['ht','ft'])if(chips[key].pick){const z=key==='ht'?x.signals.ht:x.signals.valuation;const a=z?.observation;if(!a||a.status!==o.status||a.minute!==o.minute||a.goals?.home!==o.goals?.home||a.goals?.away!==o.goals?.away)chips[key]={label:'Chờ khớp nguồn',tone:'wait',source:chips[key].source};}
  const pick=(priority&&chips[priority].pick)||chips.ht.pick||chips.ft.pick||null;
  const v=display.ft?.find(r=>r.id===x.id&&r.snapshot?.at===x.signals.valuation?.observation.at),p=v?.binary?.over;
  const market=finite(p)&&fresh(x.signals.valuation,now)&&x.signals.valuation.marketFresh?(p>.5?'Nghiêng Tài':p<.5?'Nghiêng Xỉu':'Cân bằng'):pick?'Tài '+pick.period+' '+pick.line+' @ '+odd(pick.odds):'Chờ giá nguồn';
  const current=fresh({observation:o},now),outlook=fresh(primary,now)?(translated[primary.state]||'Đang theo dõi'):current?'Chờ kết luận nguồn':'Chờ dữ liệu mới';
  const history=fresh(primary,now)?(primary.history||[]).filter(h=>finite(h.at)&&h.at<=o.at&&finite(h.value)&&h.value>=0).slice(-12):[];
  return {id:x.id,rank:x.masterRank,observation:o,current,outlook,market,history,chips,pick,signals:x.signals,primary:x.masterPrimary};
 });
}
const initial=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>[...w][0]).join('').toUpperCase();
function spark(history){if(history.length<2||history[0].at===history[history.length-1].at)return '<div class="ov-spark ov-spark-empty">Chờ chuỗi LIVE</div>';
 const min=Math.min(...history.map(h=>h.value)),max=Math.max(...history.map(h=>h.value)),t0=history[0].at,t1=history[history.length-1].at;
 const points=history.map(h=>[3+(h.at-t0)/(t1-t0)*111,32-(max===min?0:(h.value-min)/(max-min)*26)]),line=points.map(p=>p.join(',')).join(' ');
 return '<div class="ov-spark"><svg viewBox="0 0 117 38" role="img" aria-label="SOT tích lũy theo thời điểm nguồn"><path d="M'+points.map(p=>p.join(' ')).join(' L')+' L114 37 L3 37 Z"/><polyline points="'+line+'"/></svg><small>SOT tích lũy</small></div>';
}
export function renderOverview({rows=[],fixture=null,route,displayAction,display={},now=Date.now()}={}){
 const cards=overviewCards({rows,displayAction,display,now}),ready=cards.filter(c=>c.pick).length,current=cards.filter(c=>c.current).length;
 let h='<section class="ov-dashboard" data-overview-dashboard><header class="ov-heading"><div><h2>TOP 5 · LIVE OVERVIEW</h2><small>HT · FT · HC · Chung dữ liệu nguồn</small></div><span data-tone="'+(current?'good':'wait')+'">'+(current?'● Dữ liệu LIVE':'● Chờ cập nhật')+'</span></header><div class="ov-summary"><span><b>'+cards.length+'</b> trận</span><span data-tone="good"><b>'+ready+'</b> cân nhắc</span><span data-tone="wait"><b>'+(cards.length-ready)+'</b> theo dõi</span></div><div class="ov-cards">';
 if(!cards.length)h+='<div class="ov-empty"><b>Chưa có trận trong TOP hiện hành</b><p>Không lấy trận cũ hoặc dữ liệu mẫu để lấp danh sách.</p></div>';
 for(const c of cards){const o=c.observation,assigned=Number.isInteger(c.rank)&&c.rank>0&&c.rank<=5,pick=c.pick;
 h+='<details class="ov-card" data-overview-id="'+c.id+'" data-overview-rank="'+(assigned?c.rank:'')+'" data-ready="'+!!pick+'"'+(fixture===c.id?' open':'')+'><summary aria-label="'+esc((assigned?'TOP '+c.rank+' · ':'')+o.home+' – '+o.away)+'"><div class="ov-card-top"><b class="ov-rank">'+(assigned?'TOP '+c.rank:'Theo dõi')+'</b><span class="ov-league">'+esc(o.league||'Chưa có tên giải')+'</span><small class="ov-phase">'+esc(o.status)+' · '+esc(o.minute)+'′</small></div><div class="ov-card-grid"><div class="ov-left"><div class="ov-match"><span><i>'+esc(initial(o.home))+'</i><b>'+esc(o.home)+'</b></span><strong>'+esc(o.goals?.home)+' – '+esc(o.goals?.away)+'</strong><span><i>'+esc(initial(o.away))+'</i><b>'+esc(o.away)+'</b></span></div><div class="ov-outlook">'+spark(c.history)+'<b>'+esc(c.outlook)+'</b></div><div class="ov-perspectives"><span>Dữ liệu: '+esc(c.outlook)+'</span><span>Giá: '+esc(c.market)+'</span></div></div><div class="ov-right"><div class="ov-mechanisms">'+['ht','ft','hc'].map(k=>'<div><small>'+k.toUpperCase()+'</small><b data-overview-engine="'+k+'" data-tone="'+c.chips[k].tone+'">'+esc(c.chips[k].label)+'</b></div>').join('')+'</div><div class="ov-recommendation" data-tone="'+(pick?'good':c.current?'neutral':'wait')+'">'+(pick?'<strong>Tài '+pick.period+' '+esc(pick.line)+' @ '+odd(pick.odds)+'</strong><small>Fair '+odd(pick.fair)+' · EV '+(pick.ev>0?'+':'')+(pick.ev*100).toFixed(1)+'%</small><em>'+esc(pick.source)+' · Thử nghiệm</em>':'<strong>'+esc(c.current?'Chưa có khuyến nghị giá':'Chờ dữ liệu cập nhật')+'</strong><small>Chạm để xem từng cơ chế</small>')+'</div></div><span class="ov-chevron">›</span></div></summary><div class="ov-expanded"><header><b>'+esc(o.home)+' – '+esc(o.away)+'</b><small>Quan sát: '+esc(finite(o.at)?new Date(o.at).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—')+'</small></header>'+['ht','ft','hc'].map(k=>'<a href="'+esc(route(k,c.id))+'"><span><b>'+k.toUpperCase()+'</b><small>'+esc(c.chips[k].source)+'</small></span><span>'+esc(c.chips[k].label)+(c.chips[k].pick?'<small>Tài '+c.chips[k].pick.period+' '+esc(c.chips[k].pick.line)+' @ '+odd(c.chips[k].pick.odds)+'</small>':'')+'</span><i>›</i></a>').join('')+(c.signals.valuation?'<a href="'+esc(route('valuation',c.id))+'"><b>FT Overview</b><span>Biểu đồ & định giá ›</span></a>':'')+'<p>Giữ thứ tự TOP nguồn. Số liệu thiếu không được suy thành xác suất hoặc khuyến nghị.</p></div></details>';
 }
 return h+'</div><footer class="ov-legend"><span>● Cân nhắc</span><span>● Chờ</span><span>● Theo dõi</span></footer></section>';
}
