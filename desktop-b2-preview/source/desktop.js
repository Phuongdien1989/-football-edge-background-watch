/* FOOTBALL EDGE DESKTOP B2 PREVIEW
   Integration policy:
   - same ORIGINAL #matches and #analysisCard, no cloned IDs or engines;
   - native fixture click delegates to existing selectFixture(i);
   - no renderMasterOpportunityBoard(), network/polling, no D1 writes;
   - DEMO fixtures are separate and explicitly labelled;
   - mobile <=1199px retains the untouched native DOM and layout.
*/
(function(){
'use strict';
if(window.__FE_DESKTOP_B2_LOADED__) return;
window.__FE_DESKTOP_B2_LOADED__=true;
const THRESHOLD=1200;
const app=document.querySelector('body > .app');
if(!app)return;
const demo=Array.isArray(window.FE_B2_DEMO_DATA)?window.FE_B2_DEMO_DATA:[];
const mobileQuery=window.matchMedia('(min-width:'+THRESHOLD+'px)');
const original=document.getElementById('analysisCard');
const originalAnchor=document.createComment('FE_B2_NATIVE_ANALYSIS_ORIGINAL_POSITION');
if(original?.parentNode) original.parentNode.insertBefore(originalAnchor,original);
const elem=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e;};
const shell=elem('div','fe-b2-shell',`
 <aside class="fe-b2-sidebar" aria-label="Điều hướng Desktop">
   <div class="fe-b2-brand"><div class="fe-b2-logo" aria-hidden="true">⚽</div><div class="fe-b2-brandtext"><strong>Football Edge</strong><small>DESKTOP CONTROL CENTER</small></div><button id="b2Collapse" class="fe-b2-icon-btn" aria-label="Thu gọn sidebar">❮</button></div>
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
   <div class="fe-b2-sidebarfoot"><strong>ĐỘC LẬP / OFFLINE</strong><br/>B2 Prototype — không gửi API, không đăng ký Push, không ghi D1.<br/>Mobile gốc được giữ trong cùng tệp.</div>
 </aside>
 <main class="fe-b2-main" id="b2Main">
   <header class="fe-b2-header"><div><div class="fe-b2-eyebrow">FOOTBALL EDGE • WORKSPACE</div><h1 id="b2Title">Tổng quan</h1></div><div class="fe-b2-badges"><span class="fe-b2-pill">Kết nối: <b>OFFLINE</b></span><span class="fe-b2-pill">Dữ liệu mới nhất: <b id="b2Fresh">—</b></span><span class="fe-b2-pill">Quét: <b>KHÔNG BẬT</b></span></div></header>
   <div class="fe-b2-isolation" role="note"><span><b>DEMO • BẢN THỬ OFFLINE</b> — dữ liệu minh họa chỉ dùng kiểm tra bố cục, không phải dự báo hoặc tín hiệu thật.</span><label><input type="checkbox" id="b2DemoMode" checked/> Hiện dữ liệu DEMO</label></div>
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
    <div class="fe-b2-toolbar"><strong>Trung tâm trận đấu</strong><button type="button" class="fe-b2-softbtn fe-b2-disabled" disabled title="Bản thử offline không thực hiện quét">⚡ QUÉT LIVE — CHỈ TRÊN APP THẬT</button><button type="button" class="fe-b2-softbtn" id="b2Refresh">⟳ Cập nhật từ DOM sẵn có</button></div>
    <section class="fe-b2-card fe-b2-tablecard" aria-label="Kết quả quét">
      <div class="fe-b2-tabletop"><strong>KẾT QUẢ QUÉT · MATCH CENTER</strong><span id="b2TableCount">—</span></div>
      <div class="fe-b2-filters">
       <div class="fe-b2-segments" role="group" aria-label="Lọc LIVE/PRE"><button type="button" data-b2-filter="all" aria-pressed="true">Tất cả</button><button type="button" data-b2-filter="LIVE" aria-pressed="false">LIVE</button><button type="button" data-b2-filter="PRE" aria-pressed="false">PRE</button></div>
       <input id="b2Search" class="fe-b2-search" type="search" autocomplete="off" placeholder="Tìm đội, giải hoặc Fixture ID…" aria-label="Tìm kiếm trận" />
       <select id="b2Sort" class="fe-b2-sort" aria-label="Sắp xếp hiển thị"><option value="native">Thứ tự gốc</option><option value="league">Theo giải</option><option value="match">Theo tên trận</option></select>
      </div>
      <div class="fe-b2-table-scroll"><table class="fe-b2-table"><thead><tr><th>GIẢI ĐẤU</th><th>TRẬN ĐẤU</th><th>PHÚT / GIỜ</th><th>TỶ SỐ</th><th>DQ</th><th>TOP / TRẠNG THÁI</th><th>CHI TIẾT</th></tr></thead><tbody id="b2TableBody"></tbody></table></div>
      <div id="b2Empty" class="fe-b2-empty" hidden>Chưa có dữ liệu từ nguồn hiện hành. Bản thử không tự quét hay tạo tín hiệu.</div>
    </section>
   </div>
   <section class="fe-b2-card fe-b2-bottom" id="b2Secondary" aria-label="Công cụ tích hợp"><h3 id="b2SecondaryTitle">Các công cụ đang có</h3><p id="b2SecondaryNote">Lịch sử / Validation / Cài đặt có thể mở bằng sidebar, sử dụng đúng DOM gốc.</p><div class="fe-b2-native-mount" id="b2NativeMount"></div></section>
   <div class="fe-b2-footer">Football Edge B2 • Tham chiếu bố cục mẫu • Chỉ giao diện • Không deploy</div>
 </main>`);
const shade=elem('div','fe-b2-detail-shade');shade.id='b2DetailShade';
const panel=elem('aside','fe-b2-detail',`<div class="fe-b2-detailhead"><div><div class="fe-b2-eyebrow" id="b2DetailMeta">MATCH ANALYSIS</div><b id="b2DetailName">Chi tiết trận</b></div><button id="b2DetailClose" type="button" class="fe-b2-icon-btn fe-b2-detail-close" aria-label="Đóng chi tiết">×</button></div><div class="fe-b2-detailbody"><div id="b2DemoDetail" hidden></div><div id="b2RealDetail"></div></div></aside>`);
shade.setAttribute('aria-hidden','true');panel.setAttribute('aria-hidden','true');panel.setAttribute('aria-label','Chi tiết trận');
document.body.insertBefore(shell,app);document.body.appendChild(shade);document.body.appendChild(panel);
const $=id=>document.getElementById(id);
const state={page:'overview',filter:'all',search:'',sort:'native',demo:true,selected:null,rows:[],drawer:false,originalScrollIntoView:Element.prototype.scrollIntoView,remount:new Map(),pending:false};
const titles={overview:'Tổng quan',matches:'Trận đấu',analysis:'Phân tích',top:'TOP / EDGE',history:'Lịch sử tín hiệu',validation:'Validation',settings:'Cài đặt',system:'API / Hệ thống'};
const isDesktop=()=>mobileQuery.matches;
function clean(v){return String(v==null?'—':v).trim()||'—';}
function escapeHtml(v){return clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fromNative(){
 const cards=Array.from(document.querySelectorAll('#matches > .match'));
 return cards.map((node,i)=>{
  const names=Array.from(node.querySelectorAll('.team-block span')).map(x=>x.textContent.trim());
  const status=node.querySelector('.status-pill')?.textContent?.trim()||'—';
  const foot=node.querySelector('.match-foot')?.textContent||'';
  const id=foot.match(/Fixture\s*#\s*(\d+)/i)?.[1]||'';
  const score=node.querySelector('.score-block strong')?.textContent?.trim()||'—';
  return {id,league:node.querySelector('.league-line span')?.textContent?.trim()||'—',home:names[0]||'—',away:names[1]||'—',phase:/LIVE|\b(?:1H|2H|HT|ET)\b|\d+'/i.test(status)?'LIVE':'PRE',minute:status,score:score==='VS'?'—':score,dq:'—',status:'—',nativeNode:node,index:i,fresh:'Nguồn: DOM hiện có'};
 });
}
function getRows(){return state.demo?demo.map((r,i)=>({...r,index:i,kind:'DEMO'})):fromNative()}
function filtered(rows){
 let out=rows.filter(r=>(state.filter==='all'||r.phase===state.filter)&&[r.league,r.home,r.away,r.id].join(' ').toLowerCase().includes(state.search));
 if(state.sort==='league')out=[...out].sort((a,b)=>a.league.localeCompare(b.league,'vi'));
 if(state.sort==='match')out=[...out].sort((a,b)=>a.home.localeCompare(b.home,'vi'));
 return out;
}
function refresh(){
 const nativeRows=fromNative();const rows=getRows();state.rows=rows;
 const all=filtered(rows);
 $('b2Total').textContent=rows.length ? String(rows.length):'—';
 $('b2Live').textContent=rows.length ? String(rows.filter(x=>x.phase==='LIVE').length):'—';
 $('b2Pre').textContent=rows.length ? String(rows.filter(x=>x.phase==='PRE').length):'—';
 const spot=$('feP1Spotlight')?.textContent?.trim()||'';
 const hasRealTop=Boolean(nativeRows.length && spot && !/Chua co|Chưa có|chờ dữ liệu/i.test(spot));
 $('b2TopFlag').textContent=hasRealTop?'Có':'—';
 $('b2TopText').textContent=state.demo?'DEMO • TOP 1 minh họa chỉ để thử bố cục. Không phải tín hiệu, không có kèo vào.':hasRealTop?spot.slice(0,260):'Chưa có TOP 1 từ engine. TOP không đồng nghĩa được phép vào kèo.';
 $('b2Fresh').textContent=state.demo?'DEMO':'—';
 $('b2TableCount').textContent=(state.demo?'DEMO • ':'')+all.length+' / '+rows.length+' trận';
 $('b2TableBody').innerHTML=all.map(r=>`<tr tabindex="0" role="button" aria-label="Xem chi tiết ${escapeHtml(r.home)} và ${escapeHtml(r.away)}" aria-selected="${state.selected===r.id}" data-index="${r.index}" data-kind="${state.demo?'DEMO':'NATIVE'}"><td class="fe-b2-league">${escapeHtml(r.league)}</td><td><div class="fe-b2-matchnames"><b>${escapeHtml(r.home)}</b><span>vs ${escapeHtml(r.away)}</span></div></td><td><span class="fe-b2-status ${r.phase==='LIVE'?'live':''}">${escapeHtml(r.minute)}</span></td><td><b>${escapeHtml(r.score)}</b></td><td>${escapeHtml(r.dq)}</td><td><span class="fe-b2-status">${escapeHtml(r.status)}</span></td><td><span style="color:#1477ee;font-weight:800">XEM ›</span></td></tr>`).join('');
 $('b2Empty').hidden=!!all.length;$('b2TableBody').parentNode.hidden=!all.length;
 if(state.drawer&&!state.demo&&state.selected&&!nativeRows.some(r=>r.id===state.selected))closeDetail();
}
function openDetail(row){
 if(!row)return;
 state.selected=row.id;state.drawer=true;
 $('b2DetailName').textContent=row.home+' — '+row.away;
 $('b2DetailMeta').textContent=state.demo?'DEMO / KHÔNG PHẢI TRẬN THẬT':'DỮ LIỆU TỪ ENGINE HIỆN HÀNH';
 if(state.demo){
  $('b2DemoDetail').hidden=false;$('b2RealDetail').hidden=true;
  $('b2DemoDetail').innerHTML=`<div class="fe-b2-demo-note"><b>DEMO / OFFLINE</b> — chỉ thử bố cục, không có kết quả phân tích hoặc kèo thật.</div><h2 class="fe-b2-demo-name">${escapeHtml(row.home)}<br/>vs ${escapeHtml(row.away)}</h2><div class="fe-b2-demo-fields"><div><span>GIẢI</span><strong>${escapeHtml(row.league)}</strong></div><div><span>TRẠNG THÁI</span><strong>${escapeHtml(row.phase)} · ${escapeHtml(row.minute)}</strong></div><div><span>TỶ SỐ</span><strong>${escapeHtml(row.score)}</strong></div><div><span>DATA QUALITY</span><strong>—</strong></div><div><span>MARKET / EDGE</span><strong>Chưa có dữ liệu</strong></div><div><span>QUYẾT ĐỊNH</span><strong>Không phát hành tín hiệu</strong></div></div><p style="margin-top:18px;color:#71839b">${escapeHtml(row.note)}</p><p style="color:#71839b">Nút DEEP/Copy bị vô hiệu hóa trong bản offline vì không có nguồn dữ liệu thật để gửi.</p><button class="fe-b2-softbtn" type="button" disabled>DEEP / COPY — Chưa kết nối</button>`;
 } else {
  $('b2DemoDetail').hidden=true;$('b2RealDetail').hidden=false;
  // Delegation to ORIGINAL click owner; update selectedMatch, AUTO mode, engine state.
  row.nativeNode?.click();
 }
 panel.setAttribute('aria-hidden','false');shade.dataset.open='true';shell.dataset.detail='true';refresh();
 $('b2DetailClose').focus();
}
function closeDetail(){state.drawer=false;panel.setAttribute('aria-hidden','true');shade.dataset.open='false';shell.dataset.detail='false'}
function nativeMount(id){
 const e=$(id),mount=$('b2NativeMount');if(!e)return false;
 if(!state.remount.has(id)){
   const mark=document.createComment('FE_B2_ORIGINAL_'+id);
   if(e.parentNode)e.parentNode.insertBefore(mark,e);
   state.remount.set(id,mark);
 }
 mount.appendChild(e);return true;
}
function restoreMounts(){for(const [id,mark] of state.remount){const e=$(id);if(e&&mark.parentNode)mark.parentNode.insertBefore(e,mark.nextSibling)}}
function goto(page){
 if(!titles[page])return;
 state.page=page;$('b2Title').textContent=titles[page];
 shell.querySelectorAll('[data-b2-page]').forEach(b=>{if(b.dataset.b2Page===page)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 $('b2Overview').hidden=page!=='overview'&&page!=='top';
 $('b2MatchesWorkspace').hidden= !['overview','matches','analysis'].includes(page);
 $('b2Secondary').hidden= !['history','validation','settings','system'].includes(page);
 restoreMounts();$('b2NativeMount').textContent='';
 if(page==='analysis'){if(state.selected){const r=state.rows.find(r=>r.id===state.selected);if(r)openDetail(r);} else {closeDetail();goto('matches');return;}}
 else if(page!=='matches') closeDetail();
 if(page==='history'||page==='validation'){
  $('b2SecondaryTitle').textContent=page==='history'?'Lịch sử / Result Tracker từ app gốc':'Validation từ app gốc';
  $('b2SecondaryNote').textContent='Dùng đúng DOM và sự kiện gốc; các cập nhật mạng vẫn bị chặn trong bản thử OFFLINE.';
  nativeMount('betTrackerCard');
  if(page==='validation') $('betTabs')?.querySelector('[data-btab="validation"]')?.click();
  if(page==='history') $('betTabs')?.querySelector('[data-btab="history"]')?.click();
 }
 if(page==='settings'){ $('b2SecondaryTitle').textContent='Cài đặt / Kết nối';$('b2SecondaryNote').textContent='Cài đặt gốc; không nhập khóa thật vào bản thử offline.';nativeMount('connectCard'); }
 if(page==='system'){ $('b2SecondaryTitle').textContent='API / Hệ thống';$('b2SecondaryNote').textContent='Thông tin kỹ thuật gốc, không giả lập self-test PASS.';nativeMount('technicalCard'); }
 if(page==='top'){ $('b2TopText').scrollIntoView({block:'center'}); }
}
function setDesktop(active){
 document.body.classList.toggle('fe-b2-enabled',active);
 if(!active){closeDetail();restoreMounts();if(original&&originalAnchor.parentNode)originalAnchor.parentNode.insertBefore(original,originalAnchor.nextSibling);}
 else if(original&&!panel.contains(original))$('b2RealDetail').appendChild(original);
}
// Prevent native selectFixture() from scrolling the entire B2 table away.
Element.prototype.scrollIntoView=function(opts){
 if(isDesktop() && (this===original||this.id==='analysisCard'))return;
 return state.originalScrollIntoView.call(this,opts);
};
$('b2Collapse').addEventListener('click',()=>{document.body.classList.toggle('fe-b2-sidebar-collapsed');const c=document.body.classList.contains('fe-b2-sidebar-collapsed');$('b2Collapse').textContent=c?'❯':'❮';$('b2Collapse').setAttribute('aria-label',c?'Mở sidebar':'Thu gọn sidebar')});
shell.querySelectorAll('[data-b2-page]').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.b2Page)));
shell.querySelectorAll('[data-b2-filter]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.b2Filter;shell.querySelectorAll('[data-b2-filter]').forEach(z=>z.setAttribute('aria-pressed',String(z===b)));refresh()}));
$('b2Search').addEventListener('input',e=>{state.search=e.target.value.trim().toLocaleLowerCase('vi');refresh()});
$('b2Sort').addEventListener('change',e=>{state.sort=e.target.value;refresh()});
$('b2DemoMode').addEventListener('change',e=>{state.demo=e.target.checked;state.selected=null;closeDetail();refresh()});
$('b2Refresh').addEventListener('click',()=>refresh());
$('b2OpenTop').addEventListener('click',()=>goto('top'));
$('b2DetailClose').addEventListener('click',closeDetail);shade.addEventListener('click',closeDetail);
document.addEventListener('keydown',e=>{if(isDesktop()&&e.key==='Escape'&&state.drawer){closeDetail();$('b2Search').focus()}});
$('b2TableBody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-index]');if(tr){const r=state.rows.find(x=>x.index===Number(tr.dataset.index));openDetail(r)}});
$('b2TableBody').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('tr[data-index]')){e.preventDefault();e.target.click()}});
const sourceMatches=$('matches');if(sourceMatches){new MutationObserver(()=>{if(!state.pending){state.pending=true;requestAnimationFrame(()=>{state.pending=false;if(!state.demo)refresh()})}}).observe(sourceMatches,{childList:true});}
const spot=$('feP1Spotlight');if(spot){new MutationObserver(()=>{if(!state.pending){state.pending=true;requestAnimationFrame(()=>{state.pending=false;if(!state.demo)refresh()})}}).observe(spot,{childList:true,characterData:true,subtree:true});}
mobileQuery.addEventListener('change',e=>{setDesktop(e.matches);if(e.matches)goto('overview')});
setDesktop(isDesktop());goto('overview');refresh();
// Expose READ-ONLY status to automated offline regression only.
window.__FE_B2_STATUS__=()=>({desktop:isDesktop(),page:state.page,demo:state.demo,rows:state.rows.length,drawer:state.drawer,networkDisabled:window.__FE_DESKTOP_B2_ISOLATED_PREVIEW__===true});
})();
