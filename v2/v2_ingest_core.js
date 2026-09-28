export const DQ_VERSION='DQ_V2_0_1_SHADOW';
export const CAPTURE_BUCKET_SEC=15;

export const DQ_CONFIG=Object.freeze({
  weights:{coverage:45,integrity:35,freshness:20},
  pass:{dq:80,coverage:65,integrity:80,freshness:70},
  limited:{dq:60,integrity:65},
  freshness:{
    fixture:[30,90,180,300],
    stats:[90,180,300,600],
    events:[45,120,240,600]
  },
  coreStats:[
    'total_shots','shots_on_goal','shots_inside_box',
    'corner_kicks','possession_pct'
  ],
  extendedStats:[
    'shots_off_goal','blocked_shots','shots_outside_box',
    'fouls','offsides','yellow_cards','red_cards',
    'goalkeeper_saves','total_passes','passes_accurate',
    'passes_pct','expected_goals'
  ]
});

const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Number(n)||0));
const nval=(v)=>{
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='string'){
    const s=v.trim().replace('%','');
    if(!s)return null;
    const n=Number(s);
    return Number.isFinite(n)?n:null;
  }
  const n=Number(v);return Number.isFinite(n)?n:null;
};
const safeObj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const asArray=(v)=>Array.isArray(v)?v:[];
const nowIso=(ms)=>new Date(ms).toISOString();

export function normalizeStatName(name=''){
  return String(name).trim().toLowerCase()
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ');
}

const STAT_MAP=new Map([
  ['shots on goal','shots_on_goal'],
  ['shots on target','shots_on_goal'],
  ['shots off goal','shots_off_goal'],
  ['total shots','total_shots'],
  ['blocked shots','blocked_shots'],
  ['shots insidebox','shots_inside_box'],
  ['shots inside box','shots_inside_box'],
  ['shots outsidebox','shots_outside_box'],
  ['shots outside box','shots_outside_box'],
  ['fouls','fouls'],
  ['corner kicks','corner_kicks'],
  ['corners','corner_kicks'],
  ['offsides','offsides'],
  ['ball possession','possession_pct'],
  ['possession','possession_pct'],
  ['yellow cards','yellow_cards'],
  ['red cards','red_cards'],
  ['goalkeeper saves','goalkeeper_saves'],
  ['total passes','total_passes'],
  ['passes accurate','passes_accurate'],
  ['passes %','passes_pct'],
  ['passes accurate %','passes_pct'],
  ['expected goals','expected_goals'],
  ['expected goals (xg)','expected_goals'],
  ['expectedgoals','expected_goals'],
]);

function extractTeamStats(teamBlock){
  const out={},extras={};
  for(const row of asArray(teamBlock?.statistics)){
    const raw=normalizeStatName(row?.type);
    if(!raw)continue;
    const canonical=STAT_MAP.get(raw);
    const value=nval(row?.value);
    if(canonical)out[canonical]=value;
    else extras[raw]=row?.value ?? null;
  }
  return {stats:out,extras};
}

export function normalizeStatistics(statisticsResponse,fixture){
  const rows=asArray(statisticsResponse);
  const homeId=nval(fixture?.teams?.home?.id);
  const awayId=nval(fixture?.teams?.away?.id);
  const result={home:null,away:null,received:Array.isArray(statisticsResponse),raw_team_count:rows.length};
  for(const block of rows){
    const teamId=nval(block?.team?.id);
    const parsed=extractTeamStats(block);
    const rec={team_id:teamId,name:block?.team?.name||null,...parsed.stats,extras:parsed.extras};
    if(teamId===homeId)result.home=rec;
    else if(teamId===awayId)result.away=rec;
  }
  return result;
}

