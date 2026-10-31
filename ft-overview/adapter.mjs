import {number,researchBaseline} from './core.mjs';
import {ftStateModel} from './live-probability.mjs';
const time = x => { const n=number(x); if(n!==null)return n<1e12?n*1000:n;const t=Date.parse(x);return Number.isFinite(t)?t:null; };
export function marketFromRows(rows, s) {
  for (const r of rows || []) {
    if (r.category !== 'over_under' || r.integrity?.valid === false || r.status?.blocked || r.status?.stopped || r.status?.finished || r.feed_status?.blocked || r.feed_status?.stopped || r.feed_status?.finished) continue;
    const groups=new Map();
    for(const v of r.values || []) {
      if(v.suspended)continue;
      const label=String(v.value || ''),side=/^over\b|^tài\b|^tai\b/i.test(label)?'over':/^under\b|^xỉu\b|^xiu\b/i.test(label)?'under':null;
      const line=number(v.handicap) ?? number(label.match(/(\d+(?:\.\d+)?)\s*$/)?.[1]),odd=number(v.odd);
      if(!side||line===null||line<0||odd===null||odd<=1)continue;
      const g=groups.get(line)||{line};g[side]=odd;groups.set(line,g);
    }
    const updated=r.update==null?null:time(r.update);
    if(r.update!=null&&(updated===null||updated>s.at+5000))continue;
    const candidates=[...groups.values()].sort((a,b)=>Number(b.line===number(r.main_line))-Number(a.line===number(r.main_line)));
    for(const g of candidates) if(g.over>1&&g.under>1&&Number.isInteger(s.goals?.home)&&Number.isInteger(s.goals?.away)&&g.line>s.goals.home+s.goals.away) return {...g,period:'FT',basis:'FULL_MATCH',bookmaker:r.bookmaker?.name || (typeof r.bookmaker==='string'?r.bookmaker:null) || 'API_FOOTBALL_LIVE_FEED',at:updated??s.at,score:{...s.goals},timestampBasis:updated===null?'SNAPSHOT_RECEIPT':'PROVIDER_UPDATE',settlementAssumption:'STANDARD_FULL_MATCH_TOTAL_90_MIN'};
  }
  return null;
}
function metricSnapshot(it) {
  const s=it.latest || {},p=s.stats_presence || {},values=s.metrics?.total || {};
  return {at:number(s.captured_at),goals:{home:number(s.goals?.home),away:number(s.goals?.away)},metrics:Object.fromEntries(['shots','sot','inbox','xg'].map(k=>[k,p[k]===true?number(values[k]):null]))};
}
export function readLegacy(bridge, bundleBridge,{conditionedFT=false}={}) {
  if(!bridge?.read)return [];
  const d=bridge.read(),map=new Map(),bundles=bundleBridge?.read?.() || [];
  const bundleById=new Map(bundles.map(b=>[Number(b.meta?.fixture_id),b]));
  for(const [engine,items] of [['H1',d.h1WatchState?.items],['FT',d.watchState?.items],['HC',d.handicapWatchState?.pool]])for(const it of items || []){
    const id=number(it.id),s=it.latest || {},at=number(s.captured_at);if(!id||!at)continue;
    const old=map.get(id);if(old&&old.at>at)continue;
    // The store's local revision domain is observation time. Server revisions
    // and browser millisecond timestamps cannot be ordered against each other.
    const source=metricSnapshot(it),snapshot={id,revision:at,at,minute:number(s.minute),status:s.status,goals:source.goals,home:it.home || '',away:it.away || '',league:it.league || '',metrics:source.metrics,
      history:(it.history||[]).map(r=>metricSnapshot({latest:r})),statsError:(!!it.eval?.dataIncomplete&&it.eval?.scoreMode!=='BASELINE') || s.data_health?.level==='NO_STATS',
      cooldownUntil:number(it.cooldownUntil),legacy:{engine,score:number(it.eval?.score),state:it.state,independent:false},model:null,market:null};
    // HC metrics have no total. Retain separately observed goal-engine metrics
    // only when their observation timestamp is identical.
    if(engine==='HC'&&old?.at===at){snapshot.metrics=old.metrics;snapshot.history=old.history;snapshot.statsError=old.statsError;snapshot.legacy=old.legacy;}
    if(conditionedFT&&s.stats_presence?.red===true)snapshot.metrics.red=number(s.metrics?.total?.red);
    const rows=s.market_rows || it.serverRow?.snapshot?.market_rows || [];
    snapshot.market=marketFromRows(rows,snapshot) || (old?.at===at ? old.market:null);
    const shared=it.serverRow?.notification_context;
    const b=shared?.fixtureId===id&&shared.observedAt===at&&shared.ftBundle?.meta?.fixture_id===id?shared.ftBundle:bundleById.get(id),n=b?.normalized || {},meta=b?.meta;
    if(meta){snapshot.contextAt=number(b.observed_at);const input={homeId:meta.teams?.home?.id,awayId:meta.teams?.away?.id,homeRecent:n.home_recent,awayRecent:n.away_recent,kickoff:time(meta.fixture?.timestamp || meta.fixture?.date),at,minute:snapshot.minute,status:snapshot.status};
     if(conditionedFT){const result=ftStateModel({...input,fixtureId:id,goals:snapshot.goals});snapshot.model=result.model||{waitReason:result.reason};}
     else snapshot.model=researchBaseline(input);
    }
    map.set(id,snapshot);
  }
  // PRE selection can be evaluated from a previously fetched DEEP bundle.
  for(const b of bundles){
    const meta=b.meta,n=b.normalized || {},id=Number(meta?.fixture_id),f=meta?.fixture;
    if(!id||map.has(id)||f?.status?.short!=='NS')continue;
    const at=number(b.observed_at);if(at===null)continue;
    const s={id,revision:at,at,minute:0,status:'NS',goals:{home:0,away:0},home:meta.teams?.home?.name || '',away:meta.teams?.away?.name || '',metrics:{},history:[],statsError:false};
    const input={homeId:meta.teams?.home?.id,awayId:meta.teams?.away?.id,homeRecent:n.home_recent,awayRecent:n.away_recent,kickoff:time(f.timestamp || f.date),at,minute:0,status:'NS'};
    if(conditionedFT){const result=ftStateModel({...input,fixtureId:id,goals:s.goals});s.model=result.model||{waitReason:result.reason};}else s.model=researchBaseline(input);
    s.market=marketFromRows(n.market?.prematch,s);map.set(id,s);
  }
  return [...map.values()];
}

