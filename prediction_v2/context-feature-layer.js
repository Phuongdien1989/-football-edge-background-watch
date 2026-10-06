/* FOOTBALL EDGE — Prediction V2 / B2
 * Context / personnel feature extraction.
 * SHADOW ONLY: produces evidence features, never PASS/FAIL and never emits a bet decision.
 */
const finite=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=(v,d=3)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const arr=v=>Array.isArray(v)?v:[];
function percentile(values,x){
  const a=values.map(finite).filter(v=>v!=null).sort((p,q)=>p-q),n=finite(x);if(n==null||!a.length)return null;if(a.length===1)return .5;
  let below=0,equal=0;for(const v of a){if(v<n)below++;else if(v===n)equal++;}return clamp((below+.5*equal)/a.length);
}
function per90(v,minutes){const n=finite(v),m=finite(minutes);return n==null||m==null||m<=0?null:n*90/m}
function pctString(v){if(v==null)return null;const n=parseFloat(String(v).replace('%',''));return Number.isFinite(n)?n:null}
export function normalizeSeasonPlayers(resp,teamId=null){
  const out=[];
  for(const row of arr(resp)){
    const p=row?.player||{};
    for(const s of arr(row?.statistics)){
      if(teamId!=null&&Number(s?.team?.id)!==Number(teamId))continue;
      const g=s?.games||{},go=s?.goals||{},pa=s?.passes||{},du=s?.duels||{},ta=s?.tackles||{},sh=s?.shots||{},dr=s?.dribbles||{},ca=s?.cards||{};
      out.push({id:p.id??null,name:p.name??null,injured:!!p.injured,age:finite(p.age),position:g.position??null,team_id:s?.team?.id??null,league_id:s?.league?.id??null,
        appearances:finite(g.appearences??g.appearances),starts:finite(g.lineups),minutes:finite(g.minutes),rating:finite(g.rating),goals:finite(go.total),assists:finite(go.assists),
        shots:finite(sh.total),shots_on:finite(sh.on),key_passes:finite(pa.key),passes:finite(pa.total),pass_accuracy:pctString(pa.accuracy),tackles:finite(ta.total),interceptions:finite(ta.interceptions),
        duels:finite(du.total),duels_won:finite(du.won),dribble_attempts:finite(dr.attempts),dribble_success:finite(dr.success),yellow:finite(ca.yellow),red:finite(ca.red)});
    }
  }
  const by=new Map();for(const p of out){const k=String(p.id??p.name),prev=by.get(k);if(!prev||(p.minutes||0)>(prev.minutes||0))by.set(k,p)}return [...by.values()];
}
export function addRelativePlayerImportance(players){
  const ps=arr(players).map(p=>({...p})),minutes=ps.map(p=>p.minutes),ratings=ps.map(p=>p.rating),
    ga90=ps.map(p=>per90((p.goals||0)+(p.assists||0),p.minutes)),key90=ps.map(p=>per90(p.key_passes,p.minutes)),duel90=ps.map(p=>per90(p.duels_won,p.minutes));
  for(const p of ps){
    const components=[[percentile(minutes,p.minutes),.30],[percentile(ratings,p.rating),.25],[percentile(ga90,per90((p.goals||0)+(p.assists||0),p.minutes)),.25],
      [percentile(key90,per90(p.key_passes,p.minutes)),.10],[percentile(duel90,per90(p.duels_won,p.minutes)),.10]].filter(([v])=>v!=null);
    const den=components.reduce((s,[,w])=>s+w,0),score=den?components.reduce((s,[v,w])=>s+v*w,0)/den:null;
    p.importance_index=score==null?null:round(score*100,1);p.ga_per90=round(per90((p.goals||0)+(p.assists||0),p.minutes),3);p.key_passes_per90=round(per90(p.key_passes,p.minutes),3);p.duels_won_per90=round(per90(p.duels_won,p.minutes),3);
  }
  return ps.sort((a,b)=>(b.importance_index??-1)-(a.importance_index??-1));
}
function lineupIds(lineup,teamId){
  const team=arr(lineup).find(x=>Number(x?.team_id??x?.team?.id)===Number(teamId)),xi=arr(team?.startXI).map(x=>Number(x?.id??x?.player?.id)).filter(Number.isFinite);
  return {xi,formation:team?.formation??null,coach:team?.coach??null};
}
function injuryIds(injuries,teamId){return arr(injuries).filter(x=>Number(x?.team_id??x?.team?.id)===Number(teamId)).map(x=>Number(x?.player_id??x?.player?.id)).filter(Number.isFinite)}
export function buildPersonnelFeatures({teamId,seasonPlayers,lineups,injuries,livePlayers}={}){
  const ranked=addRelativePlayerImportance(normalizeSeasonPlayers(seasonPlayers,teamId)),map=new Map(ranked.map(p=>[Number(p.id),p])),expectedCore=ranked.filter(p=>(p.minutes||0)>0).slice(0,11),
    expectedIds=new Set(expectedCore.map(p=>Number(p.id))),li=lineupIds(lineups,teamId),xiSet=new Set(li.xi),inj=new Set(injuryIds(injuries,teamId)),
    expectedMean=expectedCore.length?expectedCore.reduce((s,p)=>s+(p.importance_index||0),0)/expectedCore.length:null,xiPlayers=li.xi.map(id=>map.get(id)).filter(Boolean),
    xiMean=xiPlayers.length?xiPlayers.reduce((s,p)=>s+(p.importance_index||0),0)/xiPlayers.length:null,overlap=li.xi.length?[...xiSet].filter(id=>expectedIds.has(id)).length/li.xi.length:null,
    star=ranked.slice(0,3),missingStars=star.filter(p=>li.xi.length&&!xiSet.has(Number(p.id))),injuredCore=expectedCore.filter(p=>inj.has(Number(p.id))||p.injured===true),
    coreTotal=expectedCore.reduce((s,p)=>s+(p.importance_index||0),0)||null,injuryImpact=coreTotal?injuredCore.reduce((s,p)=>s+(p.importance_index||0),0)/coreTotal:null,
    starAbsenceImpact=coreTotal?missingStars.reduce((s,p)=>s+(p.importance_index||0),0)/coreTotal:null;
  let liveTeam=null;if(Array.isArray(livePlayers))liveTeam=livePlayers.find(x=>Number(x?.team_id??x?.team?.id)===Number(teamId));
  const lp=arr(liveTeam?.players).filter(p=>finite(p.rating)!=null),liveRatings=lp.map(p=>finite(p.rating)).filter(v=>v!=null),
    liveTop=lp.sort((a,b)=>(finite(b.rating)||0)-(finite(a.rating)||0)).slice(0,3).map(p=>({id:p.id,name:p.name,rating:finite(p.rating),minutes:finite(p.minutes),position:p.position})),
    coverage={season_players:ranked.length,lineup_xi:li.xi.length,injury_rows:inj.size,live_rated_players:liveRatings.length},
    confidence=round(clamp((Math.min(ranked.length,15)/15*.45)+(Math.min(li.xi.length,11)/11*.30)+(Math.min(liveRatings.length,11)/11*.15)+(injuries!=null?.10:0)),3);
  return {team_id:Number(teamId),coverage,confidence,formation:li.formation,coach:li.coach,squad_sample:ranked.length,
    expected_core:expectedCore.map(p=>({id:p.id,name:p.name,importance:p.importance_index,position:p.position,minutes:p.minutes,rating:p.rating})),
    stars:star.map(p=>({id:p.id,name:p.name,importance:p.importance_index,position:p.position,minutes:p.minutes,rating:p.rating})),
    lineup_strength_ratio:expectedMean&&xiMean!=null?round(xiMean/expectedMean,3):null,lineup_core_overlap:overlap==null?null:round(overlap,3),rotation_index:overlap==null?null:round(1-overlap,3),
    missing_star_count:missingStars.length,missing_stars:missingStars.map(p=>({id:p.id,name:p.name,importance:p.importance_index})),star_absence_share:starAbsenceImpact==null?null:round(starAbsenceImpact,3),
    injured_core_count:injuredCore.length,injured_core:injuredCore.map(p=>({id:p.id,name:p.name,importance:p.importance_index})),injury_core_share:injuryImpact==null?null:round(injuryImpact,3),
    live_rating_mean:liveRatings.length?round(liveRatings.reduce((a,b)=>a+b,0)/liveRatings.length,2):null,live_top_players:liveTop};
}
function fixtureTeamResult(f,teamId){
  const hid=Number(f?.teams?.home?.id??f?.home_id),aid=Number(f?.teams?.away?.id??f?.away_id),gh=finite(f?.goals?.home),ga=finite(f?.goals?.away);
  if(gh==null||ga==null||![hid,aid].includes(Number(teamId)))return null;const gf=Number(teamId)===hid?gh:ga,against=Number(teamId)===hid?ga:gh;
  return {points:gf>against?3:gf===against?1:0,gf,ga:against,gd:gf-against};
}
export function buildScheduleFeatures({teamId,recentFixtures,now=Date.now()}={}){
  const rows=arr(recentFixtures).map(f=>({f,ts:Date.parse(f?.fixture?.date??f?.date??'')})).filter(x=>Number.isFinite(x.ts)&&x.ts<now).sort((a,b)=>b.ts-a.ts),
    last=rows[0],restDays=last?Math.max(0,(now-last.ts)/86400000):null,in7=rows.filter(x=>now-x.ts<=7*86400000),in14=rows.filter(x=>now-x.ts<=14*86400000),
    last5=rows.slice(0,5).map(x=>fixtureTeamResult(x.f,teamId)).filter(Boolean);
  return {rest_days:restDays==null?null:round(restDays,2),matches_last_7d:in7.length,matches_last_14d:in14.length,recent_sample:last5.length,
    recent_ppg:last5.length?round(last5.reduce((s,x)=>s+x.points,0)/last5.length,2):null,recent_goal_diff_per_game:last5.length?round(last5.reduce((s,x)=>s+x.gd,0)/last5.length,2):null};
}
export function buildTeamStrengthFeatures({teamId,standing,teamStats,recentFixtures,side='all'}={}){
  const row=standing||null,all=row?.all||{},venue=side==='home'?row?.home:side==='away'?row?.away:null,played=finite(all.played),pts=finite(row?.points),gd=finite(row?.goalsDiff),
    vPlayed=finite(venue?.played),vWins=finite(venue?.win),vDraws=finite(venue?.draw),goalsForAvg=finite(teamStats?.goals?.for?.average?.total??teamStats?.goals?.for?.average),
    goalsAgainstAvg=finite(teamStats?.goals?.against?.average?.total??teamStats?.goals?.against?.average),sch=buildScheduleFeatures({teamId,recentFixtures});
  return {table_rank:finite(row?.rank),season_ppg:played&&pts!=null?round(pts/played,3):null,season_goal_diff_pg:played&&gd!=null?round(gd/played,3):null,
    venue_ppg:vPlayed?round(((vWins||0)*3+(vDraws||0))/vPlayed,3):null,goals_for_avg:goalsForAvg,goals_against_avg:goalsAgainstAvg,...sch};
}
export function buildMatchContextFeatures(input={}){
  const h=buildPersonnelFeatures({teamId:input.homeId,seasonPlayers:input.homeSeasonPlayers,lineups:input.lineups,injuries:input.injuries,livePlayers:input.livePlayers}),
    a=buildPersonnelFeatures({teamId:input.awayId,seasonPlayers:input.awaySeasonPlayers,lineups:input.lineups,injuries:input.injuries,livePlayers:input.livePlayers}),
    hs=buildTeamStrengthFeatures({teamId:input.homeId,standing:input.homeStanding,teamStats:input.homeTeamStats,recentFixtures:input.homeRecent,side:'home'}),
    as=buildTeamStrengthFeatures({teamId:input.awayId,standing:input.awayStanding,teamStats:input.awayTeamStats,recentFixtures:input.awayRecent,side:'away'}),
    diff=(x,y)=>finite(x)!=null&&finite(y)!=null?round(Number(x)-Number(y),3):null;
  return {schema:'FE_PREDICTION_V2_CONTEXT_FEATURES_B2',shadow_only:true,home:{personnel:h,strength:hs},away:{personnel:a,strength:as},
    deltas:{lineup_strength:diff(h.lineup_strength_ratio,a.lineup_strength_ratio),rotation:diff(a.rotation_index,h.rotation_index),star_availability:diff(a.star_absence_share,h.star_absence_share),
      injury_core:diff(a.injury_core_share,h.injury_core_share),recent_ppg:diff(hs.recent_ppg,as.recent_ppg),season_ppg:diff(hs.season_ppg,as.season_ppg),venue_ppg:diff(hs.venue_ppg,as.venue_ppg),
      rest_days:diff(hs.rest_days,as.rest_days),live_rating:diff(h.live_rating_mean,a.live_rating_mean)},
    note:'Evidence features only. No threshold, PASS/FAIL, probability or stake decision is produced here.'};
}
