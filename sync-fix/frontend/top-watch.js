  // TOP_WATCH_V1: relative attention ranking, never a signal promotion.
  function feTopUsable(it,engine){
    if(!it)return false;
    const e=it.eval||{},s=it.latest||{},state=String(engine==='HC'?e.state:it.state||'');
    const at=Number(s.captured_at||s.fresh_at),age=(Date.now()-at)/1000;
    if(!Number.isFinite(at)||at<=0||age>60||age< -5)return false;
    if(/ENDED|STALE|DATA_WAIT|DATA_INCOMPLETE|CANCELLED|COOLDOWN|MARKET_WATCH/.test(state)||e.hardVeto||e.dataIncomplete)return false;
    if(Number(it.cooldownUntil||0)>Date.now())return false;
    const minute=Number(s.minute),phase=String(s.status||'');
    if(!Number.isFinite(minute))return false;
    if(engine==='H1'&&(!['1H','LIVE'].includes(phase)||minute<20||minute>45))return false;
    if(engine==='FT'&&(!['2H','HT','ET','BT','LIVE','INT'].includes(phase)||minute<45||minute>89))return false;
    if(engine==='HC'&&(!['1H','2H','HT','ET','BT','LIVE','INT'].includes(phase)||minute<25||minute>88))return false;
    if(engine==='HC')return ['FULL','PARTIAL'].includes(e.dataTier)&&e.states?.liveGap!=null&&Number.isFinite(Number(e.states.liveGap));
    return e.score!=null&&Number.isFinite(Number(e.score))&&s.stats_presence?.pressure===true&&s.data_health?.level!=='NO_STATS'&&e.scoreMode!=='DATA_INCOMPLETE';
  }
  function feTopStrength(x,engine){
    const it=engine==='H1'?x.h1:engine==='FT'?x.ft:x.hc;
    return engine==='HC'?Math.abs(Number(it?.eval?.states?.liveGap||0)):Number(it?.eval?.score||0);
  }
  function feTopRelativeKeys(rows){
    // Percentile within each engine: never compare goal score directly to HC GAP.
    for(const engine of ['H1','FT','HC']){
      const peers=rows.filter(x=>x.__rank.eligible&&x.__rank.primary.engine===engine);
      for(const x of peers){const value=feTopStrength(x,engine),below=peers.filter(y=>feTopStrength(y,engine)<value).length;
        x.__rank.strengthPercentile=peers.length>1?below/(peers.length-1):0.5;
      }
    }
    for(const x of rows)x.__rank.key.splice(3,0,x.__rank.strengthPercentile??-1);
  }