export function normalizeEvents(eventsResponse){
  return asArray(eventsResponse).map((e,i)=>({
    event_order:i,
    minute:nval(e?.time?.elapsed),
    extra_minute:nval(e?.time?.extra),
    team_id:nval(e?.team?.id),
    player_id:nval(e?.player?.id),
    assist_id:nval(e?.assist?.id),
    event_type:e?.type||null,
    detail:e?.detail||null,
    comments:e?.comments||null
  }));
}

export function normalizeLineups(lineupsResponse){
  return asArray(lineupsResponse).map(l=>({
    team_id:nval(l?.team?.id),
    formation:l?.formation||null,
    coach_id:nval(l?.coach?.id),
    starting_xi:asArray(l?.startXI),
    substitutes:asArray(l?.substitutes)
  }));
}

export function normalizeFixture(f){
  const status=safeObj(f?.fixture?.status);
  return {
    fixture_id:nval(f?.fixture?.id),
    league_id:nval(f?.league?.id),
    season_year:nval(f?.league?.season),
    league_name:f?.league?.name||null,
    country:f?.league?.country||null,
    round_name:f?.league?.round||null,
    kickoff_ts:nval(f?.fixture?.timestamp),
    kickoff_utc:f?.fixture?.date||null,
    timezone:f?.fixture?.timezone||null,
    venue_name:f?.fixture?.venue?.name||null,
    venue_city:f?.fixture?.venue?.city||null,
    referee:f?.fixture?.referee||null,
    status_short:status?.short||null,
    status_long:status?.long||null,
    elapsed:nval(status?.elapsed),
    extra_minute:nval(status?.extra),
    home_team_id:nval(f?.teams?.home?.id),
    away_team_id:nval(f?.teams?.away?.id),
    home_name:f?.teams?.home?.name||null,
    away_name:f?.teams?.away?.name||null,
    score_home:nval(f?.goals?.home) ?? 0,
    score_away:nval(f?.goals?.away) ?? 0,
    ht_home:nval(f?.score?.halftime?.home),
    ht_away:nval(f?.score?.halftime?.away),
    ft_home:nval(f?.score?.fulltime?.home),
    ft_away:nval(f?.score?.fulltime?.away),
  };
}

function freshnessScore(ageSec,bands){
  if(ageSec===null||ageSec===undefined||!Number.isFinite(Number(ageSec)))return null;
  const a=Math.max(0,Number(ageSec));
  if(a<=bands[0])return 100;
  if(a<=bands[1])return 90;
  if(a<=bands[2])return 70;
  if(a<=bands[3])return 50;
  return 20;
}
function avg(values){
  const xs=values.filter(Number.isFinite);
  return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
}
function statsPresence(side){
  if(!side)return {present:0,core_present:0,core_missing:[...DQ_CONFIG.coreStats],fields:[]};
  const fields=[...DQ_CONFIG.coreStats,...DQ_CONFIG.extendedStats].filter(k=>side[k]!==null&&side[k]!==undefined);
  const core_present=DQ_CONFIG.coreStats.filter(k=>side[k]!==null&&side[k]!==undefined).length;
  return {
    present:fields.length,
    core_present,
    core_missing:DQ_CONFIG.coreStats.filter(k=>side[k]===null||side[k]===undefined),
    fields
  };
}

