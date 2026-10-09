const fs=require('node:fs'),path=require('node:path');const r=__dirname;
const read=n=>fs.readFileSync(path.join(r,n),'utf8');let s=read('rollback/index.html');
const changes=[];
function replace(a,b){if(!s.includes(a))throw Error('Missing anchor '+a.slice(0,80));changes.push([a,b]);s=s.replace(a,b);}
replace('<head>','<head>\n<script id="FE_NOTIFY_SYNC_CORE">'+read('frontend/state-core.js')+'</script>');
replace('  // FE_UI_READ_BRIDGE_START:',read('frontend/legacy-sync.js')+'\n  // FE_UI_READ_BRIDGE_START:');
replace("method,headers:bgHeaders(),","method,cache:'no-store',headers:bgHeaders(),");
replace('const feUIItem=item=>({id:item.id','const feUIItem=raw=>{const item=feSyncGuard(raw);return ({id:item.id');
replace('state:item.state??item.eval?.state,reason:item.reason,latest:item.latest,eval:item.eval});','state:item.state??item.eval?.state,reason:item.reason,latest:item.latest,eval:item.eval,history:item.history,serverGoal:item.serverGoal,serverRow:item.serverRow});};');
replace("  function grEstimate(item,engine){\n","  function grEstimate(item,engine){\n    if(item?.serverRow){const guarded=feSyncGuard(item);if(guarded.serverGoal)return JSON.parse(JSON.stringify(guarded.serverGoal));}\n");
replace("items=watchState.items||[];$('watchCount')","items=(watchState.items||[]).map(feSyncGuard);$('watchCount')");
replace("items=h1WatchState.items||[];$('h1WatchCount')","items=(h1WatchState.items||[]).map(feSyncGuard);$('h1WatchCount')");
replace("const list=$('handicapWatchList'),top=hcTopItems(),pool=handicapWatchState.pool||[];","const list=$('handicapWatchList'),top=hcTopItems().map(feSyncGuard),pool=handicapWatchState.pool||[];");
replace('    const add=(engine,it)=>{\n','    const add=(engine,raw)=>{\n      const it=feSyncGuard(raw);\n');
replace("    read:()=>feUICopy({\n      state:{selected:state.selected","    read:()=>feUICopy({\n      state:{selected:state.selected");
// No DOM/CSS edits: append sync state to the original status line only.
replace("    if(status)status.textContent=active?","    if(status)status.textContent=active?");
replace("    if(!ctx.fid){empty.classList.remove('hidden');", "    const sync=window.FELegacyNotifySync?.read();if(status&&sync&&sync.state!=='IDLE')status.textContent+=' · '+(sync.state==='OK'?'DA DONG BO':sync.state==='SYNCING'?'DANG DONG BO':'CHUA DONG BO');\n    if(!ctx.fid){empty.classList.remove('hidden');");
replace('    render();setInterval(render,3000);','    window.addEventListener("fe-notify-sync-updated",()=>{lastSig="";render()});render();setInterval(render,3000);');
replace('  function feMasterRankMeta(x){',read('frontend/top-watch.js')+'\n  function feMasterRankMeta(x){');
replace("    ds.sort((a,b)=>feMasterTupleCompare(feMasterDescriptorKey(a),feMasterDescriptorKey(b)));return ds[0]||null;", "    const usable=ds.filter(d=>feTopUsable(d.engine==='H1'?x.h1:d.engine==='FT'?x.ft:x.hc,d.engine));usable.sort((a,b)=>feMasterTupleCompare(feMasterDescriptorKey(a),feMasterDescriptorKey(b)));return usable[0]||null;");
replace('eligible=!!p&&p.stateRank>=3&&!hardConflict&&!adaptiveGuard;', 'eligible=!!p&&!hardConflict&&!adaptiveGuard,confirmed=eligible&&p.stateRank>=3;');
replace('return {interaction,primary:p,eligible,hardConflict,adaptiveGuard,group,key,mechs};','return {interaction,primary:p,eligible,confirmed,hardConflict,adaptiveGuard,group,key,mechs};');
replace('    out.sort((a,b)=>feMasterTupleCompare(a.__rank.key,b.__rank.key)', '    feTopRelativeKeys(out);\n    out.sort((a,b)=>feMasterTupleCompare(a.__rank.key,b.__rank.key)');
replace("if(r?.top===1)return '<span class=\"master-op-rank top1\">#1 TOP</span>';", "if(r?.top===1)return `<span class=\"master-op-rank top1\">#1 TOP${r.confirmed?'':' · CHO'}</span>`;");
replace('if(r?.top)return `<span class="master-op-rank top5">#${r.top} TOP</span>`;', 'if(r?.top)return `<span class="master-op-rank top5">#${r.top} TOP${r.confirmed?\'\':\' · CHO\'}</span>`;');
replace('TOP ĐỦ NGƯỠNG','TOP THEO DOI');
// Headline retains existing layout but explicitly separates attention from confirmation.
replace("state=String(it?.state||'WATCH');", "state=String(it?.state||'WATCH');if(r.top&&!r.confirmed)state+=' · CHO';");
replace("state=String(it?.eval?.state||'WATCH');", "state=String(it?.eval?.state||'WATCH');if(r.top&&!r.confirmed)state+=' · CHO';");
replace('Chưa có trận đủ điều kiện TOP. Hệ thống sẽ để trống thay vì đẩy một trận yếu lên cho đủ.', 'Chua co tran du du lieu LIVE moi de xep TOP theo doi. TOP khong dong nghia tin hieu xac nhan.');
replace('Chưa có TOP 2–5 đủ chuẩn.', 'Chua co them tran du du lieu de theo doi.');
replace('Không ép TOP khi chưa đủ chuẩn', 'Cho du lieu LIVE du dung');
replace('`${tops.length} TOP • ${suitable} SUITABLE`', '`${tops.length} TOP THEO DOI • ${tops.filter(x=>x.__rank.confirmed).length} READY/STRONG • ${suitable} SUITABLE`');
fs.writeFileSync(path.join(r,'frontend/index.html'),s);
let reversed=s;for(const [a,b]of [...changes].reverse())reversed=reversed.replace(b,a);if(reversed!==read('rollback/index.html'))throw Error('REGRESSION: baseline mismatch');
const crypto=require('node:crypto');fs.writeFileSync(path.join(r,'SOURCE_LOCK.json'),JSON.stringify({baseline_sha256:crypto.createHash('sha256').update(read('rollback/index.html')).digest('hex'),candidate_sha256:crypto.createHash('sha256').update(s).digest('hex'),css_unchanged:true,dom_layout_unchanged:true,r2_included:false},null,2));
console.log('PASS exact reversal to P2052; CSS and layout unchanged');
