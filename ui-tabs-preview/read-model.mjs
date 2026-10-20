// Pure display adapter. Does not run an engine, sort by score, fetch or persist.
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const txt=v=>typeof v==='string'?v.slice(0,240):'';
const id=v=>Number.isSafeInteger(v)&&v>0?v:null;
const ended=s=>['FT','AET','PEN','CANC','ABD','AWD','WO'].includes(s);
const copy=x=>structuredClone(x);
export function freshness(at,status,now){return at===null||at<=0?'UNKNOWN':at>now+5000?'INVALID_TIME':ended(status)?'ENDED':now-at>(status==='NS'?900000:60000)?'STALE':'CURRENT';}
function observation(raw={},names={}){
 const at=num(raw.captured_at),g=raw.goals||{};
 return {at,status:txt(raw.status),minute:num(raw.minute),goals:{home:num(g.home),away:num(g.away)},home:txt(names.home),away:txt(names.away),league:txt(names.league),metrics:Object.fromEntries(['shots','sot','inbox','xg'].map(k=>[k,raw.stats_presence?.[k]===true?num(raw.metrics?.total?.[k]):null]))};
}
function legacySignal(it,key,now){
 const obs=observation(it.latest,it),e=it.eval||{},history=(it.history||[]).slice(-80).map(h=>({at:num(h.captured_at),value:h.stats_presence?.sot===true?num(h.metrics?.total?.sot):null,score:null}));
 return {engine:key,observation:obs,state:txt(key==='hc'?e.state:it.state),score:key==='hc'?null:num(e.score),gap:key==='hc'?num(e.states?.liveGap):null,reason:txt(it.reason||e.reason),recommendation:txt(e.recommendation),freshness:freshness(obs.at,obs.status,now),history,historyUnit:'SOT',source:'LEGACY_READ_BRIDGE',rank:null};
}
function basePacket(mode,now){return {schema:'FE_TABS_DISPLAY_V1',mode,read_at:now,fixtures:[],top:[],lists:{ht:[],ft:[],hc:[],valuation:[]},warnings:[],sourceError:null};}
function addFixture(map,fixtureId,signal){
 const x=map.get(fixtureId)||{id:fixtureId,signals:{},observation:null,masterRank:null,masterReason:'',masterPrimary:null};
 x.signals[signal.engine]=signal;
 if(!x.observation||(signal.observation.at!==null&&(x.observation.at===null||signal.observation.at>x.observation.at)))x.observation=signal.observation;
 map.set(fixtureId,x);return x;
}
export function fromBridges({legacy,master,overviewRows}={},now=Date.now()){
 const p=basePacket('BRIDGE',now),map=new Map();let input,masters;
 try{input=legacy?.read?.()||{};masters=master?.masterRows?.()||[];}catch{p.sourceError='BRIDGE_READ_FAILED';return p;}
 for(const [key,items]of [['ht',input.h1WatchState?.items],['ft',input.watchState?.items],['hc',input.handicapWatchState?.pool]]){
  for(const it of (Array.isArray(items)?items:[]).slice(0,100)){const n=id(it.id);if(!n||p.lists[key].includes(n))continue;addFixture(map,n,legacySignal(it,key,now));p.lists[key].push(n);}
 }
 const seen=new Set(),ranks=new Set();
 for(const r of (Array.isArray(masters)?masters:[]).slice(0,100)){
  const n=id(r.id);if(!n||seen.has(n))continue;seen.add(n);
  for(const [key,property]of [['ht','h1'],['ft','ft'],['hc','hc']])if(r[property]){
   if(id(r[property].id)!==n){p.warnings.push('MASTER_FIXTURE_MISMATCH');continue;}
   if(!map.get(n)?.signals[key])addFixture(map,n,legacySignal(r[property],key,now));
  }
  const x=map.get(n),rank=r.__rank?.top;
  if(!x||!Number.isInteger(rank)||rank<1||rank>5)continue;
  if(ranks.has(rank)){p.warnings.push('DUPLICATE_SOURCE_RANK');continue;}ranks.add(rank);
  x.masterRank=rank;x.masterReason=txt(r.__addon?.rankWhy);x.masterPrimary=({H1:'ht',FT:'ft',HC:'hc'})[r.__rank?.primary?.engine]||null;
  p.top.push({id:n,rank,source:'MASTER_EXISTING_TOP'});
 }
 // Sort only by an explicitly assigned existing rank; never synthesize a score.
 p.top.sort((a,b)=>a.rank-b.rank);
 let assessed=[];try{assessed=overviewRows?.()||[];}catch{p.warnings.push('OVERVIEW_ASSESSED_READ_FAILED');}
 const overviewSeen=new Set(),overviewRanks=new Set();
 for(const r of (Array.isArray(assessed)?assessed:[]).slice(0,100)){
  const s=r.snapshot||{},n=id(r.id);if(!n||id(s.id)!==n||overviewSeen.has(n))continue;overviewSeen.add(n);
  const obs={at:num(s.at),status:txt(s.status),minute:num(s.minute),goals:{home:num(s.goals?.home),away:num(s.goals?.away)},home:txt(s.home),away:txt(s.away),league:txt(s.league),metrics:Object.fromEntries(['shots','sot','inbox','xg'].map(k=>[k,num(s.metrics?.[k])]))};
  const q=r.quote,m=s.market,rank=r.rank,sourceRank=Number.isInteger(rank)&&rank>0?rank:null;
  const signal={engine:'valuation',observation:obs,state:txt(r.entry),score:null,gap:null,reason:txt(r.reason),recommendation:txt(r.recommendation?.action),freshness:freshness(obs.at,obs.status,now),history:[],rank:sourceRank,source:'EXISTING_ASSESSED_OVERVIEW',blocked:!!r.blocked,marketFresh:!!r.marketFresh,modelOK:!!r.modelOK,line:num(m?.line),odds:num(m?.over),fairOdds:num(q?.fairOdds),ev:num(q?.ev),marketAt:num(m?.at),marketScore:{home:num(m?.score?.home),away:num(m?.score?.away)},marketPeriod:txt(m?.period),marketBasis:txt(m?.basis)};
  addFixture(map,n,signal);
  if(sourceRank!==null&&!overviewRanks.has(sourceRank)){overviewRanks.add(sourceRank);p.lists.valuation.push(n);}
 }
 p.lists.valuation.sort((a,b)=>map.get(a).signals.valuation.rank-map.get(b).signals.valuation.rank);
 if(!overviewRows)p.warnings.push('OVERVIEW_ASSESSED_VIEW_NOT_CONNECTED');
 p.fixtures=[...map.values()];return copy(p);
}
export function fromArchiveAudit(audit,now=Date.now()){
 const p=basePacket('ARCHIVE',now);p.archive_captured_at=num(audit?.captured_at);const seen=new Set();
 for(const r of (Array.isArray(audit?.matches)?audit.matches:[]).slice(0,100)){
  const n=id(r.fixture_id);if(!n||seen.has(n))continue;seen.add(n);
  const obs={at:num(r.source_at),status:txt(r.status),minute:num(r.minute),goals:{home:num(r.goals?.home),away:num(r.goals?.away)},home:txt(r.home),away:txt(r.away),league:'',metrics:Object.fromEntries(['shots','sot','inbox','xg'].map(k=>[k,num(r.metrics?.[k])]))};
  p.fixtures.push({id:n,observation:obs,masterRank:null,masterReason:'',masterPrimary:null,signals:{valuation:{engine:'valuation',observation:obs,state:txt(r.entry_now),reason:txt(r.reason),recommendation:'NO_LIVE_RECOMMENDATION',freshness:freshness(obs.at,obs.status,now),source:'STORED_AUDIT_20261019',sourceHealth:txt(r.source_health?.stats),score:null,gap:null,rank:null,history:[],line:num(r.market?.line),odds:num(r.market?.over),marketAt:num(r.market?.at)}}});
 }
 p.warnings.push('ARCHIVE_HAS_NO_LEGACY_ENGINE_RANKS','NO_LIVE_RECOMMENDATION');return copy(p);
}
export function displayAction(signal,now,mode){
 if(mode==='ARCHIVE')return 'ARCHIVE · Không phát khuyến nghị';
 const f=freshness(signal.observation.at,signal.observation.status,now);
 if(f!=='CURRENT')return f==='ENDED'?'Trận đã kết thúc':f==='STALE'?'Dữ liệu cũ · Chờ cập nhật':'Thiếu thời gian nguồn hợp lệ';
 if(signal.engine!=='valuation')return signal.state||'Chờ kết luận nguồn';
 if(signal.blocked||!signal.marketFresh||!signal.modelOK)return signal.state||'Chờ dữ liệu';
 const g=signal.observation.goals,score=signal.marketScore;
 if(g.home===null||g.away===null||g.home!==score?.home||g.away!==score?.away||signal.marketPeriod!=='FT'||signal.marketBasis!=='FULL_MATCH'||signal.line===null||signal.line<=g.home+g.away||signal.odds===null||signal.odds<=1||signal.marketAt===null||signal.marketAt>now+5000||now-signal.marketAt>60000)return 'Chờ line / giá khớp dữ liệu';
 return signal.recommendation==='TRIAL_OVER'?`Cân nhắc Tài FT ${signal.line} @ ${signal.odds.toFixed(2)} · Thử nghiệm`:signal.state||'Chờ kết luận nguồn';
}