function computeCoverage({fixture,stats,sourceMeta,coverageFlags}){
  const flags=safeObj(coverageFlags),src=safeObj(sourceMeta),checks=[];
  const add=(name,weight,ok,applicable=true)=>{ if(applicable)checks.push({name,weight,ok:!!ok}); };
  add('fixture_id',10,fixture.fixture_id!=null);
  add('teams',10,fixture.home_team_id!=null&&fixture.away_team_id!=null);
  add('status_score',10,!!fixture.status_short&&fixture.score_home!=null&&fixture.score_away!=null);
  add('clock',5,fixture.elapsed!=null||['NS','TBD','PST','CANC','FT','AET','PEN'].includes(fixture.status_short));

  const statsApplicable=flags.statistics_fixtures!==false;
  const hp=statsPresence(stats.home),ap=statsPresence(stats.away);
  add('statistics_response',10,src.statistics_received===true,statsApplicable);
  add('statistics_two_sides',10,!!stats.home&&!!stats.away,statsApplicable);
  add('statistics_core_home',10,hp.core_present>=3,statsApplicable);
  add('statistics_core_away',10,ap.core_present>=3,statsApplicable);

  add('events_feed',10,src.events_received===true,flags.events!==false);
  const lineupApplicable=flags.lineups!==false && src.lineups_expected===true;
  add('lineups_feed',5,src.lineups_received===true,lineupApplicable);

  const total=checks.reduce((s,x)=>s+x.weight,0);
  const got=checks.reduce((s,x)=>s+(x.ok?x.weight:0),0);
  return {score:total?Math.round(100*got/total):0,checks,hp,ap};
}

function checkSideIntegrity(side,label,warnings){
  let penalty=0,critical=false;
  if(!side)return {penalty,critical};
  const nn=['shots_on_goal','shots_off_goal','total_shots','blocked_shots','shots_inside_box',
    'shots_outside_box','fouls','corner_kicks','offsides','yellow_cards','red_cards',
    'goalkeeper_saves','total_passes','passes_accurate','expected_goals'];
  for(const k of nn){
    if(side[k]!=null&&Number(side[k])<0){
      penalty+=30;warnings.push(`${label}_${k}_NEGATIVE`);critical=true;
    }
  }
  if(side.total_shots!=null&&side.shots_on_goal!=null&&side.shots_on_goal>side.total_shots+0.01){
    penalty+=25;warnings.push(`${label}_SOT_GT_SHOTS`);
  }
  if(side.total_shots!=null&&side.shots_inside_box!=null&&side.shots_inside_box>side.total_shots+0.01){
    penalty+=20;warnings.push(`${label}_INBOX_GT_SHOTS`);
  }
  if(side.total_passes!=null&&side.passes_accurate!=null&&side.passes_accurate>side.total_passes+0.01){
    penalty+=20;warnings.push(`${label}_ACCURATE_PASSES_GT_TOTAL`);
  }
  if(side.possession_pct!=null&&(side.possession_pct<0||side.possession_pct>100)){
    penalty+=30;warnings.push(`${label}_POSSESSION_RANGE`);critical=true;
  }
  if(side.passes_pct!=null&&(side.passes_pct<0||side.passes_pct>100)){
    penalty+=25;warnings.push(`${label}_PASS_PCT_RANGE`);
  }
  return {penalty,critical};
}

function cumulativeRegression(cur,prev,tolerance=0){
  if(cur==null||prev==null)return false;
  return Number(cur)+tolerance<Number(prev);
}

