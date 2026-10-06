/* FOOTBALL EDGE — Prediction V2 / B2
 * Call planner for API-Football Ultra.
 * Uses provider update cadence + fixtures?ids bulk hydration.
 * Pure planning only; it does not perform network calls.
 */
import {API_PRIORITY} from './api-budget-manager.js';
const uniq=a=>[...new Set((a||[]).map(Number).filter(Number.isFinite))];
export function chunkIds(ids,size=20){const a=uniq(ids),out=[];for(let i=0;i<a.length;i+=size)out.push(a.slice(i,i+size));return out}
export const ENDPOINT_CADENCE=Object.freeze({
  liveHeartbeatMs:15000,bulkFixtureDetailMs:60000,hotBulkFixtureDetailMs:30000,
  liveOddsHotMs:12000,liveOddsActiveMs:20000,liveOddsBackgroundMs:60000,halfStatsMs:60000,
  injuriesMs:4*60*60*1000,standingsMs:60*60*1000,teamStatsMs:12*60*60*1000,
  predictionsMs:60*60*1000,prematchOddsMs:3*60*60*1000,h2hMs:6*60*60*1000,
  recentMs:30*60*1000,seasonPlayersMs:12*60*60*1000,lineupMissingRetryMs:10*60*1000
});
export function tierFromCandidate(x={}){
  const s=String(x.state||x.eval?.state||'').toUpperCase(),score=Number(x.score??x.eval?.score??0);
  if(x.hot===true||/STRONG|READY|QUALIFIED/.test(s)||score>=78)return 'HOT';
  if(/CANDIDATE|WATCH|LEAN|BIAS/.test(s)||score>=58)return 'ACTIVE';
  return 'BACKGROUND';
}
export function planLiveCalls({fixtures=[],candidates=[],now=Date.now(),lastSeen={}}={}){
  const byCandidate=new Map((candidates||[]).map(x=>[Number(x.fixture_id??x.id),x])),
    live=fixtures.filter(f=>Number.isFinite(Number(f?.fixture?.id??f?.id))),hot=[],active=[],background=[];
  for(const f of live){const id=Number(f?.fixture?.id??f?.id),t=tierFromCandidate(byCandidate.get(id)||{});(t==='HOT'?hot:t==='ACTIVE'?active:background).push(id)}
  const calls=[{key:'live:all',path:'/fixtures',params:{live:'all'},priority:API_PRIORITY.CRITICAL,minIntervalMs:ENDPOINT_CADENCE.liveHeartbeatMs,purpose:'GLOBAL_LIVE_HEARTBEAT'}];
  for(const ids of chunkIds(hot,20))calls.push({key:`bulk:hot:${ids.join('-')}`,path:'/fixtures',params:{ids:ids.join('-')},priority:API_PRIORITY.HIGH,minIntervalMs:ENDPOINT_CADENCE.hotBulkFixtureDetailMs,purpose:'HOT_EMBEDDED_DETAIL'});
  for(const ids of chunkIds(active,20))calls.push({key:`bulk:active:${ids.join('-')}`,path:'/fixtures',params:{ids:ids.join('-')},priority:API_PRIORITY.MEDIUM,minIntervalMs:ENDPOINT_CADENCE.bulkFixtureDetailMs,purpose:'ACTIVE_EMBEDDED_DETAIL'});
  for(const ids of chunkIds(background,20))calls.push({key:`bulk:bg:${ids.join('-')}`,path:'/fixtures',params:{ids:ids.join('-')},priority:API_PRIORITY.LOW,minIntervalMs:ENDPOINT_CADENCE.bulkFixtureDetailMs,purpose:'BACKGROUND_EMBEDDED_DETAIL'});
  const odds=(ids,tier,ms,priority)=>{for(const id of ids)calls.push({key:`odds:${id}`,path:'/odds/live',params:{fixture:id},priority,minIntervalMs:ms,purpose:`${tier}_LIVE_MARKET`,candidate:tier!=='BACKGROUND'})};
  odds(hot,'HOT',ENDPOINT_CADENCE.liveOddsHotMs,API_PRIORITY.HIGH);odds(active,'ACTIVE',ENDPOINT_CADENCE.liveOddsActiveMs,API_PRIORITY.HIGH);odds(background,'BACKGROUND',ENDPOINT_CADENCE.liveOddsBackgroundMs,API_PRIORITY.LOW);
  return calls.map(c=>({...c,due:!lastSeen[c.key]||now-Number(lastSeen[c.key])>=c.minIntervalMs}));
}
export function planSlowContext({fixture,candidateTier='ACTIVE',coverage={},known={}}={}){
  const id=Number(fixture?.fixture?.id??fixture?.id),home=Number(fixture?.teams?.home?.id??fixture?.home_id),away=Number(fixture?.teams?.away?.id??fixture?.away_id),
    league=Number(fixture?.league?.id??fixture?.league_id),season=Number(fixture?.league?.season??fixture?.season),
    pri=candidateTier==='HOT'?API_PRIORITY.MEDIUM:API_PRIORITY.LOW,calls=[];
  if(id&&coverage.injuries!==false)calls.push({key:`inj:${id}`,path:'/injuries',params:{fixture:id},ttl:ENDPOINT_CADENCE.injuriesMs,priority:pri,purpose:'AVAILABILITY'});
  if(league&&season&&coverage.standings!==false)calls.push({key:`stand:${league}:${season}`,path:'/standings',params:{league,season},ttl:ENDPOINT_CADENCE.standingsMs,priority:API_PRIORITY.LOW,purpose:'TABLE_CONTEXT'});
  for(const team of [home,away])if(team&&league&&season){
    calls.push({key:`teamstats:${league}:${season}:${team}`,path:'/teams/statistics',params:{league,season,team},ttl:ENDPOINT_CADENCE.teamStatsMs,priority:API_PRIORITY.LOW,purpose:'TEAM_BASELINE'});
    calls.push({key:`players:${season}:${team}:1`,path:'/players',params:{team,season,page:1},ttl:ENDPOINT_CADENCE.seasonPlayersMs,priority:pri,purpose:'PLAYER_SEASON_BASELINE',pagination:true});
  }
  if(id&&coverage.predictions!==false)calls.push({key:`pred:${id}`,path:'/predictions',params:{fixture:id},ttl:ENDPOINT_CADENCE.predictionsMs,priority:API_PRIORITY.LOW,purpose:'EXTERNAL_MODEL_CONTEXT'});
  if(id&&coverage.odds!==false)calls.push({key:`preodds:${id}`,path:'/odds',params:{fixture:id},ttl:ENDPOINT_CADENCE.prematchOddsMs,priority:API_PRIORITY.LOW,purpose:'PRE_MARKET_ANCHOR'});
  if(home&&away)calls.push({key:`h2h:${home}:${away}`,path:'/fixtures/headtohead',params:{h2h:`${home}-${away}`,last:7},ttl:ENDPOINT_CADENCE.h2hMs,priority:API_PRIORITY.BACKGROUND,purpose:'WEAK_H2H_CONTEXT'});
  for(const team of [home,away])if(team)calls.push({key:`recent:${team}`,path:'/fixtures',params:{team,last:8},ttl:ENDPOINT_CADENCE.recentMs,priority:API_PRIORITY.LOW,purpose:'RECENT_FORM_AND_REST'});
  return calls.filter(c=>!known[c.key]);
}
export function expandPlayerPagination(baseCall,paging,maxPages=4){
  if(!baseCall||baseCall.path!=='/players')return [];
  const total=Math.max(1,Math.min(Number(paging?.total||1),maxPages)),current=Math.max(1,Number(paging?.current||1)),out=[];
  for(let page=current+1;page<=total;page++)out.push({...baseCall,key:String(baseCall.key).replace(/:\d+$/,`:${page}`),params:{...baseCall.params,page},pagination:false});
  return out;
}
export function applyBudgetToPlan(calls,budget,now=Date.now()){
  return (calls||[]).map(c=>{const d=budget.decision({priority:c.priority,candidate:!!c.candidate,now});return {...c,budget:d}}).filter(c=>c.budget.allow&&c.due!==false);
}
