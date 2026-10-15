/* FOOTBALL EDGE DESKTOP B2 — REAL INTEGRATION
 * Uses original state via additive fixture bridge and FEAddonBridge.masterRows().
 * Does not call renderMasterOpportunityBoard, dispatch network, poll, or write D1.
 * Only user gestures delegate to genuine original scan/DEEP/Copy/ON-OFF handlers.
 */
(()=>{
 'use strict';
 if(window.__FE_B2_DESKTOP_INTEGRATED__)return;
 window.__FE_B2_DESKTOP_INTEGRATED__=true;
 const WIDTH=1200;
 const mobile=matchMedia('(min-width:'+WIDTH+'px)');
 const app=document.querySelector('body > .app');if(!app)return;
 const $=id=>document.getElementById(id);
 const mk=(tag,cls,html='')=>{const e=document.createElement(tag);e.className=cls;e.innerHTML=html;return e};
 const nativeAnalysis=$('analysisCard');
 const nativeAnchor=document.createComment('B2_NATIVE_ANALYSIS_ANCHOR');
 nativeAnalysis?.parentNode?.insertBefore(nativeAnchor,nativeAnalysis);
const shell=mk('div','fe-b2-shell',`
 <aside class="fe-b2-sidebar" aria-label="Điều hướng Desktop">
   <div class="fe-b2-brand"><div class="fe-b2-logo" aria-hidden="true">⚽</div><div class="fe-b2-brandtext"><strong>Football Edge</strong><small>DESKTOP B2 • LIVE WORKSPACE</small></div><button id="b2Collapse" class="fe-b2-icon-btn" aria-label="Thu gọn sidebar">❮</button></div>
   <nav class="fe-b2-nav" aria-label="Điều hướng chính">
    <button type="button" data-b2-page="overview" aria-current="page"><span class="fe-b2-ni">⌂</span><span class="fe-b2-nav-label">Tổng quan</span></button>
    <button type="button" data-b2-page="matches"><span class="fe-b2-ni">▤</span><span class="fe-b2-nav-label">Trận đấu</span></button>
    <button type="button" data-b2-page="analysis"><span class="fe-b2-ni">◉</span><span class="fe-b2-nav-label">Phân tích</span></button>
    <button type="button" data-b2-page="top"><span class="fe-b2-ni">★</span><span class="fe-b2-nav-label">TOP / EDGE</span></button>
    <button type="button" data-b2-page="history"><span class="fe-b2-ni">◷</span><span class="fe-b2-nav-label">Lịch sử</span></button>
    <button type="button" data-b2-page="validation"><span class="fe-b2-ni">◎</span><span class="fe-b2-nav-label">Validation</span></button>
    <button type="button" data-b2-page="settings"><span class="fe-b2-ni">⚙</span><span class="fe-b2-nav-label">Cài đặt</span></button>
    <button type="button" data-b2-page="system"><span class="fe-b2-ni">⌘</span><span class="fe-b2-nav-label">API / Hệ thống</span></button>
   </nav>
   <div class="fe-b2-sidebarfoot"><strong>DESKTOP • CHUNG BACKEND</strong><br/>Scan Control là trạng thái dùng chung giữa Desktop và điện thoại.<br/>Mọi thao tác thật chỉ diễn ra khi ông chủ động bấm.</div>
 </aside>
 <main class="fe-b2-main" id="b2Main">
   <header class="fe-b2-header"><div><div class="fe-b2-eyebrow">FOOTBALL EDGE • WORKSPACE</div><h1 id="b2Title">Tổng quan</h1></div><div class="fe-b2-badges"><span class="fe-b2-pill">Kết nối: <b id="b2Connection">CHƯA CẤU HÌNH</b></span><span class="fe-b2-pill">Lần quét LIVE: <b id="b2Fresh">—</b></span><span class="fe-b2-pill">Quét dùng chung: <b id="b2SharedScan">CHƯA XÁC MINH</b></span></div></header>
   <div class="fe-b2-shared-warn">⚠ ON/OFF điều khiển chung backend: thao tác trên máy tính cũng ảnh hưởng điện thoại. App Desktop không tự bật quét.</div>
   <div id="b2Overview">
    <section class="fe-b2-kpis" aria-label="Chỉ số tổng quan">
     <article class="fe-b2-card fe-b2-kpi"><span>TỔNG TRẬN</span><strong id="b2Total">—</strong></article>
     <article class="fe-b2-card fe-b2-kpi" data-tone="live"><span>ĐANG LIVE</span><strong id="b2Live">—</strong></article>
     <article class="fe-b2-card fe-b2-kpi" data-tone="blue"><span>PRE / SẮP ĐÁ</span><strong id="b2Pre">—</strong></article>
     <article class="fe-b2-card fe-b2-kpi"><span>TOP 1 TỪ ENGINE</span><strong id="b2TopFlag">—</strong></article>
    </section>
    <section class="fe-b2-card fe-b2-spot" aria-label="TOP 1 Spotlight">
      <div class="fe-b2-spotlabel">★ TOP 1 / EDGE<small>Trạng thái engine, không tự quyết định vào kèo</small></div>
      <div class="fe-b2-spotvalue" id="b2TopText">Chưa có dữ liệu TOP thật.</div>
      <button class="fe-b2-softbtn" id="b2OpenTop" type="button">XEM TOP / EDGE ›</button>
    </section>
   </div>
   <div id="b2MatchesWorkspace">
    <div class="fe-b2-toolbar"><strong>Trung tâm trận đấu</strong><button type="button" class="fe-b2-softbtn" id="b2ScanLive">⚡ QUÉT LIVE</button><button type="button" class="fe-b2-softbtn" id="b2ScanPre">+1H PRE</button><button type="button" class="fe-b2-softbtn" id="b2ScanUnified">QUÉT 3 CHẾ ĐỘ</button><button type="button" class="fe-b2-softbtn" id="b2ScanControl" disabled>ON/OFF CHUNG — CHỜ TRẠNG THÁI</button><button type="button" class="fe-b2-softbtn" id="b2Refresh">⟳ Làm mới hiển thị</button></div>
    <section class="fe-b2-card fe-b2-tablecard" aria-label="Kết quả quét">
      <div class="fe-b2-tabletop"><strong>KẾT QUẢ QUÉT · MATCH CENTER</strong><span id="b2TableCount">—</span></div>
      <div class="fe-b2-filters">
       <div class="fe-b2-segments" role="group" aria-label="Lọc LIVE/PRE"><button type="button" data-b2-filter="all" aria-pressed="true">Tất cả</button><button type="button" data-b2-filter="LIVE" aria-pressed="false">LIVE</button><button type="button" data-b2-filter="PRE" aria-pressed="false">PRE</button></div>
       <input id="b2Search" class="fe-b2-search" type="search" autocomplete="off" placeholder="Tìm đội, giải hoặc Fixture ID…" aria-label="Tìm kiếm trận" />
       <select id="b2Sort" class="fe-b2-sort" aria-label="Sắp xếp hiển thị"><option value="native">Thứ tự gốc</option><option value="league">Theo giải</option><option value="match">Theo tên trận</option></select>
      </div>
      <div class="fe-b2-table-scroll"><table class="fe-b2-table"><thead><tr><th>GIẢI ĐẤU</th><th>TRẬN ĐẤU</th><th>PHÚT / GIỜ</th><th>TỶ SỐ</th><th>DQ</th><th>TOP / TRẠNG THÁI</th><th>CHI TIẾT</th></tr></thead><tbody id="b2TableBody"></tbody></table></div>
      <div id="b2Empty" class="fe-b2-empty" hidden>Chưa có trận trong dữ liệu ứng dụng. Chỉ khi bấm nút quét thật, dữ liệu mới được tải.</div>
    </section>
   </div>
   <section class="fe-b2-card fe-b2-bottom" id="b2Secondary" aria-label="Công cụ tích hợp"><h3 id="b2SecondaryTitle">Các công cụ đang có</h3><p id="b2SecondaryNote">Lịch sử / Validation / Cài đặt từ app gốc; không tạo dữ liệu mới.</p><div class="fe-b2-native-mount" id="b2NativeMount"></div></section>
   <div class="fe-b2-footer">Football Edge B2 • Desktop thử nghiệm • Quota / Scan Control dùng chung với Mobile</div>
 </main>`);

 const shade=mk('div','fe-b2-detail-shade');shade.id='b2DetailShade';shade.setAttribute('aria-hidden','true');
 const panel=mk('aside','fe-b2-detail',`<div class="fe-b2-detailhead"><div><div class="fe-b2-eyebrow" id="b2DetailMeta">MATCH ANALYSIS</div><b id="b2DetailName">Chi tiết trận</b></div><button id="b2DetailClose" type="button" class="fe-b2-icon-btn fe-b2-detail-close" aria-label="Đóng chi tiết">×</button></div><div class="fe-b2-detailbody"><div class="fe-b2-native-actions"><button class="fe-b2-softbtn" id="b2Deep" type="button" disabled>📦 DEEP / TẠO GÓI</button><button class="fe-b2-softbtn" id="b2Copy" type="button" disabled>📋 COPY</button></div><div id="b2SelectionInfo" class="fe-b2-meta">Chọn một trận để phân tích.</div><div id="b2RealDetail"></div></div>`);
 panel.setAttribute('aria-hidden','true');panel.setAttribute('aria-label','Chi tiết trận');
 document.body.insertBefore(shell,app);document.body.append(shade,panel);
 const b=window.FE_B2_NATIVE,addon=window.FEAddonBridge;
 const state={page:'overview',filter:'all',search:'',sort:'native',selected:null,rows:[],drawer:false,mounts:new Map(),queued:false,rankCache:[],stamp:0};
 const pageNames={overview:'Tổng quan',matches:'Trận đấu',analysis:'Phân tích',top:'TOP / EDGE',history:'Lịch sử tín hiệu',validation:'Validation',settings:'Cài đặt',system:'API / Hệ thống'};
 const desktop=()=>mobile.matches;
 const val=x=>x===null||x===undefined||x===''?'—':String(x);
 const escape=x=>val(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const nval=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
 const safeArr=x=>Array.isArray(x)?x:[];
 const liveStatus=short=>['1H','HT','2H','ET','BT','P','INT','SUSP','LIVE'].includes(String(short||''));
 const preStatus=short=>['NS','TBD','PST'].includes(String(short||''));
 function rowsFromEngine(){
  try{return safeArr(addon?.masterRows?.()).filter(x=>Number.isFinite(Number(x.id)))}catch(e){console.warn('B2 engine data unavailable:',e?.message);return []}
 }
 function rowsFromFixture(){
  try{return safeArr(b?.fixtures?.()).filter(x=>Number.isFinite(Number(x.id)))}catch(e){console.warn('B2 fixtures unavailable:',e?.message);return []}
 }
 function mapRows(){
  const fixtures=rowsFromFixture(),ranks=rowsFromEngine(),m=new Map();
  for(const f of fixtures){
   const id=Number(f.id);
   m.set(id,{id,league:f.league||'—',home:f.home||'—',away:f.away||'—',phase:liveStatus(f.short)?'LIVE':preStatus(f.short)?'PRE':'OTHER',short:f.short||null,minute:nval(f.elapsed),kickoff:nval(f.kickoff),goalsHome:nval(f.goalsHome),goalsAway:nval(f.goalsAway),dq:null,top:null,entry:null,why:null,market:null,updatedAt:nval(f.updatedAt),nativeAvailable:true,engine:null});
  }
  for(const x of ranks){
   const id=Number(x.id),s=(x.latest||x.h1||x.ft||x.hc)?.latest||{},p=x.__rank?.primary||{},rank=x.__rank||{},raw=m.get(id)||{id,league:x.league||'—',home:x.home||'—',away:x.away||'—',phase:'OTHER',short:null,minute:null,kickoff:null,goalsHome:null,goalsAway:null,updatedAt:null,nativeAvailable:false};
   // Rank comes strictly from the existing master engine; no custom calculation.
   raw.top=rank.top??null;
   raw.entry=x.__addon?.entry?.status??null;
   raw.why=x.__addon?.rankWhy??null;
   raw.dq=p?.dq??null;raw.market=p?.marketLabel??null;raw.engine=p?.engine??null;
   if(!raw.nativeAvailable){
    raw.short=s.status??null;raw.minute=nval(s.minute);raw.goalsHome=nval(s.goals?.home);raw.goalsAway=nval(s.goals?.away);raw.phase=liveStatus(raw.short)?'LIVE':preStatus(raw.short)?'PRE':'OTHER';raw.updatedAt=nval(s.captured_at??s.fresh_at);
   } else if(s.captured_at!=null||s.fresh_at!=null){raw.updatedAt=nval(s.captured_at??s.fresh_at)}
   // Preserve missing vs zero: neither score nor DQ is coerced from null to zero.
   m.set(id,raw);
  }
  state.rankCache=ranks;
  return [...m.values()];
 }
 function shownTime(x){if(x.phase==='LIVE')return x.minute===null?val(x.short):`${x.minute}' ${val(x.short)}`;if(x.kickoff!==null){const d=new Date(x.kickoff*1000);return Number.isFinite(d.getTime())?d.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'—'}return val(x.short)}
 function shownScore(x){return x.goalsHome===null||x.goalsAway===null?'—':`${x.goalsHome}–${x.goalsAway}`}
 function latest(x){if(x.updatedAt===null)return '—';let ms=x.updatedAt<1e11?x.updatedAt*1000:x.updatedAt;const age=Math.round((Date.now()-ms)/60000);if(!Number.isFinite(age))return '—';return (age<0?'Nguồn báo thời gian tương lai':age===0?'Vừa cập nhật':`${age} phút trước`)}
 function selectedRow(){return state.rows.find(x=>x.id===state.selected)||null}
 function updateButtons(){
  const st=$('feScanControlBtn');const known=st?.hasAttribute('aria-pressed')&&addon?.enabled?.();
  const paused=known?st.getAttribute('aria-pressed')==='true':null;
  $('b2SharedScan').textContent=paused===null?'CHƯA XÁC MINH':paused?'OFF':'ON';$('b2SharedScan').dataset.scan=paused===null?'unknown':paused?'off':'on';
  $('b2ScanControl').disabled=!known;$('b2ScanControl').textContent=paused===null?'ON/OFF CHUNG — CHƯA XÁC MINH':paused?'▶ BẬT LẠI QUÉT CHUNG':'■ TẠM DỪNG QUÉT CHUNG';
  const config=Boolean($('footballKey')?.value?.trim());$('b2Connection').textContent=config?'ĐÃ NHẬP API KEY':'CẦN CẤU HÌNH API';
  const f=selectedRow(),ready=!!f?.nativeAvailable && nval(b?.selectedFixtureId?.())===f.id;
  $('b2Deep').disabled=!ready||!$('prepareBtn');$('b2Copy').disabled=!ready||!(b?.packetReady?.())||!$('copyBtn');
 }
 function refresh(){
  const rows=mapRows();state.rows=rows;
  const all=rows.filter(r=>(state.filter==='all'||r.phase===state.filter)&&[r.league,r.home,r.away,r.id].join(' ').toLocaleLowerCase('vi').includes(state.search));
  if(state.sort==='league')all.sort((x,y)=>x.league.localeCompare(y.league,'vi'));
  if(state.sort==='match')all.sort((x,y)=>x.home.localeCompare(y.home,'vi'));
  const totals=rows.length;
  const fixtureDataKnown=Boolean(b?.fixtureDataLoaded?.())||state.rankCache.length>0;
  $('b2Total').textContent=fixtureDataKnown?String(totals):'—';
  $('b2Live').textContent=fixtureDataKnown?String(rows.filter(x=>x.phase==='LIVE').length):'—';
  $('b2Pre').textContent=fixtureDataKnown?String(rows.filter(x=>x.phase==='PRE').length):'—';
  const top=state.rankCache.find(x=>Number(x.__rank?.top)===1);
  $('b2TopFlag').textContent=state.rankCache.length?String(state.rankCache.filter(x=>x.__rank?.top!=null).length):'—';
  const spotlight=$('b2TopText');spotlight.textContent='';
  if(top){const head=document.createElement('strong');head.textContent=`#1 • ${top.home||'—'} vs ${top.away||'—'} • Fixture #${top.id}`;spotlight.append(head);const d=document.createElement('span');d.className='fe-b2-meta';d.textContent=`${val(top.__addon?.rankWhy)} • ENTRY: ${val(top.__addon?.entry?.status)} • TOP ≠ cho phép vào kèo`;spotlight.append(d)}
  else spotlight.textContent='Chưa có TOP 1 đủ điều kiện từ engine. Không tự đẩy một trận lên cho đủ.';
  $('b2Fresh').textContent=(()=>{const ms=nval(addon?.unified?.()?.lastAt);if(!ms)return '—';return new Date(ms).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit'})})();
  $('b2TableCount').textContent=`${all.length} / ${totals} trận`;
  $('b2TableBody').innerHTML=all.map(x=>`<tr tabindex="0" role="button" data-fixture-id="${x.id}" aria-label="Xem trận ${escape(x.home)} và ${escape(x.away)}" aria-selected="${state.selected===x.id}"><td class="fe-b2-league">${escape(x.league)}</td><td><div class="fe-b2-matchnames"><b>${escape(x.home)}</b><span>vs ${escape(x.away)}<span class="fe-b2-origin"> • #${x.id}</span></span></div></td><td><span class="fe-b2-status ${x.phase==='LIVE'?'live':''}">${escape(shownTime(x))}</span></td><td><b>${escape(shownScore(x))}</b></td><td>${x.dq===null?'—':escape(x.dq)+'/5'}</td><td><span class="fe-b2-status" ${x.top===null?'':'data-warn="'+(!x.entry||x.entry!=='SUITABLE')+'"'}>${x.top!==null?'#'+x.top+' TOP':x.nativeAvailable?'Theo dõi':'—'}</span><span class="fe-b2-meta"> ${escape(x.entry)}</span></td><td><button class="fe-b2-softbtn" type="button" data-open-id="${x.id}">XEM ›</button></td></tr>`).join('');
  $('b2Empty').hidden=all.length!==0;
  $('b2TableBody').parentNode.hidden=all.length===0;
  if(state.drawer&&state.selected!==null){const r=selectedRow();if(!r)closeDetail();else{ $('b2DetailName').textContent=r.home+' — '+r.away;$('b2SelectionInfo').textContent=`Fixture #${r.id} • ${shownTime(r)} • tỷ số ${shownScore(r)} • DQ ${r.dq===null?'—':r.dq+'/5'} • cập nhật ${latest(r)} • ENTRY ${val(r.entry)}. ${r.nativeAvailable?'DEEP bằng hàm gốc.':'Cần quét trận vào Match Center trước khi DEEP.'}`;}}
  updateButtons();
 }
 function closeDetail(){state.drawer=false;panel.setAttribute('aria-hidden','true');shade.dataset.open='false';shell.dataset.detail='false'}
 function openDetail(id){
  const row=state.rows.find(x=>x.id===Number(id));if(!row)return;
  state.selected=row.id;state.drawer=true;
  panel.setAttribute('aria-hidden','false');shade.dataset.open='true';shell.dataset.detail='true';
  if(row.nativeAvailable){
   const ok=b?.selectFixtureById?.(row.id);
   if(!ok){$('b2SelectionInfo').textContent='Không chọn được fixture trong state hiện tại. Quét lại hoặc kiểm tra nguồn.'}
  }
  $('b2DetailMeta').textContent='FIXTURE_ID '+row.id+' • NGUỒN '+(row.nativeAvailable?'FIXTURES':'ENGINE');
  refresh();$('b2DetailClose').focus();
 }
 function mount(id){const node=$(id),target=$('b2NativeMount');if(!node)return false;
  if(!state.mounts.has(id)){const mark=document.createComment('B2_ANCHOR_'+id);node.parentNode?.insertBefore(mark,node);state.mounts.set(id,mark)}
  target.append(node);return true;
 }
 function restore(){for(const [id,mark] of state.mounts){const node=$(id);if(mark.parentNode&&node)mark.parentNode.insertBefore(node,mark.nextSibling)}}
 function goto(page){if(!pageNames[page])return;state.page=page;$('b2Title').textContent=pageNames[page];
  shell.querySelectorAll('[data-b2-page]').forEach(x=>x.setAttribute('aria-current',x.dataset.b2Page===page?'page':'false'));
  $('b2Overview').hidden=!['overview','top'].includes(page);
  $('b2MatchesWorkspace').hidden=!['overview','matches','analysis'].includes(page);
  $('b2Secondary').hidden=!['history','validation','settings','system'].includes(page);
  restore();$('b2NativeMount').textContent='';
  if(page==='history'||page==='validation'){ $('b2SecondaryTitle').textContent=page==='history'?'Lịch sử / Result Tracker':'Validation';$('b2SecondaryNote').textContent='Các kết quả thực từ thành phần gốc';mount('betTrackerCard'); const tab=$('betTabs')?.querySelector(`[data-btab="${page==='history'?'history':'validation'}"]`); if(tab)tab.click(); }
  if(page==='settings'){$('b2SecondaryTitle').textContent='Cài đặt và kết nối';$('b2SecondaryNote').textContent='Không nhúng API key/token vào mã nguồn. Lưu trên origin thử nghiệm nếu ông chủ động nhập.';mount('connectCard')}
  if(page==='system'){$('b2SecondaryTitle').textContent='Hệ thống/API';$('b2SecondaryNote').textContent='Dữ liệu từ chức năng gốc';mount('technicalCard')}
  if(page==='analysis'){const r=selectedRow();if(r)openDetail(r.id);else {closeDetail();state.page='matches';goto('matches')}}else if(page!=='matches')closeDetail();
 }
 function setDesktop(on){document.body.classList.toggle('fe-b2-enabled',on);
  if(on){if(nativeAnalysis&&!panel.contains(nativeAnalysis))$('b2RealDetail').append(nativeAnalysis);}
  else{closeDetail();restore();if(nativeAnalysis&&nativeAnchor.parentNode)nativeAnchor.parentNode.insertBefore(nativeAnalysis,nativeAnchor.nextSibling)}
 }
 const nativeClick=(id)=>{const el=$(id);if(!el||el.disabled)return false;el.click();return true};
 function delegated(id,phrase){if(!nativeClick(id)){$('b2SelectionInfo').textContent=phrase+' không sẵn sàng trên ứng dụng gốc.';return false}return true}
 $('b2Collapse').addEventListener('click',()=>{document.body.classList.toggle('fe-b2-sidebar-collapsed');$('b2Collapse').textContent=document.body.classList.contains('fe-b2-sidebar-collapsed')?'❯':'❮'});
 shell.querySelectorAll('[data-b2-page]').forEach(x=>x.addEventListener('click',()=>goto(x.dataset.b2Page)));
 shell.querySelectorAll('[data-b2-filter]').forEach(x=>x.addEventListener('click',()=>{state.filter=x.dataset.b2Filter;shell.querySelectorAll('[data-b2-filter]').forEach(t=>t.setAttribute('aria-pressed',String(t===x)));refresh()}));
 $('b2Search').addEventListener('input',e=>{state.search=e.target.value.trim().toLocaleLowerCase('vi');refresh()});$('b2Sort').addEventListener('change',e=>{state.sort=e.target.value;refresh()});
 $('b2Refresh').addEventListener('click',()=>refresh());$('b2OpenTop').addEventListener('click',()=>goto('top'));
 $('b2ScanLive').addEventListener('click',()=>{const x=document.querySelector('#scanButtons [data-h="live"]');if(x&&!x.disabled)x.click()});
 $('b2ScanPre').addEventListener('click',()=>{const x=document.querySelector('#scanButtons [data-h="1"]');if(x&&!x.disabled)x.click()});
 $('b2ScanUnified').addEventListener('click',()=>nativeClick('startUnifiedLiveBtn'));
 $('b2ScanControl').addEventListener('click',()=>{if($('b2ScanControl').disabled)return;const requested=window.confirm('Điều khiển ON/OFF là CHUNG với điện thoại và mọi thiết bị. Ông xác nhận thay đổi trạng thái quét của backend?');if(requested)nativeClick('feScanControlBtn')});
 $('b2Deep').addEventListener('click',()=>delegated('prepareBtn','DEEP'));
 $('b2Copy').addEventListener('click',()=>delegated('copyBtn','Copy'));
 $('b2DetailClose').addEventListener('click',closeDetail);shade.addEventListener('click',closeDetail);
 document.addEventListener('keydown',e=>{if(desktop()&&state.drawer&&e.key==='Escape'){closeDetail();$('b2Search').focus()}});
 $('b2TableBody').addEventListener('click',e=>{const t=e.target.closest('tr[data-fixture-id]');if(t)openDetail(Number(t.dataset.fixtureId))});
 $('b2TableBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('tr[data-fixture-id]')){e.preventDefault();e.target.click()}});
 // React to native renders; no new timers, fetches or engine renderer invocations.
 const watch=(id,opts={childList:true,subtree:true,characterData:true})=>{const n=$(id);if(n)new MutationObserver(schedule).observe(n,opts)};
 function schedule(){if(!state.queued){state.queued=true;requestAnimationFrame(()=>{state.queued=false;if(desktop())refresh()})}}
 ['matches','masterOpportunityBoard','feP1Spotlight','feScanBadge','feScanHeartbeat','scanStatus','packetBox'].forEach(id=>watch(id));
 mobile.addEventListener('change',e=>{setDesktop(e.matches);if(e.matches)goto(state.page);});
 setDesktop(desktop());goto('overview');refresh();
 window.__FE_B2_DIAGNOSTICS__=Object.freeze({read:()=>({desktop:desktop(),drawer:state.drawer,fixtureRows:state.rows.length,topRows:state.rankCache.filter(x=>x.__rank?.top!=null).length,activeFixture:state.selected,hasNativeBridge:!!window.FE_B2_NATIVE,hasAddonBridge:!!window.FEAddonBridge})});
})();
