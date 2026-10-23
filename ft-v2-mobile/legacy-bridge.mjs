// Pure READ-ONLY bridge from the CURRENT Football Edge Mobile FT watch state.
// The active Mobile exposes FEUIReadBridge.read() -> watchState.items. These
// snapshots are not the hashed 3K Observation/Decision PAIR and do NOT carry
// independently reconcilable original bookmaker responses.
// Never price, rank, buy, scan, POST, persist, or mutate the shared bridge.
const safeInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const safeScore=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100?x:null;
const str=x=>typeof x==='string'?x.slice(0,120):'';
const empty=(now,reason)=>({
 schema:'FT_V2_MOBILE_READ_ONLY',mode:'LIVE',rows:[],reason,
 top_verified:false,prices_verified:false,generated_at:now,
 source:'EXISTING_FT_WATCH_BRIDGE',source_state:reason
});
function sotFrom(s){
 // There must be an explicit presence bit from the statistics data source.
 if(s?.stats_presence?.sot!==true)return null;
 const x=s?.metrics?.total?.sot;
 return safeInt(x);
}
function readSingle(item,now,maxAgeMs){
 const id=safeInt(item?.id);
 if(!id||!item||typeof item!=='object')return null;
 const ui=item.ui,uiSnapshot=ui?.snapshot;
 // A UI snapshot and its corresponding fixture must never be paired across
 // fixture IDs. If identity is inconsistent, quarantine rather than guess.
 if(uiSnapshot&&ui?.fixture?.fixture?.id!==id)return null;
 const snap=uiSnapshot||item.latest;
 if(!snap)return null;
 const at=safeInt(snap.captured_at),minute=safeInt(snap.minute);
 const home=safeInt(snap.goals?.home),away=safeInt(snap.goals?.away);
 if(!at||at>now+5000||now-at>maxAgeMs||minute===null||minute<46||minute>90||
 snap.status!=='2H'||home===null||away===null)return null;
 const fresh=now-at<=60000;
 const f=ui?.fixture,league=typeof item.league==='string'?item.league:f?.league?.name,
 country=f?.league?.country;
 const history=(Array.isArray(item.history)?item.history:[]).slice(-60)
  .filter(h=>{
   const t=safeInt(h?.captured_at),m=safeInt(h?.minute);
   return t&&t<=at&&t<=now+5000&&m!==null&&m<=minute;
  }).map(h=>({
   minute:h.minute,at:h.captured_at,score:null,received_at:null,
   status:'OBSERVED_STATS_ONLY',sot_total:sotFrom(h)
  })).sort((a,b)=>a.at-b.at).slice(-40);
 const quote=null; // no independent raw-bookmaker parity available here
 const ftSignal=ui?.engines?.FT||item.eval||{};
 return {
  id,league:str(league)||'Giải đấu chưa xác định',
  country:str(country),
  home:str(f?.teams?.home?.name||item.home)||'Đội nhà',
  away:str(f?.teams?.away?.name||item.away)||'Đội khách',
  home_goals:home,away_goals:away,minute,state:'2H',
  freshness:fresh?'CURRENT':'STALE',
  decision_at:at,quote,
  latest_ft_signal_score:safeScore(ftSignal.score),
  latest_ft_signal_mode:str(ftSignal.scoreMode),
  latest_sot_total:sotFrom(snap),
  model:{status:'AWAITING_VALIDATED_TOTAL_GOALS_PMF',fair_over:null,fair_under:null,
   ev_over:null,ev_under:null,pmf:null,calibrated:false},
  recommendation:{state:'WAIT_MODEL',side:null,line:null,odds:null,ev:null,rank:null},
  integrity:{status:'LEGACY_FT_SNAPSHOT_UNPRICED',
   reason:'RAW_BOOKMAKER_PROVENANCE_NOT_AVAILABLE_IN_MOBILE_WATCH',
   market_reasons:['NO_HASH_VERIFIED_FT_ODDS_PAIR']},
  history
 };
}
export function readExistingFTWatch(bridge,now=Date.now(),{maxAgeMs=600000}={}){
 if(!Number.isSafeInteger(now)||now<=0||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<60000)
  throw Error('INVALID_FT_BRIDGE_CLOCK_OR_AGE');
 if(!bridge||typeof bridge.read!=='function')return empty(now,'FT_BRIDGE_NOT_CONNECTED');
 let state;
 try{state=bridge.read();}catch{return empty(now,'FT_BRIDGE_READ_FAILED');}
 if(!state||!Array.isArray(state.watchState?.items))return empty(now,'FT_WATCH_ITEMS_UNAVAILABLE');
 const rows=[],seen=new Set();
 for(const item of state.watchState.items.slice(0,150)){
  const x=readSingle(item,now,maxAgeMs);
  if(x&&!seen.has(x.id)){seen.add(x.id);rows.push(x);}
 }
 rows.sort((a,b)=>(a.freshness==='CURRENT'?-1:1)-(b.freshness==='CURRENT'?-1:1)||
   b.decision_at-a.decision_at||a.id-b.id);
 return {schema:'FT_V2_MOBILE_READ_ONLY',mode:'LIVE',rows,
  reason:rows.length?'LEGACY_FT_WATCH_REVIEW_ONLY':'NO_FRESH_SECOND_HALF_SNAPSHOT',
  top_verified:false,prices_verified:false,generated_at:now,
  source:'EXISTING_FT_WATCH_BRIDGE',source_state:'READ_ONLY_NO_RAW_BOOKMAKER_EVIDENCE'};
}
