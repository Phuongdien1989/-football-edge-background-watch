/* Football Edge Mobile Sports Premium — read-only presentation and native-action delegation.
 * Does not call engine renderers, mutate state, poll, register Push, or send requests.
 * PREVIEW: DEMO is isolated. Actual data/actions require explicit ?mode=connected.
 */
(()=>{
 'use strict';
 if(window.__FE_SPORTS_PREMIUM__)return;
 window.__FE_SPORTS_PREMIUM__=true;
 const mode=new URLSearchParams(location.search).get('mode')==='connected'?'connected':'demo';
 const liveMode=mode==='connected';
 const mql=matchMedia('(max-width:767px)');
 const $=id=>document.getElementById(id);
 const h=(tag,cl,html='')=>{const n=document.createElement(tag);n.className=cl;n.innerHTML=html;return n};
 const escape=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const number=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
 const val=x=>x===null||x===undefined||x===''?'—':String(x);
 const isLive=s=>['1H','HT','2H','ET','BT','P','INT','LIVE'].includes(String(s||''));
 const isPre=s=>['NS','TBD'].includes(String(s||''));
 const demoRows=[
   {manual:true,id:910011,league:'Giải minh họa',home:'North City',away:'Riverside',short:'2H',minute:67,scoreHome:1,scoreAway:0,dq:4.3,dqScale:5,top:1,why:'Dữ liệu minh họa, không phải nhận định',entry:'WATCH',market:null,edge:null,metrics:{home:{shots:12,sot:5,possession:58},away:{shots:5,sot:2,possession:42}}},
   {manual:true,id:910012,league:'Giải minh họa',home:'Harbor United',away:'East Town',short:'2H',minute:54,scoreHome:0,scoreAway:0,dq:4.1,dqScale:5,top:null},
   {id:910013,league:'Giải minh họa',home:'Central FC',away:'West Athletic',short:'2H',minute:72,scoreHome:1,scoreAway:1,dq:4.5,dqScale:5,top:null},
   {id:910014,league:'Giải minh họa',home:'Upcoming FC',away:'Future Club',short:'NS',minute:null,scoreHome:null,scoreAway:null,dq:null,top:null}
 ];
 const state={group:'LIVE',selected:null,selectedId:null,rows:[],rank:[],lastUIUpdate:0,renderCount:0,previousRanks:new Map(),rankMoves:new Map()};
 const shell=h('div','sp-root',`<div class="sp-mode" id="spMode"><div><strong id="spModeName">BẢN THỬ · DỮ LIỆU MINH HỌA</strong><div id="spModeSub">Chưa kết nối dữ liệu thật.</div></div><button id="spModeAction" type="button">DỮ LIỆU THẬT ›</button></div>
 <section class="sp-card sp-system"><div class="sp-system-info"><i id="spDot" class="sp-dot"></i><div><strong id="spConn">Chưa xác minh</strong><small id="spFresh">Chưa có lần cập nhật từ nguồn</small></div></div><button id="spScan" type="button" class="sp-scan-btn" data-on="false"><span aria-hidden="true">◉</span><span id="spScanLabel">Quét nền: —</span><span class="sp-switch" aria-hidden="true"></span></button></section>
 <nav class="sp-card sp-tabs" aria-label="Nhóm trận"><button class="active" data-sp-group="LIVE" aria-current="page" type="button">◉ LIVE</button><button data-sp-group="PRE" type="button">▦ Sắp diễn ra</button><button data-sp-group="WATCH" type="button">☆ Theo dõi</button></nav>
 <section class="sp-card sp-top" aria-label="TOP 1 từ engine"><div class="sp-top-head"><strong>🏆 TOP 1</strong><span>Ưu tiên phân tích sâu</span><b class="sp-pill" id="spTopGate">CHỜ DỮ LIỆU</b></div><div id="spTopContent" class="sp-top-inner"><div class="sp-empty">Chưa có TOP 1 từ engine.</div></div></section>
 <section class="sp-card sp-ranking" aria-label="Bảng xếp hạng TOP 1 đến 5"><div class="sp-ranking-head"><h2>🏆 BẢNG TOP 1–5</h2><span id="spRankCount">0/5 trận</span></div><p class="sp-rank-note">H1 · FT · HC — thứ hạng cập nhật theo engine hiện tại.</p><div id="spRankRows" role="list"></div><p class="sp-rank-note">TOP là ưu tiên phân tích, chưa phải lệnh vào kèo.</p></section>
 <div class="sp-section-line"><h2 id="spListTitle">Trận đang theo dõi</h2><button id="spAll" type="button">Xem tất cả ›</button></div><div id="spRows" class="sp-list" role="list"></div><p id="spInlineError" class="sp-inline-blank" hidden></p>
 <section class="sp-card sp-stats" id="spStats" aria-label="Thống kê trận đã chọn"></section><details class="sp-help"><summary>Thông tin bản thử</summary><p>TOP 1 là ưu tiên phân tích từ engine hiện tại. Chế độ minh họa không quét hoặc gửi thông báo. Bản đang dùng được giữ nguyên.</p></details>`);
 shell.id='feSportsPremium';
 shell.dataset.uiVersion='SPORTS-PREMIUM-REVIEW-3';
 // Adds exactly one presentation shell; native app cards remain intact in original DOM.
 const anchor=$('appTop')||document.querySelector('.app');anchor?.insertAdjacentElement('afterend',shell);
 function applyWidth(){document.body.classList.toggle('fe-sp-enabled',mql.matches);if(mql.matches)schedule()}
 mql.addEventListener?.('change',applyWidth);document.body.classList.toggle('fe-sp-enabled',mql.matches);
 function openNative(destination){
   const map={matches:'#scanCard',analysis:'#analysisCard',settings:'#connectCard',tracking:'#betTrackerCard',home:'#appTop'};
   const el=document.querySelector('.bottom-nav .bottom-item[href="'+map[destination]+'"]');
   if(!el)return false;
   el.click();
   if(destination==='settings')$('connectAccordion')?.setAttribute('open','');
   return true;
 }
 // Presentation-only tab routing. It never prevents the native handler, writes
 // state, triggers scans, or creates a second navigation tree.
 const nativeViews={'#appTop':'home','#scanCard':'matches','#analysisCard':'analysis','#betTrackerCard':'tracking','#connectCard':'settings'};
 function markNativeView(href){
   const view=nativeViews[href];if(!view)return;
   for(const old of Object.values(nativeViews))document.body.classList.remove('sp-view-'+old);
   document.body.classList.add('sp-view-'+view);
 }
 document.addEventListener('click',event=>{
   const link=event.target.closest?.('.bottom-nav a.bottom-item, .topbar a[href^="#"], .topbar button[data-sp-to]');
   if(!link)return;
   markNativeView(link.getAttribute('href')||link.getAttribute('data-sp-to'));
 },true);
 // Opening a URL with an explicit native hash must not hide its target.
 markNativeView(nativeViews[location.hash]?location.hash:'#appTop');
 window.addEventListener('hashchange',()=>markNativeView(location.hash||'#appTop'));
 function addonRows(){try{const rows=window.FEAddonBridge?.masterRows?.();return Array.isArray(rows)?rows:[]}catch(e){return []}}
 function nativeRows(){try{
   const read=window.FEUIReadBridge?.read?.();return Array.isArray(read?.state?.fixtures)?read.state.fixtures:[];
 }catch{return []}}
 function fixtureRows(){
   const map=new Map();
   for(const f of nativeRows()){
     const id=number(f?.fixture?.id);if(id===null)continue;
     map.set(id,{id,league:val(f?.league?.name),home:val(f?.teams?.home?.name),away:val(f?.teams?.away?.name),short:f?.fixture?.status?.short||null,minute:number(f?.fixture?.status?.elapsed),scoreHome:number(f?.goals?.home),scoreAway:number(f?.goals?.away),homeLogo:f?.teams?.home?.logo||null,awayLogo:f?.teams?.away?.logo||null,timestamp:number(f?.fixture?.timestamp),loaded:true,dq:null,top:null,edge:null,updatedAt:null,why:null});
   }
   const rankings=addonRows();
   for(const x of rankings){
     const id=number(x?.id);if(id===null)continue;
     const rank=x.__rank||{},p=rank.primary||{},s=(x.latest||x.h1||x.ft||x.hc)?.latest||{};
     const row=map.get(id)||{id,league:val(x.league),home:val(x.home),away:val(x.away),short:s.status??null,minute:number(s.minute),scoreHome:number(s?.goals?.home),scoreAway:number(s?.goals?.away),loaded:false};
     row.top=number(rank.top);row.manual=x.__addon?.manual===true;
     row.dq=number(p?.dq);row.dqScale=5;row.metrics=s.metrics||null;row.statsPresence=s.stats_presence||null;row.engine=p.engine||null;row.engineState=rank.primary?.engine==='HC'?x.hc?.eval?.state:rank.primary?.engine==='H1'?x.h1?.state:x.ft?.state;row.homeLogo=row.homeLogo||s.fixture?.teams?.home?.logo||null;row.awayLogo=row.awayLogo||s.fixture?.teams?.away?.logo||null;row.edge=p?.edge??null;row.entry=x.__addon?.entry?.status||null;row.why=x.__addon?.rankWhy||null;row.market=p?.marketLabel||null;
     row.updatedAt=number(s.fresh_at??s.captured_at);row.statsUpdatedAt=row.updatedAt;
     map.set(id,row);
   }
   state.rank=rankings;
   return [...map.values()];
 }
 function ageLabel(at){
   let ms=number(at);if(ms===null||ms===0)return 'Chưa có thời điểm cập nhật';
   if(ms<1e11)ms*=1000;
   const diff=Date.now()-ms;if(diff<0)return 'Thời điểm nguồn chưa xác minh';
   const min=Math.floor(diff/60000);return min<1?'Vừa cập nhật':min<60?`${min} phút trước`:`${Math.floor(min/60)} giờ trước`;
 }
 function stateAge(x){const at=number(x?.updatedAt);if(at===null||at<=0)return 'unknown';const age=Date.now()-(at<1e11?at*1000:at);return age < -5000?'unknown':age>60000?'stale':'fresh'}
 function score(x){return x.scoreHome===null||x.scoreHome===undefined||x.scoreAway===null||x.scoreAway===undefined?'—':`${x.scoreHome} – ${x.scoreAway}`}
 function when(x){
   if(isLive(x.short))return x.minute===null?'LIVE • phút —':`${x.minute}′ · ${({ '1H':'Hiệp 1','2H':'Hiệp 2',HT:'Nghỉ giữa hiệp',ET:'Hiệp phụ' })[x.short]||x.short}`;
   if(x.timestamp){const dt=new Date(x.timestamp*1000);return Number.isNaN(dt.getTime())?'Chưa có giờ':dt.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}
   return x.short||'Chưa có giờ';
 }
 function setHeader(){
   const conn=$('connMiniStatus'),raw=(conn?.textContent||'').trim();
   const scan=$('feScanControlBtn'),pressed=scan?.getAttribute('aria-pressed');
   const badge=($('feScanBadge')?.textContent||'').trim();
   const isKnown=liveMode&&(pressed==='true'||pressed==='false');
   let on=isKnown&&pressed==='false';
   const healthy=liveMode&&conn?.classList.contains('ok');
   $('spConn').textContent=!liveMode?'Chế độ minh họa':healthy?'Đã kết nối API':raw&&raw!=='Chưa cấu hình'?'Kết nối cần xác minh':'Chưa cấu hình nguồn';
   $('spConn').className=healthy?'':liveMode?'warn':'';
   $('spDot').className='sp-dot '+(healthy?'ok':liveMode?'warn':'');
   const fresh=(()=>{try{return window.FEAddonBridge?.unified?.()?.lastAt}catch{return null}})();
   $('spFresh').textContent=!liveMode?'Không gọi API hoặc gửi Push':fresh?'Lần quét: '+ageLabel(fresh):badge&&badge!=='CHƯA KIỂM TRA'?'Worker: '+badge:'Chưa có dữ liệu mới';
   $('spScanLabel').textContent=!liveMode?'Quét LIVE':!isKnown?'Kiểm tra quét':on?'Quét nền ON':'Quét nền OFF';
   $('spScan').dataset.on=on?'true':'false';$('spScan').setAttribute('aria-pressed',String(on));
   $('spScan').disabled=!liveMode;
 }
 function crest(url,name){
   const safe=typeof url==='string'&&/^https:\/\//i.test(url);
   const initials=String(name||'?').split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('');
   return safe?`<span class="sp-crest"><img src="${escape(url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`:`<span class="sp-crest sp-monogram" aria-hidden="true">${escape(initials)}</span>`;
 }
 function renderStats(rows){
   const chosen=rows.find(x=>x.id===state.selectedId)||rows.find(x=>x.top===1);
   const el=$('spStats');
   if(!chosen){el.innerHTML='<h2>Thống kê trận đã chọn</h2><p class="sp-stat-note">Chọn một trận để xem dữ liệu.</p>';return}
   const m=chosen.metrics||{};
   const defs=[['Số cú sút','shots'],['Sút trúng đích','sot'],['Kiểm soát bóng','possession']];
   el.innerHTML=`<h2>Thống kê trận đã chọn</h2><p class="sp-stat-note">${escape(chosen.home)} · ${escape(chosen.away)}${!liveMode?' · Minh họa':' · '+escape(ageLabel(chosen.statsUpdatedAt??chosen.updatedAt))}</p>`+defs.map(([label,key])=>{
     const permitted=!chosen.statsPresence||(chosen.statsPresence[key]!==false&&chosen.statsPresence.side_count===2);
     const h=permitted?number(m.home?.[key]):null,a=permitted?number(m.away?.[key]):null,has=h!==null&&a!==null;
     const unit=key==='possession'?'%':'';
     return `<div class="sp-stat"><span>${label}</span><strong>${h===null?'—':h+unit}</strong><div class="sp-stat-bar" aria-hidden="true">${has&&h>=0&&a>=0&&h+a>0?`<i style="width:${Math.max(0,Math.min(100,h/(h+a)*100))}%"></i>`:''}</div><strong>${a===null?'—':a+unit}</strong></div>`;
   }).join('')+(!m.home||!m.away?'<p class="sp-stat-note">Chưa có thống kê hai đội từ nguồn hiện tại.</p>':'');
 }
 function renderTop(rows){
   const found=rows.find(x=>x.top===1)||null;
   const gate=$('spTopGate'),el=$('spTopContent');
   if(!found){gate.textContent='CHỜ DỮ LIỆU';el.innerHTML='<div class="sp-empty">Chưa có TOP 1 do engine xếp hạng. Hãy quét và kiểm tra dữ liệu trước khi phân tích.</div><button type="button" class="sp-cta" id="spOpenMatches">MỞ DANH SÁCH TRẬN ›</button>';return}
   gate.textContent=({WATCH:'ĐANG THEO DÕI',NO_ENTRY:'CHƯA VÀO',WAIT:'CHỜ XÁC NHẬN',WAIT_PRICE:'CHỜ GIÁ',WAIT_CONFIRM:'CHỜ XÁC NHẬN',PASS:'BỎ QUA',SUITABLE:'PHÙ HỢP',CAUTION:'CẦN THẬN TRỌNG',AVOID:'NÊN TRÁNH'})[found.entry]||found.entry||'CHỜ XÁC NHẬN';
   const dq=found.dq===null||found.dq===undefined?'—':val(found.dq)+(found.dqScale?' / '+found.dqScale:'');
   const freshness=liveMode?stateAge(found):'demo';const freshnessText=freshness==='stale'?'DỮ LIỆU CŨ':freshness==='unknown'?'CHƯA XÁC MINH ĐỘ MỚI':!liveMode?'DỮ LIỆU MINH HỌA':ageLabel(found.updatedAt);
   const edge=found.edge===null||found.edge===undefined?'—':String(found.edge); // Do not invent % units.
   el.innerHTML=`<div class="sp-league">${escape(found.league)} · #${found.id}</div><div class="sp-top-match"><div class="sp-team">${crest(found.homeLogo,found.home)}${escape(found.home)}</div><div><span class="sp-minute ${freshness==='stale'||freshness==='unknown'?'sp-data-warning':''}">${escape(when(found))}</span><div class="sp-score-main">${escape(score(found))}</div></div><div class="sp-team">${crest(found.awayLogo,found.away)}${escape(found.away)}</div></div><div class="sp-metrics"><div class="sp-metric"><small>Chất lượng dữ liệu</small><b>${escape(dq)}</b></div><div class="sp-metric edge"><small>EDGE từ engine</small><b>${escape(edge)}</b></div></div><div class="sp-freshness ${freshness==='stale'||freshness==='unknown'?'sp-data-warning':''}">${escape(freshnessText)}</div><details class="sp-reason"><summary>Lý do ưu tiên${found.engine?' · '+escape(found.engine):''}</summary><p>${escape(found.why||'Chưa có lý do ưu tiên từ engine.')}${found.market?' · Thị trường: '+escape(found.market):''}</p></details><button class="sp-cta" type="button" data-sp-deep="${found.id}">Phân tích DEEP ›</button>`;
 }
 function renderRanking(rows){
   // Consume native rank verbatim. No scoring, competition rules or polling here.
   const ranked=rows.filter(x=>Number.isInteger(x.top)&&x.top>=1&&x.top<=5).sort((a,b)=>a.top-b.top);
   const current=new Map(ranked.map(x=>[x.id,x.top]));
   for(const x of ranked){
     const before=state.previousRanks.get(x.id);
     if(before!==undefined&&before!==x.top)state.rankMoves.set(x.id,before-x.top);
     else if(before===undefined)state.rankMoves.delete(x.id);
   }
   for(const id of state.rankMoves.keys())if(!current.has(id))state.rankMoves.delete(id);
   state.previousRanks=current;
   $('spRankCount').textContent=ranked.length+'/5 trận';
   $('spRankRows').innerHTML=Array.from({length:5},(_,i)=>{
     const rank=i+1,x=ranked.find(row=>row.top===rank);
     if(!x)return `<div class="sp-rank-row sp-rank-empty" role="listitem"><b class="sp-rank-num">${rank}</b><span>Chưa có trận ở TOP ${rank}</span></div>`;
     const move=state.rankMoves.get(x.id),label=move>0?'↑ '+move:move<0?'↓ '+Math.abs(move):'—';
     const moveText=move>0?'Tăng '+move+' hạng':move<0?'Giảm '+Math.abs(move)+' hạng':'Chưa ghi nhận đổi hạng';
     const fresh=liveMode?stateAge(x):'demo',warning=fresh==='stale'?' · DỮ LIỆU CŨ':fresh==='unknown'?' · CHƯA RÕ ĐỘ MỚI':'';
     const engine=x.engine==='H1'?'H1 / HT':x.engine||'—';
     return `<button role="listitem" class="sp-rank-row ${rank===1?'sp-rank-leader':''}" data-sp-open="${x.id}" data-sp-rank="${rank}" type="button" aria-label="TOP ${rank}: ${escape(x.home)} với ${escape(x.away)}"><b class="sp-rank-num">${rank}</b><span class="sp-rank-match"><strong>${escape(x.home)} · ${escape(x.away)}</strong><small>${escape(engine)} · ${escape(when(x))}${escape(warning)}</small></span><span class="sp-rank-result"><strong>${escape(score(x))}</strong><small class="${move>0?'sp-rank-up':move<0?'sp-rank-down':''}" aria-label="${moveText}">${label}</small></span></button>`;
   }).join('');
 }
 function rowHTML(x){
   const live=isLive(x.short),freshness=stateAge(x),stale=freshness==='stale',unknown=liveMode&&freshness==='unknown',badge=live?(stale?'CŨ':unknown?'LIVE ?':'LIVE'):isPre(x.short)?'PRE':val(x.short);
   return `<button role="listitem" class="sp-row" data-sp-open="${x.id}" type="button" aria-label="Xem trận ${escape(x.home)} với ${escape(x.away)}"><span class="sp-live ${live?(stale||unknown?'stale':''):'pre'}">${escape(badge)}</span><span class="sp-teams">${escape(x.home)}<small>${escape(x.away)}</small></span><span class="sp-row-score"><small>${escape(when(x))}</small>${escape(score(x))}</span><span class="sp-row-arrow" aria-hidden="true">›</span></button>`;
 }
 function render(){
   if(!mql.matches)return;
   state.rows=liveMode?fixtureRows():demoRows.map(x=>({...x,loaded:false,updatedAt:null}));
   const ranked=state.rows;
   renderTop(ranked);renderRanking(ranked);renderStats(ranked);
   const list=state.group==='LIVE'?ranked.filter(x=>isLive(x.short)):state.group==='PRE'?ranked.filter(x=>isPre(x.short)):ranked.filter(x=>x.manual===true);
   const visible=list.slice(0,3);
   const titles={LIVE:'Trận LIVE đang có',PRE:'Trận sắp diễn ra',WATCH:'Trận đang theo dõi'};
   $('spListTitle').textContent=titles[state.group]+(list.length?' ('+list.length+')':'');
   $('spRows').innerHTML=visible.length?visible.map(rowHTML).join(''):'<div class="sp-inline-blank">Chưa có trận trong nhóm này.</div>';
   setHeader();state.renderCount++;state.lastUIUpdate=Date.now();
 }
 let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render()})}
 const observed=['matches','feP1Spotlight','feP1SpotMeta','feScanBadge','feScanControlBtn','connMiniStatus','scanStatus'];
 const watcher=new MutationObserver(schedule);
 for(const id of observed){const e=$(id);if(e)watcher.observe(e,{subtree:true,childList:true,characterData:true,attributes:id==='feScanControlBtn',attributeFilter:id==='feScanControlBtn'?['aria-pressed']:undefined})}
 const groups=$('feSportsPremium').querySelector('.sp-tabs');groups.addEventListener('click',e=>{
   const tab=e.target.closest('[data-sp-group]');if(!tab)return;state.group=tab.dataset.spGroup;
   groups.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===tab);b.setAttribute('aria-current',b===tab?'page':'false')});schedule();
 });
 function notice(txt){const e=$('spInlineError');e.hidden=false;e.textContent=txt}
 function nativeSelect(id){
   const bridge=window.FE_SP_NATIVE;
   if(typeof bridge?.selectById!=='function'){
     notice('Cầu nối chọn fixture theo ID chưa sẵn sàng. Mở Match Center để chọn.');return false;
   }
   // Select exactly one native fixture through the original selectFixture(index).
   // Do not scrape DOM text or assume a filtered-list index matches native state.
   if(!bridge.selectById(Number(id))){
     notice('Fixture không tồn tại trong state hiện tại. Hãy quét bằng Match Center trước.');return false;
   }
   state.selectedId=Number(id);
   openNative('analysis');return true;
 }
 $('feSportsPremium').addEventListener('click',e=>{
   const btn=e.target.closest('button');if(!btn)return;
   if(btn.id==='spModeAction'){
     const dest=liveMode?'?mode=demo':'?mode=connected';
     if(!liveMode&&!window.confirm('Chế độ kết nối dùng các chức năng app gốc trên origin PREVIEW riêng. Mọi lệnh quét hoặc ON/OFF chỉ chạy khi ông chủ động bấm. Tiếp tục?'))return;
     location.assign(location.pathname+dest);return;
   }
   if(btn.id==='spScan'){
     if(!liveMode)return;
     const native=$('feScanControlBtn'),pressed=native?.getAttribute('aria-pressed');
     if(pressed!=='true'&&pressed!=='false'){notice('Chưa có trạng thái ON/OFF đã xác minh từ Worker. Mở Cài đặt để kiểm tra.');openNative('settings');return}
     const action=pressed==='true'?'BẬT':'TẮT';
     if(window.confirm(action+' quét nền CHUNG trên cả điện thoại và Desktop? Đây là thao tác thật trên backend.'))native?.click();
     return;
   }
   if(btn.id==='spAll'||btn.id==='spOpenMatches'){openNative('matches');return}
   const deep=btn.dataset.spDeep;if(deep!==undefined){
     if(!liveMode){notice('DEMO: không gọi DEEP hoặc API thật.');return}
     if(nativeSelect(deep)){const native=$('prepareBtn');if(native&&!native.disabled)native.click();else notice('Nút DEEP của app gốc chưa sẵn sàng cho fixture này.')}return;
   }
   const id=btn.dataset.spOpen;if(id!==undefined){if(!liveMode){notice('Đây là fixture DEMO, không thực hiện DEEP/Copy và không gửi API. Đổi sang chế độ dữ liệu thật để chọn trận thật.');return}nativeSelect(id)}
 });
 if(!liveMode){$('spModeAction').textContent='THỬ KẾT NỐI ›'}
 else{$('spModeName').textContent='PREVIEW KẾT NỐI · DỮ LIỆU THẬT';$('spModeSub').textContent='Tự cấu hình riêng; quét/Push/ON-OFF chỉ theo thao tác người dùng.';$('spModeAction').textContent='VỀ DEMO';}
 // One listener only; selecting/route changes will not introduce a second listener.
 window.__FE_SP_DIAGNOSTICS__=Object.freeze({read:()=>({mode,width:innerWidth,renderCount:state.renderCount,rows:state.rows.length,top:state.rows.find(x=>x.top===1)?.id??null,selected:state.selectedId,hasNativeSelect:typeof window.FE_SP_NATIVE?.selectById==='function',hasNativeReader:typeof window.FEUIReadBridge?.read==='function',hasEngineReader:typeof window.FEAddonBridge?.masterRows==='function',observerCount:1,networkMeasurement:'Use browser request trace; no inferred counter'})});
 render();
})();
