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
fs.writeFileSync(path.join(r,'frontend/index.html'),s);
let reversed=s;for(const [a,b]of [...changes].reverse())reversed=reversed.replace(b,a);if(reversed!==read('rollback/index.html'))throw Error('REGRESSION: baseline mismatch');
const crypto=require('node:crypto');fs.writeFileSync(path.join(r,'SOURCE_LOCK.json'),JSON.stringify({baseline_sha256:crypto.createHash('sha256').update(read('rollback/index.html')).digest('hex'),candidate_sha256:crypto.createHash('sha256').update(s).digest('hex'),css_unchanged:true,dom_layout_unchanged:true,r2_included:false},null,2));
console.log('PASS exact reversal to P2052; CSS and layout unchanged');
