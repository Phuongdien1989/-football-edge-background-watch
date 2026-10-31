import assert from 'node:assert/strict';
export function patchMobile(source){
 let s=source;
 const once=(a,b)=>{assert.equal(s.split(a).length,2,'MOBILE_PATCH_'+a.slice(0,55));s=s.replace(a,b);};
 once('<span>GOAL RADAR FT</span>','<span>Goal FT · tín hiệu</span>');once('<span>LIVE GAP</span><input id="fePushGapThreshold"','<span>HC GAP · tín hiệu</span><input id="fePushGapThreshold"');
 once('    <div class="fe-push-rules">',`    <div class="fe-push-rules">
      <label class="fe-push-rule"><input id="fePushHTEnabled" type="checkbox" checked/><span>HT · khuyến nghị giá</span><small>Thử nghiệm</small></label>
      <label class="fe-push-rule"><input id="fePushFTOverviewEnabled" type="checkbox" checked/><span>FT Overview · giá</span><small>Thử nghiệm</small></label>
      <label class="fe-push-rule"><input id="fePushFTV2Enabled" type="checkbox" checked/><span>FT AI V2 · giá</span><small>Thử nghiệm</small></label>`);
 once('>SAVE THRESHOLDS</button>','>LƯU THÔNG BÁO</button>');
 once('Mặc định: Goal Radar FT ≥ 70 và |LIVE GAP| ≥ 70. Worker chỉ báo khi tín hiệu cắt lên ngưỡng; Stable Core, TOP Ranking và Entry Policy không bị thay đổi.','HT / FT Overview / FT AI V2: báo khi giá có EV mô hình dương và dữ liệu hợp lệ. Goal FT / HC GAP: tín hiệu theo ngưỡng riêng, chưa phải khuyến nghị giá. Cùng trận gộp tin, chống lặp 5 phút. Chỉ chạy nền khi ông bật LIVE.');
 once('return {enabled:true,goal:!!fePushGoalEnabled?.checked,gap:!!fePushGapEnabled?.checked,',"return {enabled:true,h1:$('fePushHTEnabled')?.checked!==false,ftOverview:$('fePushFTOverviewEnabled')?.checked!==false,ftV2:$('fePushFTV2Enabled')?.checked!==false,goal:!!fePushGoalEnabled?.checked,gap:!!fePushGapEnabled?.checked,");
 once("const p=JSON.parse(localStorage.getItem(FE_PUSH_P02.prefsKey)||'{}');",`const p=JSON.parse(localStorage.getItem(FE_PUSH_P02.prefsKey)||'{}');
      for(const [key,id] of [['h1','fePushHTEnabled'],['ftOverview','fePushFTOverviewEnabled'],['ftV2','fePushFTV2Enabled']])if(typeof p[key]==='boolean'&&$(id))$(id).checked=p[key];`);
 once('Đã bật Push nền • Goal ≥ ${fePushPrefs().goalThreshold} • GAP ≥ ${fePushPrefs().gapThreshold}.','Đã bật Push theo từng cơ chế. Quét nền chỉ chạy khi bật LIVE.');
 once("Đã lưu ngưỡng trên máy. Bấm BẬT THÔNG BÁO để đăng ký với Worker.","Đã lưu lựa chọn trên máy. Bấm ENABLE NOTIFICATIONS để đăng ký với Worker.");
 once('Đã lưu trên Worker • Goal ${fePushPrefs().goal?\'ON\':\'OFF\'} ≥ ${fePushPrefs().goalThreshold} • GAP ${fePushPrefs().gap?\'ON\':\'OFF\'} ≥ ${fePushPrefs().gapThreshold}.','Đã lưu lựa chọn HT / FT Overview / FT AI V2 và ngưỡng tín hiệu Goal / GAP trên Worker.');
 once('Push nền đã liên kết Worker • Goal ≥ ${fePushPrefs().goalThreshold} • GAP ≥ ${fePushPrefs().gapThreshold}.','Push nền đã liên kết Worker · HT / FT / HC dùng đúng loại thông báo đã chọn.');
 once('let s={...base,...(rt.snapshot||{}),captured_at:at,',`if(row.notification_context?.fixtureId===row.fixture_id&&row.notification_context.observedAt===at&&engine==='H1')item.htContext=JSON.parse(JSON.stringify(row.notification_context.ht));
    let s={...base,...(rt.snapshot||{}),captured_at:at,`);
 once("item.htContext=await H1_COLLECTION.history.contextFor(H1_COLLECTION.context,f,async team=>{if(!alive())throw Error('HT_COLLECTION_STOPPED');return footballCached('/fixtures',{team,last:8,status:'FT'},3600000,true);});",`const shared=item.serverRow?.notification_context,source=item.latest;
  if(shared?.fixtureId===item.id&&shared.observedAt===source?.captured_at&&source.source==='NOTIFY_SERVER'&&item.serverRow.source_health?.stats==='OK'&&Date.now()>=source.fresh_at&&Date.now()-source.fresh_at<=55000&&source.status===f.fixture.status.short&&source.goals?.home===f.goals?.home&&source.goals?.away===f.goals?.away)item.htContext=JSON.parse(JSON.stringify(shared.ht));
  else item.htContext=await H1_COLLECTION.history.contextFor(H1_COLLECTION.context,f,async team=>{if(!alive())throw Error('HT_COLLECTION_STOPPED');return footballCached('/fixtures',{team,last:8,status:'FT'},3600000,true);});`);
 return s;
}
export function patchFTAdapter(s){
 const before='const b=bundleById.get(id),n=b?.normalized || {},meta=b?.meta;';
 const after='const shared=it.serverRow?.notification_context;\n    const b=shared?.fixtureId===id&&shared.observedAt===at&&shared.ftBundle?.meta?.fixture_id===id?shared.ftBundle:bundleById.get(id),n=b?.normalized || {},meta=b?.meta;';
 assert.equal(s.split(before).length,2);return s.replace(before,after);
}
export function patchFTSelection(s){
 const old='if(!rows.some(x=>x.id===selected))selected=rows.find(x=>x.rank)?.id??rows[0]?.id??null;';
 assert.equal(s.split(old).length,2);
 return s.replace("let selected=null,last='',lastSelected=null,currentSession=null;","let selected=null,last='',lastSelected=null,currentSession=null,lastRouteFixture=null;")
  .replace("window.addEventListener('fe-notify-sync-updated',sync);","window.addEventListener('fe-notify-sync-updated',sync);window.addEventListener('hashchange',sync);")
  .replace("window.removeEventListener('fe-notify-sync-updated',sync);","window.removeEventListener('fe-notify-sync-updated',sync);window.removeEventListener('hashchange',sync);")
  .replace(old,`const requested=window.FETabsIntegrated?.mode?.().fixture??null;
  if(requested!==lastRouteFixture){if(rows.some(x=>x.id===requested))selected=requested;lastRouteFixture=requested;}
  ${old}`);
}
