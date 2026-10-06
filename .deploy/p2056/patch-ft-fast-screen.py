#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED_P2053="ab02d1eb428048bd00a69f56c3e5a16bed3c107feb66110c3ab08a9e84a05069"
MARKER="FE P2.0.5.6 FT FAST SCREEN 2026-10-07"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED_P2053:
    raise SystemExit(f"Refuse patch: expected exact P2053 {EXPECTED_P2053}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

anchor="""    return {meta:compactFixtureMeta(f,mode),coverage,data:n};
  }

  async function mapLimit"""
insert="""    return {meta:compactFixtureMeta(f,mode),coverage,data:n};
  }

  /* FE P2.0.5.6 FT FAST SCREEN 2026-10-07
     FT-only acquisition repair. H1/HC are untouched.
     Goal: do not block FT initial screening on PRE/recent/standings/team context.
     Scoring / thresholds / TOP / QSIG functions are unchanged. */
  async function feSoftAwait(promise,ms,fallback){
    let timer=null;
    try{
      return await Promise.race([
        Promise.resolve(promise).catch(()=>fallback),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),ms)})
      ])
    }finally{if(timer)clearTimeout(timer)}
  }
  async function getFtScreenBundle(f){
    const mode='FT',id=f.fixture.id,home=f.teams.home.id,away=f.teams.away.id,league=f.league.id,season=f.league.season;

    const cachedCoverage=cachePeek('/leagues',{id:league,season});
    const apiCoverage=cachedCoverage
      ? normalizeLeagueCoverage(cachedCoverage,league,season)
      : await feSoftAwait(getLeagueCoverage(league,season),4000,{known:false,league_id:league||null,season:season||null,source:'FT_FAST_UNKNOWN'});

    const cachedLiveBets=cachePeek('/odds/live/bets',{});
    const liveBetRef=cachedLiveBets
      ? normalizeBetReference(cachedLiveBets,'live')
      : await feSoftAwait(getBetReference('live'),4000,{source:'live',count:0,byId:{}});
    const preBetRef=normalizeBetReference(cachePeek('/odds/bets',{})||[],'prematch');
    const betRefs={prematch:preBetRef,live:liveBetRef};

    // Context is cache-first for the initial FT screen. Missing context warms in background
    // and can be used by later refreshes without holding the blocking overlay.
    const sr={
      odds:cachePeek('/odds',{fixture:id}),
      home_recent:cachePeek('/fixtures',{team:home,last:6}),
      away_recent:cachePeek('/fixtures',{team:away,last:6}),
      standings:cachePeek('/standings',{league,season}),
      home_team_stats:cachePeek('/teams/statistics',{league,season,team:home}),
      away_team_stats:cachePeek('/teams/statistics',{league,season,team:away})
    };
    const warm=(path,params,ttl)=>{
      if(cachePeek(path,params)!=null)return;
      footballCached(path,params,ttl,true).catch(()=>{})
    };
    if(coverageAllows(apiCoverage,'odds'))warm('/odds',{fixture:id},CACHE_TTL.prematch_odds);
    warm('/fixtures',{team:home,last:6},CACHE_TTL.recent);
    warm('/fixtures',{team:away,last:6},CACHE_TTL.recent);
    if(league&&season&&coverageAllows(apiCoverage,'standings'))warm('/standings',{league,season},CACHE_TTL.standings);
    if(league&&season){warm('/teams/statistics',{league,season,team:home},CACHE_TTL.team_stats);warm('/teams/statistics',{league,season,team:away},CACHE_TTL.team_stats)}

    const [statistics,events,live_odds]=await Promise.all([
      coverageAllows(apiCoverage,'fixtures.statistics_fixtures')?football('/fixtures/statistics',{fixture:id},true):Promise.resolve(null),
      coverageAllows(apiCoverage,'fixtures.events')?football('/fixtures/events',{fixture:id},true):Promise.resolve(null),
      coverageAllows(apiCoverage,'odds')?football('/odds/live',{fixture:id},true):Promise.resolve(null)
    ]);
    sr.statistics=statistics;sr.events=events;sr.live_odds=live_odds;

    const cacheStatus=cacheRuntimeSummary({
      prematch_odds:['/odds',{fixture:id}],home_recent:['/fixtures',{team:home,last:6}],
      away_recent:['/fixtures',{team:away,last:6}],standings:['/standings',{league,season}]
    });
    const marketCtx={homeName:f.teams.home.name,awayName:f.teams.away.name,betRefs};
    const preOdds=oddsCompact(sr.odds,false,marketCtx).slice(0,12);
    const liveOdds=oddsCompact(sr.live_odds,true,marketCtx).slice(0,12);
    const history=saveLiveOddsSnapshot(id,{fixture:f.fixture,goals:f.goals},liveOdds);
    const allStandings=standingsCompact(sr.standings);
    const n={
      api_coverage:{...apiCoverage,skipped_endpoints:coverageSkipList(apiCoverage,['fixtures.events','fixtures.statistics_fixtures','standings','odds']),ft_fast_screen:true},
      cache_status:cacheStatus,
      live_statistics:statMap(sr.statistics),
      events:eventsCompact(sr.events).slice(-24),
      odds:preOdds,
      live_odds:liveOdds,
      live_market_movement:history,
      home_recent:recentCompact(sr.home_recent).slice(0,6),
      away_recent:recentCompact(sr.away_recent).slice(0,6),
      standings:standingsForTeams(allStandings,f.teams.home.name,f.teams.away.name),
      home_team_stats:teamStatsCompact(sr.home_team_stats),
      away_team_stats:teamStatsCompact(sr.away_team_stats)
    };
    const coverage=groupCoverageScore(mode,n),staleSources=Object.entries(cacheStatus).filter(([,x])=>x?.status==='CACHE_STALE').map(([k,x])=>`${k} ${x.age_sec}s`);
    if(staleSources.length)coverage.warnings=[...new Set([...(coverage.warnings||[]),`CACHE_STALE ${staleSources.join(', ')}`])].slice(0,12);
    return {meta:compactFixtureMeta(f,mode),coverage,data:n};
  }

  async function mapLimit"""
if anchor not in s:
    raise SystemExit("Insertion anchor not found")
s=s.replace(anchor,insert,1)

old="""    try{const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{els.loadingText.textContent=`${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});const screened=await watchSelectUsableBundles(bundles,pref,'FT',WATCH_MAX_ITEMS,watchBundleScore,'FT STATS');const ranked=screened.selected,hs=screened.summary;"""
new="""    try{els.loadingText.textContent=`FT 0/${pref.length} • LIVE stats/events/odds`;const bundles=await mapLimit(pref,4,getFtScreenBundle,(done,n,f)=>{els.loadingText.textContent=`FT ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});const screened=await watchSelectUsableBundles(bundles,pref,'FT',WATCH_MAX_ITEMS,watchBundleScore,'FT STATS');const ranked=screened.selected,hs=screened.summary;"""
if old not in s:
    raise SystemExit("FT start target not found")
s=s.replace(old,new,1)

if "</head>" not in s:
    raise SystemExit("Missing </head>")
s=s.replace("</head>",f"<!-- {MARKER} -->\n</head>",1)
p.write_text(s,encoding="utf-8")
print(hashlib.sha256(s.encode()).hexdigest())
