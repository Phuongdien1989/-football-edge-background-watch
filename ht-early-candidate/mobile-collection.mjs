export async function loadHTCollectionContext() {
  const now=Date.now(),cached=H1_COLLECTION.context;
  if(cached&&now>=cached.at&&now-cached.at<(cached.error?60000:3600000))return cached;
  try {
    const data=await bgRequest('/api/db/fixture-history?limit=500');
    if(data?.ok!==true||!Array.isArray(data.rows))throw Error('HT_HISTORY_RESPONSE_INVALID');
    H1_COLLECTION.context={at:Date.now(),rows:data.rows.slice(0,500),source:'D1_FIXTURE_HISTORY'};
  }catch(e){H1_COLLECTION.context={at:Date.now(),rows:[],error:String(e.message||e).slice(0,100)};}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('fe-ht-context-updated'));
  return H1_COLLECTION.context;
}

// These functions are embedded inside the existing Mobile closure by build.mjs.
// Dependencies deliberately refer to that app's shared HUB and existing HT tools.
export async function fetchH1CollectionSnapshot(item,f,session) {
  const alive=()=>h1WatchState.active&&session===H1_COLLECTION.generation;
  if(!alive())return null;
  item.htContext=await H1_COLLECTION.history.contextFor(H1_COLLECTION.context,f,async team=>{if(!alive())throw Error('HT_COLLECTION_STOPPED');return footballCached('/fixtures',{team,last:8,status:'FT'},3600000,true);});
  if(!alive())return null;
  const cached=item.latest;
  if(item.serverRow&&cached?.source==='NOTIFY_SERVER'&&item.serverRow.source_health?.stats==='OK'&&Number.isFinite(cached.fresh_at)&&Date.now()>=cached.fresh_at&&Date.now()-cached.fresh_at<=55000
    &&cached.status===f.fixture.status.short&&cached.goals?.home===f.goals?.home&&cached.goals?.away===f.goals?.away) {
    // Reuse a verified server observation without renewing its source time.
    return {...cached,source:'NOTIFY_SERVER'};
  }
  if(Number(f.fixture.status.elapsed)>=20) {
    const s=await fetchH1WatchSnapshot(item,false,f);
    if(!alive()||s.ended)return s;
    // Reuse already acquired fields; no fresh coverage/history/API lookup.
    const entry=ultraEntry(item.id),raw=statMap(entry.fields.stats?.data||[]);
    const q=groupCoverageScore('FT',{live_statistics:raw,events:s.events||[],live_odds:s.market_rows||[]});
    s.dq=q.score;s.integrity=q.integrity_score??null;
    return s;
  }
  const entry=ultraEntry(item.id),hbAt=ULTRA_HUB.heartbeat.at;
  if(Array.isArray(f.statistics)&&f.statistics.length&&hbAt>=Number(entry.fields.stats?.at||0))ultraAcceptField(entry,'stats',f.statistics,hbAt);
  await ultraField(entry,'stats',ULTRA_HUB_POLICY.BACKGROUND.stats,async()=>{
    if(!alive())throw Error('HT_COLLECTION_STOPPED');
    const rows=await football('/fixtures/statistics',{fixture:item.id},true);
    if(!Array.isArray(rows))throw Error('HT_STATS_INVALID_RESPONSE');
    return rows;
  },false);
  if(!alive())return null;
  const meta=compactFixtureMeta(f,autoModeForFixture(f)),raw=statMap(entry.fields.stats?.data||[]),metrics=watchAggregate(raw,meta),presence=watchStatsPresence(raw,meta);
  let u=null;
  const probe={metrics,stats_presence:presence};
  if(HTCollection.activity(probe,item.latest)) {
    // First stats probe is reused by ULTRA HUB; deepen only measured activity.
    u=await ultraLiveRaw(f,item,'H1',false);
    if(!alive())return null;
  }
  const markets=u?.liveOdds||[],events=eventsCompact(u?.eventsRaw||[]),q=groupCoverageScore('FT',{live_statistics:raw,events,live_odds:markets}),at=entry.fields.stats?.at;
  return {captured_at:at,fresh_at:at,minute:f.fixture.status.elapsed,status:f.fixture.status.short,goals:f.goals,metrics,stats_presence:presence,data_health:watchDataHealth(presence,null),
    dq:q.score,integrity:q.integrity_score??null,market:h1WatchMarketInfo(markets,null),market_rows:markets,events,fixture:f,source:'HT_EARLY_SHARED_HUB',market_at:u?.marketAt??null};
}

