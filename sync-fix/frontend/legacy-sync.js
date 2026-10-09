  // FE_LEGACY_NOTIFY_SYNC_START — restore server snapshots into existing P2052 views.
  const FE_LEGACY_SYNC={store:window.FEStateCore.makeStore(),inflight:null,lastAt:0,state:'IDLE',error:'',link:window.FEStateCore.deepLink(location.href,location.origin)};
  function feSyncGuard(item){
    if(!item)return item;
    const copy=JSON.parse(JSON.stringify(item)),row=copy.serverRow;
    if(!row)return copy;
    if(Number(copy.latest?.captured_at)>row.captured_at){delete copy.serverRow;delete copy.serverGoal;return copy;}
    const d=window.FEStateCore.disposition(row),pending=['SYNCING','ERROR'].includes(FE_LEGACY_SYNC.state);
    if(d.key==='CURRENT'&&!pending)return copy;
    copy.state=d.key==='ENDED'?'ENDED':d.key==='STALE'?'STALE':'DATA_WAIT';
    copy.reason=pending?(FE_LEGACY_SYNC.state==='SYNCING'?'DANG DONG BO':'CHUA DONG BO · '+FE_LEGACY_SYNC.error):d.label;
    copy.serverGoal={prob:null,source:copy.reason};
    copy.eval={...copy.eval,score:null,scoreMode:'DATA_INCOMPLETE',hardVeto:true,dataIncomplete:true,pressure:null,chance:null,momentum:null,
      core:{available:false,pass:false,strongCount:0,count:0,tests:{}},states:{...(copy.eval?.states||{}),gap:null,liveGap:null,direction:'WAIT'},state:copy.state,recommendation:'WAIT DATA'};
    return copy;
  }
  function feSyncBuild(row,engine,old){
    const f=row.fixture,meta=compactFixtureMeta(f,autoModeForFixture(f)),rt=row.runtime?.[engine]||{},base=row.snapshot||{},at=row.captured_at;
    const item={...(old||{}),id:row.fixture_id,home:f.teams?.home?.name||'',away:f.teams?.away?.name||'',league:f.league?.name||'',initialDQ:base.dq||0,initialIntegrity:base.integrity??null,
      history:JSON.parse(JSON.stringify(rt.history||[])),resetAt:rt.resetAt||0,cooldownUntil:rt.cooldownUntil||0,serverRow:row,serverGoal:engine==='FT'?row.goal_estimate:null};
    let s={...base,...(rt.snapshot||{}),captured_at:at,fresh_at:at,minute:f.fixture.status.elapsed,status:f.fixture.status.short,goals:f.goals,fixture:f,source:'NOTIFY_SERVER'};
    if(engine==='HC'){
      s.metrics=s.metrics?.home? s.metrics:handicapAggregate({},meta);
      s.market=hcMarketFromRows(base.market_rows||[],item.home,item.away);item.marketHistory=[];item.preBaseline={adv:0};
      hcMarketHistory(item,s.market,s);item.latest=s;item.eval=hcEvaluate(item,s);
      // The server HC window uses the prior history, then appends the current point.
      item.history=item.history.concat(s).slice(-140);item.state=item.eval.state;
      if(item.cooldownUntil>Date.now()){item.state='COOLDOWN';item.eval.state='COOLDOWN';}
    }else{
      s.metrics=s.metrics||watchAggregate({},meta);s.stats_presence=s.stats_presence||watchStatsPresence({},meta);
      s.data_health=watchDataHealth(s.stats_presence,null);
      if(engine==='H1'&&!rt.snapshot)s.market=h1WatchMarketInfo(base.market_rows||[],base.market?.history);
      item.latest=s;item.eval=JSON.parse(JSON.stringify(row.engines?.[engine]||(engine==='H1'?h1WatchEvaluate(item,s):watchEvaluate(item,s))));
      (engine==='H1'?h1WatchApplyState:watchApplyState)(item,s,null);
    }
    item.reason=(item.reason||'')+' · SNAPSHOT MAY CHU';
    return item;
  }
  function feSyncApply(packet){
    if(packet?.schema!=='FE_NOTIFY_UI_STATE_V1'||!Array.isArray(packet.snapshots)||packet.snapshots.some(r=>!window.FEStateCore.valid(r)))throw Error('INVALID_SYNC_PACKET');
    const prepared=[];
    for(const row of packet.snapshots){
      const prior=FE_LEGACY_SYNC.store.read(row.fixture_id);if(prior&&(prior.captured_at>row.captured_at||prior.revision>row.revision))continue;
      for(const engine of ['FT','H1','HC']){
        const list=engine==='FT'?watchState.items:engine==='H1'?h1WatchState.items:handicapWatchState.pool;
        const old=list.find(x=>Number(x.id)===row.fixture_id),phase=row.fixture.fixture.status.short;
        if(!old&&((engine==='H1'&&!['1H','LIVE'].includes(phase))||(engine==='FT'&&phase!=='2H')))continue;
        if(old&&Number(old.latest?.captured_at)>row.captured_at)continue;
        prepared.push({engine,item:feSyncBuild(row,engine,old)});
      }
    }
    if(!FE_LEGACY_SYNC.store.apply(packet))return false;
    for(const {engine,item}of prepared){
      const row=FE_LEGACY_SYNC.store.read(item.id);if(row.version!==item.serverRow.version)continue;
      const list=engine==='FT'?watchState.items:engine==='H1'?h1WatchState.items:handicapWatchState.pool,index=list.findIndex(x=>Number(x.id)===item.id);
      if(index<0)list.push(item);else list[index]=item;
      const f=item.latest.fixture,fi=state.fixtures.findIndex(x=>Number(x.fixture.id)===item.id);
      if(fi>=0)state.fixtures[fi]=f;
      if(Number(state.selected?.fixture?.id)===item.id||FE_LEGACY_SYNC.link?.id===item.id)state.selected=f;
    }
    return true;
  }
  function feSyncRender(){
    try{renderLiveWatch()}catch(e){log('FT sync render',e.message)}
    try{renderH1Watch()}catch(e){log('H1 sync render',e.message)}
    try{renderHandicapWatch()}catch(e){log('HC sync render',e.message)}
    try{renderMasterOpportunityBoard();renderUnifiedLiveBoard()}catch(e){log('Master sync render',e.message)}
    window.dispatchEvent(new Event('fe-notify-sync-updated'));
  }
  async function feSyncNotify(){
    if(FE_LEGACY_SYNC.inflight)return FE_LEGACY_SYNC.inflight;
    if(!String(els.bgUrl?.value||'').trim()||!String(els.bgToken?.value||'').trim())return {skipped:true};
    FE_LEGACY_SYNC.state='SYNCING';feSyncRender();
    FE_LEGACY_SYNC.inflight=(async()=>{try{
      const q=new URLSearchParams(),id=FE_LEGACY_SYNC.link?.id||Number(state.selected?.fixture?.id);
      if(id)q.set('fixture',id);let device=FE_PUSH_P02.deviceId;try{device=device||localStorage.getItem(FE_PUSH_P02.deviceKey)}catch{}
      if(device)q.set('device',device);
      const packet=await bgRequest('/api/notify/ui-state?'+q.toString());feSyncApply(packet);
      FE_LEGACY_SYNC.state='OK';FE_LEGACY_SYNC.error='';FE_LEGACY_SYNC.lastAt=Date.now();feSyncRender();
      if(FE_LEGACY_SYNC.link){const target={H1:'h1WatchCard',FT:'liveWatchCard',HC:'handicapWatchCard'}[FE_LEGACY_SYNC.link.mode];document.getElementById(target)?.scrollIntoView({block:'start'});}
      return {ok:true,snapshots:packet.snapshots.length};
    }catch(e){FE_LEGACY_SYNC.state='ERROR';FE_LEGACY_SYNC.error=String(e.message);feSyncRender();return {error:e.message};}
    finally{FE_LEGACY_SYNC.inflight=null;}})();return FE_LEGACY_SYNC.inflight;
  }
  let feSyncResumeTimer;
  const feSyncResume=()=>{if(document.visibilityState==='visible'){clearTimeout(feSyncResumeTimer);feSyncResumeTimer=setTimeout(feSyncNotify,100);}};
  document.addEventListener('visibilitychange',feSyncResume);window.addEventListener('focus',feSyncResume);window.addEventListener('pageshow',feSyncResume);window.addEventListener('online',feSyncResume);
  navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.type==='FE_NOTIFICATION_OPEN'){FE_LEGACY_SYNC.link=window.FEStateCore.deepLink(e.data.url,location.origin);feSyncNotify();}});
  setInterval(()=>{if(document.visibilityState==='visible'){feSyncRender();if(Date.now()-FE_LEGACY_SYNC.lastAt>30000)feSyncNotify();}},10000);
  setTimeout(feSyncNotify,1100);
  window.FELegacyNotifySync=Object.freeze({refresh:feSyncNotify,apply:feSyncApply,read:()=>({state:FE_LEGACY_SYNC.state,lastAt:FE_LEGACY_SYNC.lastAt,error:FE_LEGACY_SYNC.error}),guard:feSyncGuard});
  // FE_LEGACY_NOTIFY_SYNC_END
