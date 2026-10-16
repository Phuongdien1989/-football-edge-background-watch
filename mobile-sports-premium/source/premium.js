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
   {id:910011,league:'Giải minh họa',home:'North City',away:'Riverside',short:'2H',minute:67,scoreHome:1,scoreAway:0,dq:86,top:1,why:'Dữ liệu minh họa, không phải nhận định',entry:'WATCH',market:null,edge:null},
   {id:910012,league:'Giải minh họa',home:'Harbor United',away:'East Town',short:'2H',minute:54,scoreHome:0,scoreAway:0,dq:82,top:null},
   {id:910013,league:'Giải minh họa',home:'Central FC',away:'West Athletic',short:'2H',minute:72,scoreHome:1,scoreAway:1,dq:91,top:null},
   {id:910014,league:'Giải minh họa',home:'Upcoming FC',away:'Future Club',short:'NS',minute:null,scoreHome:null,scoreAway:null,dq:null,top:null}
 ];
 const state={group:'LIVE',selected:null,selectedId:null,rows:[],rank:[],lastUIUpdate:0,renderCount:0};
 const shell=h('div','sp-root',`<div class="sp-mode" id="spMode"><div><strong id="spModeName">DEMO · DỮ LIỆU MINH HỌA</strong><div id="spModeSub">Không kết nối, không quét, không gửi Push.</div></div><button id="spModeAction" type="button">DỮ LIỆU THẬT ›</button></div>
 <section class="sp-card sp-system"><div class="sp-system-info"><i id="spDot" class="sp-dot"></i><div><strong id="spConn">Chưa xác minh</strong><small id="spFresh">Chưa có lần cập nhật từ nguồn</small></div></div><button id="spScan" type="button" class="sp-scan-btn" data-on="false"><span aria-hidden="true">◉</span><span id="spScanLabel">Quét nền: —</span><span class="sp-switch" aria-hidden="true"></span></button></section>
 <nav class="sp-card sp-tabs" aria-label="Nhóm trận"><button class="active" data-sp-group="LIVE" aria-current="page" type="button">◉ LIVE</button><button data-sp-group="PRE" type="button">▦ Sắp diễn ra</button><button data-sp-group="WATCH" type="button">☆ Theo dõi</button></nav>
 <section class="sp-card sp-top" aria-label="TOP 1 từ engine"><div class="sp-top-head"><strong>🏆 TOP 1</strong><span>Ưu tiên phân tích sâu</span><b class="sp-pill" id="spTopGate">CHỜ DỮ LIỆU</b></div><div id="spTopContent" class="sp-top-inner"><div class="sp-empty">Chưa có TOP 1 từ engine.</div></div></section>
 <div class="sp-section-line"><h2 id="spListTitle">Trận đang theo dõi</h2><button id="spAll" type="button">Xem tất cả ›</button></div><div id="spRows" class="sp-list" role="list"></div><p id="spInlineError" class="sp-inline-blank" hidden></p>
 <p class="sp-footer-note">TOP 1 là thứ tự ưu tiên phân tích, không phải xác nhận vào kèo. DQ/EDGE và trạng thái chỉ hiện khi nguồn dữ liệu có giá trị.</p>`);
 shell.id='feSportsPremium';
 // Adds exactly one presentation shell; native app cards remain intact in original DOM.
 const anchor=$('appTop')||document.querySelector('.app');anchor?.insertAdjacentElement('afterend',shell);
 function applyWidth(){document.body.classList.toggle('fe-sp-enabled',mql.matches)}
 mql.addEventListener?.('change',applyWidth);applyWidth();
 function openNative(destination){
   const map={matches:'#scanCard',analysis:'#analysisCard',settings:'#connectCard',tracking:'#betTrackerCard',home:'#appTop'};
   const el=document.querySelector('.bottom-nav .bottom-item[href="'+map[destination]+'"]');
   if(!el)return false;
   el.click();
   if(destination==='settings')$('connectAccordion')?.setAttribute('open','');
   return true;
 }
 function addonRows(){try{const rows=window.FEAddonBridge?.masterRows?.();return Array.isArray(rows)?rows:[]}catch(e){return []}}
 function nativeRows(){try{
   const read=window.FEUIReadBridge?.read?.();return Array.isArray(read?.state?.fixtures)?read.state.fixtures:[];
 }catch{return []}}
 function fixtureRows(){
   const map=new Map();
   for(const f of nativeRows()){
     const id=number(f?.fixture?.id);if(id===null)continue;
     map.set(id,{id,league:val(f?.league?.name),home:val(f?.teams?.home?.name),away:val(f?.teams?.away?.name),short:f?.fixture?.status?.short||null,minute:number(f?.fixture?.status?.elapsed),scoreHome:number(f?.goals?.home),scoreAway:number(f?.goals?.away),timestamp:number(f?.fixture?.timestamp),loaded:true,dq:null,top:null,edge:null,updatedAt:null,why:null});
   }
   const rankings=addonRows();
   for(const x of rankings){
     const id=number(x?.id);if(id===null)continue;
     const rank=x.__rank||{},p=rank.primary||{},s=(x.latest||x.h1||x.ft||x.hc)?.latest||{};
     const row=map.get(id)||{id,league:val(x.league),home:val(x.home),away:val(x.away),short:s.status??null,minute:number(s.minute),scoreHome:number(s?.goals?.home),scoreAway:number(s?.goals?.away),loaded:false};
     row.top=number(rank.top);
     row.dq=number(p?.dq);row.edge=p?.edge??null;row.entry=x.__addon?.entry?.status||null;row.why=x.__addon?.rankWhy||null;row.market=p?.marketLabel||null;
     row.updatedAt=number(s.captured_at??s.fresh_at);
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
 function stateAge(x){return x?.updatedAt===null||x?.updatedAt===undefined?'unknown':Date.now()-(x.updatedAt<1e11?x.updatedAt*1000:x.updatedAt)>120000?'stale':'fresh'}
 function score(x){return x.scoreHome===null||x.scoreHome===undefined||x.scoreAway===null||x.scoreAway===undefined?'—':`${x.scoreHome} – ${x.scoreAway}`}
 function when(x){
   if(isLive(x.short))return x.minute===null?'LIVE • phút —':`${x.minute}′ · ${x.short}`;
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
   $('spConn').textContent=!liveMode?'DEMO • Không kết nối':healthy?'Đã kết nối API':raw&&raw!=='Chưa cấu hình'?'Kết nối cần xác minh':'Chưa cấu hình nguồn';
   $('spConn').className=healthy?'':liveMode?'warn':'';
   $('spDot').className='sp-dot '+(healthy?'ok':liveMode?'warn':'');
   const fresh=(()=>{try{return window.FEAddonBridge?.unified?.()?.lastAt}catch{return null}})();
   $('spFresh').textContent=!liveMode?'Đây chỉ là giao diện thử nghiệm':fresh?'Lần quét: '+ageLabel(fresh):badge&&badge!=='CHƯA KIỂM TRA'?'Worker: '+badge:'Chưa có dữ liệu mới';
   $('spScanLabel').textContent=!liveMode?'Quét nền (DEMO)':!isKnown?'Kiểm tra quét':on?'Quét nền ON':'Quét nền OFF';
   $('spScan').dataset.on=on?'true':'false';$('spScan').setAttribute('aria-pressed',String(on));
   $('spScan').disabled=!liveMode;
 }
 function renderTop(rows){
   const found=rows.find(x=>x.top===1)||null;
   const gate=$('spTopGate'),el=$('spTopContent');
   if(!found){gate.textContent='CHỜ DỮ LIỆU';el.innerHTML='<div class="sp-empty">Chưa có TOP 1 do engine xếp hạng. Hãy quét và kiểm tra dữ liệu trước khi phân tích.</div><button type="button" class="sp-cta" id="spOpenMatches">MỞ DANH SÁCH TRẬN ›</button>';return}
   gate.textContent=val(found.entry)==='—'?'CHỜ XÁC NHẬN':String(found.entry).toUpperCase();
   const dq=found.dq===null||found.dq===undefined?'—':val(found.dq);
   const edge=found.edge===null||found.edge===undefined?'—':String(found.edge); // Do not invent % units.
   el.innerHTML=`<div class="sp-league">${escape(found.league)} · #${found.id}</div><div class="sp-top-match"><div class="sp-team"><span class="sp-crest" aria-hidden="true">⚽</span>${escape(found.home)}</div><div><span class="sp-minute">${escape(when(found))}</span><div class="sp-score-main">${escape(score(found))}</div></div><div class="sp-team"><span class="sp-crest" aria-hidden="true">⚽</span>${escape(found.away)}</div></div><div class="sp-metrics"><div class="sp-metric"><small>Data Quality · theo nguồn</small><b>${escape(dq)}</b></div><div class="sp-metric edge"><small>EDGE · theo engine</small><b>${escape(edge)}</b></div></div><div class="sp-why">${escape(found.why||'Chưa có lý do ưu tiên từ engine.')}${found.market?' · Market: '+escape(found.market):''} · Dữ liệu: ${escape(ageLabel(found.updatedAt))}</div><button class="sp-cta" type="button" data-sp-deep="${found.id}">Phân tích DEEP ›</button>`;
 }
 function rowHTML(x){
   const live=isLive(x.short),stale=stateAge(x)==='stale',badge=live?(stale?'CŨ':'LIVE'):isPre(x.short)?'PRE':val(x.short);
   return `<button role="listitem" class="sp-row" data-sp-open="${x.id}" type="button" aria-label="Xem trận ${escape(x.home)} với ${escape(x.away)}"><span class="sp-live ${live?(stale?'stale':''):'pre'}">${escape(badge)}</span><span class="sp-teams">${escape(x.home)}<small>${escape(x.away)}</small></span><span class="sp-row-score"><small>${escape(when(x))}</small>${escape(score(x))}</span><span class="sp-row-arrow" aria-hidden="true">›</span></button>`;
 }
 function render(){
   if(!mql.matches)return;
   state.rows=liveMode?fixtureRows():demoRows.map(x=>({...x,loaded:false,updatedAt:null}));
   const ranked=state.rows;
   renderTop(ranked);
   const list=state.group==='LIVE'?ranked.filter(x=>isLive(x.short)):state.group==='PRE'?ranked.filter(x=>isPre(x.short)):ranked.filter(x=>x.top!==null&&x.top!==undefined);
   const visible=list.slice(0,3);
   const titles={LIVE:'Trận LIVE đang có',PRE:'Trận sắp diễn ra',WATCH:'Trận trong TOP / EDGE'};
   $('spListTitle').textContent=titles[state.group]+(list.length?' ('+list.length+')':'');
   $('spRows').innerHTML=visible.length?visible.map(rowHTML).join(''):'<div class="sp-inline-blank">Không có trận trong nhóm này. Không tự tạo dữ liệu để lấp danh sách.</div>';
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
   const all=nativeRows();const index=all.findIndex(x=>Number(x?.fixture?.id)===Number(id));
   if(index<0){notice('Fixture không tồn tại trong state hiện tại. Hãy quét trận bằng Match Center trước.');return false}
   // Match Center's existing .match handler executes selectFixture(index).
   const node=$('matches')?.querySelector('.match[data-i="'+index+'"]');
   if(!node){notice('Handler chọn trận gốc chưa sẵn sàng; mở Match Center để chọn.');openNative('matches');return false}
   node.click();openNative('analysis');return true;
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
 window.__FE_SP_DIAGNOSTICS__=Object.freeze({read:()=>({mode,width:innerWidth,renderCount:state.renderCount,rows:state.rows.length,top:state.rows.find(x=>x.top===1)?.id??null,selected:state.selectedId,hasNativeReader:typeof window.FEUIReadBridge?.read==='function',hasEngineReader:typeof window.FEAddonBridge?.masterRows==='function',observerCount:1,addedNetworkRequests:0})});
 render();
})();
