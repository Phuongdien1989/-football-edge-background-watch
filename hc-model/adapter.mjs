// Detached, read-only model input from the same existing app bridges as FT V2.
import {modelHC,differenceSummary} from './core.mjs';
const number=x=>x===null||x===undefined||typeof x==='boolean'||x===''?null:Number.isFinite(Number(x))?Number(x):null;
function time(x){const num=number(x);if(num!==null)return num<1e12?num*1000:num;const t=Date.parse(x);return Number.isFinite(t)?t:null;}
export function readHCResearch(legacyBridge,bundleBridge){
 const state=legacyBridge?.read?.()||{},bundles=bundleBridge?.read?.()||[],byId=new Map(bundles.map(x=>[Number(x.meta?.fixture_id),x])),rows=[];
 for(const item of state.handicapWatchState?.pool||[]){const id=number(item.id),s=item.latest||{},b=byId.get(id),meta=b?.meta,n=b?.normalized||{},at=number(s.captured_at);
  const input={fixtureId:id,homeId:meta?.teams?.home?.id,awayId:meta?.teams?.away?.id,homeRecent:n.home_recent,awayRecent:n.away_recent,kickoff:time(meta?.fixture?.timestamp||meta?.fixture?.date),at,minute:number(s.minute),status:s.status,goals:{home:number(s.goals?.home),away:number(s.goals?.away)}};
  const result=b?modelHC(input):{ok:false,reason:'MISSING_DEEP_CONTEXT',model:null};rows.push({id,home:item.home,away:item.away,league:item.league,at,...result,summary:result.ok?differenceSummary(result.model):null,legacy:{gap:number(item.eval?.states?.liveGap),modelInput:false}});
 }return rows;
}
