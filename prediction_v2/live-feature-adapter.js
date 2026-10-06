/* FOOTBALL EDGE — Prediction V2 / B3
 * Adapts current FT/H1/HC engine state + B2 context into a continuous feature packet.
 * SHADOW ONLY. Market variables are carried as HOLDOUT metadata and are NOT used by B3 probability.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const safe=(v,d=null)=>finite(v)==null?d:Number(v);
const diffShare=(a,b)=>{const x=finite(a),y=finite(b);if(x==null||y==null)return null;const den=Math.abs(x)+Math.abs(y);return den>0?clamp((x-y)/den,-1,1):0};
function engineMax(engine,key){
  const e=String(engine||'FT').toUpperCase();
  const m=e==='H1'?{game:15,pressure:22,chance:20,momentum:18,context:5,quality:5}:{game:15,pressure:20,chance:20,momentum:15,context:10,quality:5};
  return m[key]||1;
}
function normalizeComponent(v,max){const n=finite(v);return n==null?null:clamp(n/max,0,1)}
function sideMetrics(s,side){const x=s?.metrics?.[side]||{};return {shots:finite(x.shots),sot:finite(x.sot),inbox:finite(x.inbox),corners:finite(x.corners),xg:finite(x.xg),red:finite(x.red)}}
function recentDelta(e){const d=e?.recent5?.delta||e?.delta||{};return {shots:finite(d.shots),sot:finite(d.sot),inbox:finite(d.inbox),corners:finite(d.corners),xg:finite(d.xg)}}
function liveDominance(snapshot){
  const h=sideMetrics(snapshot,'home'),a=sideMetrics(snapshot,'away'),pieces=[];
  const add=(k,w)=>{const d=diffShare(h[k],a[k]);if(d!=null)pieces.push([d,w,k])};
  add('sot',.34);add('xg',.30);add('inbox',.16);add('shots',.12);add('corners',.08);
  const den=pieces.reduce((s,[,w])=>s+w,0);
  return {value:den?round(pieces.reduce((s,[v,w])=>s+v*w,0)/den,3):null,parts:pieces.map(([v,w,k])=>({metric:k,value:round(v,3),weight:w})),home:h,away:a};
}
function contextDirection(context){
  const d=context?.deltas||{},parts=[];
  const add=(name,v,scale,w)=>{const n=finite(v);if(n==null)return;parts.push({name,value:n,normalized:clamp(n/scale,-1,1),weight:w})};
  add('lineup_strength',d.lineup_strength,.25,.24);
  add('star_availability',d.star_availability,.25,.18);
  add('injury_core',d.injury_core,.25,.18);
  add('recent_ppg',d.recent_ppg,1.5,.15);
  add('season_ppg',d.season_ppg,1.5,.10);
  add('venue_ppg',d.venue_ppg,1.5,.08);
  add('rest_days',d.rest_days,5,.04);
  add('live_rating',d.live_rating,1.2,.03);
  const den=parts.reduce((s,x)=>s+x.weight,0);
  return {value:den?round(parts.reduce((s,x)=>s+x.normalized*x.weight,0)/den,3):null,parts};
}
export function buildLiveFeaturePacket({fixtureId,engine='FT',item=null,snapshot=null,evaluation=null,context=null,calibration=null,now=Date.now()}={}){
  const e=evaluation||item?.eval||{},s=snapshot||item?.latest||{},eng=String(engine||'FT').toUpperCase(),dom=liveDominance(s),ctx=contextDirection(context),
    minute=safe(s?.minute,0),scoreHome=safe(s?.goals?.home,0),scoreAway=safe(s?.goals?.away,0),freshAt=finite(s?.fresh_at??s?.captured_at),
    freshness=freshAt==null?null:Math.max(0,(now-freshAt)/1000);
  const comps={
    game:normalizeComponent(e.game,engineMax(eng,'game')),
    pressure:normalizeComponent(e.pressure,engineMax(eng,'pressure')),
    chance:normalizeComponent(e.chance,engineMax(eng,'chance')),
    momentum:normalizeComponent(e.momentum,engineMax(eng,'momentum')),
    legacy_context:normalizeComponent(e.context,engineMax(eng,'context'))
  };
  const available=Object.values(comps).filter(v=>v!=null).length,componentCoverage=available/Object.keys(comps).length,dqRaw=finite(s?.dq),
    qualityComp=normalizeComponent(e.quality,engineMax(eng,'quality')),dq=dqRaw!=null?clamp(dqRaw/100,0,1):qualityComp,
    scoreMode=String(e.scoreMode||e.dataTier||'UNKNOWN').toUpperCase(),partial=/PARTIAL/.test(scoreMode),
    incomplete=/INCOMPLETE|NO_STATS|MARKET_WATCH/.test(scoreMode),baseline=/BASELINE/.test(scoreMode);
  return {
    schema:'FE_PREDICTION_V2_LIVE_FEATURES_B3',shadow_only:true,fixture_id:Number(fixtureId??item?.id)||null,engine:eng,captured_at:now,
    state:{minute,score_home:scoreHome,score_away:scoreAway,score_diff:scoreHome-scoreAway,total_goals:scoreHome+scoreAway,status:s?.status??null},
    live:{components:comps,component_coverage:round(componentCoverage,3),acceleration:finite(e.accel),mature:e.mature===true,
      baseline_age_min:finite(e.baselineAge),recent_delta:recentDelta(e),dominance:dom.value,dominance_parts:dom.parts,home_metrics:dom.home,away_metrics:dom.away},
    context:{packet:context||null,directional_index:ctx.value,directional_parts:ctx.parts,
      home_confidence:finite(context?.home?.personnel?.confidence),away_confidence:finite(context?.away?.personnel?.confidence)},
    quality:{dq:round(dq,3),freshness_sec:freshness==null?null:round(freshness,1),score_mode:scoreMode,partial,incomplete,baseline,
      stats_coverage:finite(s?.stats_presence?.coverage),context_available:!!context},
    calibration:calibration||null,
    market_holdout:{available:e.market_available===true,legacy_market_score:finite(e.market),best_over:e.best_over??null,movement:e.market_movement??null,
      note:'Held out of B3 probability to avoid circularity before B4 market-edge comparison.'}
  };
}
export function buildBundleContextInput(bundle,{homeSeasonPlayers=[],awaySeasonPlayers=[]}={}){
  const n=bundle?.normalized||bundle?.data||{},m=bundle?.meta||{},homeId=Number(m?.teams?.home?.id),awayId=Number(m?.teams?.away?.id),stand=n?.standings||[];
  return {
    homeId,awayId,homeSeasonPlayers,awaySeasonPlayers,lineups:n?.lineups||[],injuries:n?.injuries||[],livePlayers:n?.player_match_stats||[],
    homeStanding:stand.find(x=>Number(x?.team_id)===homeId)||null,awayStanding:stand.find(x=>Number(x?.team_id)===awayId)||null,
    homeTeamStats:n?.home_team_stats||null,awayTeamStats:n?.away_team_stats||null,homeRecent:n?.home_recent||[],awayRecent:n?.away_recent||[]
  };
}