function computeIntegrity({fixture,stats,previous}){
  let score=100,critical=false;
  const warnings=[];
  if(fixture.fixture_id==null){score-=100;critical=true;warnings.push('NO_FIXTURE_ID')}
  if(fixture.home_team_id==null||fixture.away_team_id==null){
    score-=60;critical=true;warnings.push('TEAM_ID_MISSING');
  }else if(fixture.home_team_id===fixture.away_team_id){
    score-=100;critical=true;warnings.push('SAME_TEAM_IDS');
  }
  if(fixture.score_home<0||fixture.score_away<0){
    score-=100;critical=true;warnings.push('NEGATIVE_SCORE');
  }

  const h=checkSideIntegrity(stats.home,'HOME',warnings);
  const a=checkSideIntegrity(stats.away,'AWAY',warnings);
  score-=h.penalty+a.penalty;critical=critical||h.critical||a.critical;

  if(stats.home?.possession_pct!=null&&stats.away?.possession_pct!=null){
    const sum=stats.home.possession_pct+stats.away.possession_pct;
    if(sum<85||sum>115){score-=15;warnings.push('POSSESSION_SUM_IMPLAUSIBLE')}
  }

  if(previous){
    if(fixture.elapsed!=null&&previous.fixture?.elapsed!=null &&
       fixture.elapsed < previous.fixture.elapsed-2 &&
       !['HT','2H','ET','BT','P','FT','AET','PEN'].includes(fixture.status_short)){
      score-=25;warnings.push('CLOCK_REGRESSION');
    }
    if(fixture.score_home < (previous.fixture?.score_home??0) ||
       fixture.score_away < (previous.fixture?.score_away??0)){
      score-=35;warnings.push('SCORE_REGRESSION_OR_CORRECTION');
    }
    for(const sideName of ['home','away']){
      const cur=stats[sideName],old=previous.stats?.[sideName];
      if(!cur||!old)continue;
      for(const k of ['total_shots','shots_on_goal','shots_inside_box','corner_kicks','red_cards']){
        if(cumulativeRegression(cur[k],old[k],0)){
          score-=8;warnings.push(`${sideName.toUpperCase()}_${k}_REGRESSION`);
        }
      }
    }
  }
  return {score:clamp(Math.round(score)),critical,warnings:[...new Set(warnings)]};
}

function computeFreshness({fixture,sourceMeta,nowMs}){
  const src=safeObj(sourceMeta),warnings=[];
  const age=(t)=>{
    const x=nval(t);
    return x==null?null:Math.max(0,Math.round((nowMs-x)/1000));
  };
  const fixtureAge=age(src.fixture_fetched_at_ms);
  const statsAge=age(src.statistics_fetched_at_ms);
  const eventsAge=age(src.events_fetched_at_ms);

  const scores=[
    freshnessScore(fixtureAge,DQ_CONFIG.freshness.fixture),
    src.statistics_received===true?freshnessScore(statsAge,DQ_CONFIG.freshness.stats):null,
    src.events_received===true?freshnessScore(eventsAge,DQ_CONFIG.freshness.events):null
  ].filter(Number.isFinite);

  let score=scores.length?Math.round(avg(scores)):35;

  if(fixture.kickoff_ts!=null && fixture.elapsed!=null &&
     !['ET','BT','P','INT','SUSP','FT','AET','PEN'].includes(fixture.status_short)){
    const kickoffAgeMin=(nowMs-fixture.kickoff_ts*1000)/60000;
    if(kickoffAgeMin < -45){
      score=Math.min(score,10);warnings.push('KICKOFF_IN_FUTURE');
    }
    if(kickoffAgeMin > 360){
      score=Math.min(score,10);warnings.push('FIXTURE_TOO_OLD_FOR_LIVE');
    }
    if(kickoffAgeMin-fixture.elapsed > 180){
      score=Math.min(score,20);warnings.push('CLOCK_KICKOFF_MISMATCH');
    }
  }

  if(fixtureAge==null)warnings.push('NO_FIXTURE_FETCH_TIMESTAMP');
  if(src.statistics_received===true&&statsAge==null)warnings.push('NO_STATS_FETCH_TIMESTAMP');
  if(src.events_received===true&&eventsAge==null)warnings.push('NO_EVENTS_FETCH_TIMESTAMP');

  return {
    score:clamp(score),
    source_age_sec:fixtureAge,
    stats_age_sec:statsAge,
    events_age_sec:eventsAge,
    warnings
  };
}