export async function startH1Watch() {
  if(h1WatchState.refreshing)return;
  const isolation=feCaptureOtherEngines('H1');
  h1WatchInitAudio();
  if(!els.fkey.value.trim()){showToast('err','Chưa có Football API Key','Lưu API key trước.');return;}
  H1_COLLECTION.generation++;h1WatchState.active=true;const session=H1_COLLECTION.generation;
  for(const item of h1WatchState.items||[])H1_COLLECTION.pool.set(Number(item.id),item);
  try {await loadHTCollectionContext();if(h1WatchState.active&&session===H1_COLLECTION.generation)await refreshH1Watch(true);}
  finally {feRestoreOtherEngines(isolation,'START_H1_COLLECTION');}
}

export async function refreshH1Watch(quiet=false) {
  if(!h1WatchState.active||h1WatchState.refreshing)return;
  if(document.visibilityState!=='visible'&&quiet){scheduleH1Watch();return;}
  const session=H1_COLLECTION.generation,alive=()=>h1WatchState.active&&session===H1_COLLECTION.generation;
  H1_COLLECTION.history.beginCycle();
  h1WatchState.refreshing=true;clearTimeout(h1WatchState.timer);h1WatchState.nextAt=0;
  try {
    const hb=await ultraHeartbeat(false);if(!alive())return;
    const fixtures=(hb.rows||[]).filter(h1WatchEligible),ids=new Set(fixtures.map(f=>f.fixture.id));
    h1WatchState.sourceFixtureIds=[...ids];
    for(const incoming of h1WatchState.items||[])if(ids.has(Number(incoming.id))&&incoming.serverRow&&incoming.latest?.source==='NOTIFY_SERVER') {
      const old=H1_COLLECTION.pool.get(Number(incoming.id));
      if(old&&Number(old.latest?.fresh_at||0)>=Number(incoming.latest?.fresh_at||0))continue;
      const rows=new Map([...(old?.history||[]),...(incoming.history||[])].map(s=>[s.source_stats_at??s.fresh_at??s.captured_at,s]));
      const item={...old,...incoming,history:[...rows.values()].sort((a,b)=>a.captured_at-b.captured_at).slice(-90)};
      item.eval=h1WatchEvaluate(item,item.latest);h1WatchApplyState(item,item.latest,null);
      H1_COLLECTION.pool.set(Number(item.id),item);
    }
    for(const [id] of H1_COLLECTION.pool)if(!ids.has(id))H1_COLLECTION.pool.delete(id);
    for(const f of fixtures)if(!H1_COLLECTION.pool.has(f.fixture.id)) {
      const id=f.fixture.id;
      H1_COLLECTION.pool.set(id,{id,home:f.teams?.home?.name||'',away:f.teams?.away?.name||'',league:f.league?.name||'',home_id:f.teams?.home?.id,away_id:f.teams?.away?.id,
        history:h1WatchReadHistory(id),initialDQ:null,initialIntegrity:null,latest:null,state:'BASELINE',reason:'Đang chờ quan sát HT đầu tiên',resetAt:null,cooldownUntil:0,lowStreak:0,peak:0});
    }
    const batch=HTCollection.plan(fixtures,H1_COLLECTION.pool,{enabled:alive(),now:Date.now(),slots:H1_WATCH_MAX_ITEMS});
    await mapLimit(batch,4,async f=>{
      if(!alive())return;
      const item=H1_COLLECTION.pool.get(f.fixture.id),oldState=item.state,previous=item.latest;
      item.lastProbeAt=Date.now();
      try {
        const s=await fetchH1CollectionSnapshot(item,f,session);if(!alive()||!s)return;
        if(s.ended){item.state='ENDED';return;}
        const accepted=HTCollection.appendHistory(item.history,s,Date.now());
        if(!accepted.accepted)return;
        const ev=h1WatchResetEvent(previous,s);
        item.latest=accepted.observation;item.history=accepted.history;item.initialDQ=s.dq;item.initialIntegrity=s.integrity;
        item.dataHealth=s.data_health;item.collectionActive=HTCollection.activity(s,previous);
        item.eval=h1WatchEvaluate(item,item.latest);
        if(HTCollection.isEarly(s)) {
          if(ev){item.resetAt=s.captured_at;item.cooldownUntil=s.captured_at+(ev==='GOAL'?120000:180000);item.history=[item.latest];}
          item.state='BASELINE';item.reason='EARLY OBSERVATION • đang tích lũy HT từ đầu hiệp • chưa định giá kèo';
          h1WatchWriteHistory(item);return;
        }
        const next=async fn=>{if(!alive())return null;return fn();};
        grTrack(item,'H1');
        s.goal_potential=await next(()=>gpBuildShadow(item,s,item.eval,'H1'));
        s.live_vs_market=await next(()=>lvmBuildShadow(item,s.goal_potential,s.market_expectation,'H1'));
        s.line_price_value=await next(()=>lpvBuildShadow(item,s.market_time,s.goal_potential,s.market_expectation,s.live_vs_market,'H1'));
        s.robustness=await next(()=>rbBuildShadow(item,s.goal_potential,s.market_expectation,s.live_vs_market,s.line_price_value,'H1'));
        s.final_model_decision=await next(()=>fmdBuildShadow(item,s,'H1'));
        s.validation=await next(()=>valUpdate(item,s,'H1'));
        await next(()=>fmdAttachValidationT0(item,s));
        s.decision_journal=await next(()=>fmdJournalUpdate(item,s,s.final_model_decision,'H1'));
        await next(()=>fmdBenchmarkRefresh(false));
        if(!alive())return;
        Object.assign(item.latest,s,{captured_at:accepted.observation.captured_at});
        evidenceMaybeRefresh();h1WatchCalSettle(item,s,false);h1WatchApplyState(item,s,ev);qsigUpdateH1(item,s,ev,false);
        h1WatchCalRecord(item,s);h1WatchWriteHistory(item);h1WatchAlert(item,oldState,ev);
      } catch(e) {if(alive()){item.state='STALE';item.reason='HT collection: '+e.message;item.collectionActive=false;}}
    });
    if(!alive())return;
    h1WatchState.items=[...H1_COLLECTION.pool.values()].filter(item=>item.latest&&item.state!=='ENDED'&&Date.now()-Number(item.latest.fresh_at||0)<=55000)
      .sort((a,b)=>Number(b.eval?.score??-1)-Number(a.eval?.score??-1)||Number(b.collectionActive)-Number(a.collectionActive)||a.id-b.id).slice(0,H1_WATCH_MAX_ITEMS);
    h1WatchState.cycle++;renderH1Watch();
    status($('h1WatchStatus'),`HT COLLECTION • ${fixtures.length} trận • ${batch.length}/5 lượt chi tiết • ${h1WatchState.items.filter(x=>HTCollection.isEarly(x.latest)).length} đang tích lũy sớm • ${ultraHubSummary()}`,'ok');
  } catch(e) {if(alive())status($('h1WatchStatus'),'HT collection: '+e.message,'err');}
  finally {h1WatchState.refreshing=false;if(alive())scheduleH1Watch();}
}

export function scheduleH1Watch() {
  clearTimeout(h1WatchState.timer);
  if(!h1WatchState.active||!$('h1WatchAuto')?.checked){h1WatchState.nextAt=0;updateH1WatchClock();return;}
  const ms=h1WatchNextInterval();
  h1WatchState.nextAt=Date.now()+ms;h1WatchState.timer=setTimeout(()=>refreshH1Watch(true),ms);updateH1WatchClock();
}

export function stopH1Watch(silent=false) {
  H1_COLLECTION.generation++;
  if(!silent)feMarkEngineManualStop('H1');
  h1WatchState.active=false;clearTimeout(h1WatchState.timer);h1WatchState.nextAt=0;updateH1WatchClock();
  if(!silent)status($('h1WatchStatus'),'Đã dừng HT collection. Lịch sử đã thu được giữ nguyên.','ok');
}