function computeCapabilities({stats,coverageFlags}){
  const hp=statsPresence(stats.home),ap=statsPresence(stats.away);
  const statsUnsupported=safeObj(coverageFlags).statistics_fixtures===false;
  const twoSides=!!stats.home&&!!stats.away;
  const chanceHome=['shots_on_goal','shots_inside_box','expected_goals'].some(k=>stats.home?.[k]!=null);
  const chanceAway=['shots_on_goal','shots_inside_box','expected_goals'].some(k=>stats.away?.[k]!=null);
  const pressure=twoSides&&hp.core_present>=3&&ap.core_present>=3&&(chanceHome||chanceAway);
  const tempo=twoSides&&(
    (stats.home?.total_shots!=null&&stats.away?.total_shots!=null) ||
    (stats.home?.shots_on_goal!=null&&stats.away?.shots_on_goal!=null)
  );
  return {
    statistics_supported:!statsUnsupported,
    two_sided_stats:twoSides,
    attack_pressure:pressure,
    match_tempo:tempo,
    momentum:pressure,
    match_advantage:pressure,
    foundation_state_ready:pressure&&tempo
  };
}

export function computeDataQuality(input){
  const coverage=computeCoverage(input);
  const integrity=computeIntegrity(input);
  const freshness=computeFreshness(input);
  const capability=computeCapabilities(input);

  const w=DQ_CONFIG.weights;
  const dq=Math.round(
    (coverage.score*w.coverage + integrity.score*w.integrity + freshness.score*w.freshness) /
    (w.coverage+w.integrity+w.freshness)
  );

  let gate='INSUFFICIENT';
  if(integrity.critical)gate='BLOCK';
  else if(!capability.foundation_state_ready)gate='INSUFFICIENT';
  else if(
    dq>=DQ_CONFIG.pass.dq &&
    coverage.score>=DQ_CONFIG.pass.coverage &&
    integrity.score>=DQ_CONFIG.pass.integrity &&
    freshness.score>=DQ_CONFIG.pass.freshness
  )gate='PASS';
  else if(dq>=DQ_CONFIG.limited.dq && integrity.score>=DQ_CONFIG.limited.integrity)gate='LIMITED';

  return {
    dq_version:DQ_VERSION,
    dq_score:dq,
    coverage:coverage.score,
    integrity:integrity.score,
    freshness:freshness.score,
    gate_status:gate,
    capability,
    missing_fields:coverage.checks.filter(c=>!c.ok).map(c=>c.name),
    integrity_flags:integrity.warnings,
    freshness_flags:freshness.warnings,
    source_age_sec:freshness.source_age_sec,
    stats_age_sec:freshness.stats_age_sec,
    events_age_sec:freshness.events_age_sec
  };
}

export function buildSnapshot({
  fixtureResponse,
  statisticsResponse,
  eventsResponse,
  lineupsResponse,
  sourceMeta={},
  coverageFlags={},
  previous=null,
  observedAtMs=Date.now(),
  captureIntervalSec=120,
  captureReason='BASE_PERIODIC'
}){
  const fixture=normalizeFixture(fixtureResponse);
  const stats=normalizeStatistics(statisticsResponse,fixtureResponse);
  const events=normalizeEvents(eventsResponse);
  const lineups=normalizeLineups(lineupsResponse);

  const bucket=Math.floor(observedAtMs/(CAPTURE_BUCKET_SEC*1000));
  const snapshotId=`V2-${fixture.fixture_id}-${bucket}`;
  const sourceHash=simpleHash(JSON.stringify({
    fixture:fixtureResponse,stats:statisticsResponse,events:eventsResponse
  }));

  const dq=computeDataQuality({
    fixture,stats,events,lineups,sourceMeta,coverageFlags,previous,nowMs:observedAtMs
  });

  return {
    snapshot_id:snapshotId,
    fixture_id:fixture.fixture_id,
    capture_bucket:bucket,
    capture_interval_sec:captureIntervalSec,
    capture_reason:captureReason,
    observed_at_ms:observedAtMs,
    observed_at_utc:nowIso(observedAtMs),
    fixture,stats,events,lineups,dq,
    source_hash:sourceHash,
    stats_hash:simpleHash(JSON.stringify(stats)),
    event_hash:simpleHash(JSON.stringify(events))
  };
}

export function simpleHash(s=''){
  let h=2166136261;
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).padStart(8,'0');
}
