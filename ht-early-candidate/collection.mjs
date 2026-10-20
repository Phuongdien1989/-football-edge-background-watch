// HT collection policy only. No probability model, network, persistence or timers.
export function createHTCollection() {
  const valid=v=>typeof v==='number'&&Number.isFinite(v);
  const minute=f=>f?.fixture?.status?.elapsed;
  const eligible=f=>Number.isSafeInteger(f?.fixture?.id)&&f.fixture.id>0&&['1H','LIVE'].includes(f.fixture.status?.short)&&valid(minute(f))&&minute(f)>=0&&minute(f)<=45;
  const isEarly=s=>['1H','LIVE'].includes(s?.status)&&valid(s?.minute)&&s.minute>=0&&s.minute<20;
  function activity(s,previous=null) {
    const t=s?.metrics?.total||{},p=s?.stats_presence||{};
    const prior=previous?.metrics?.total||{},pp=previous?.stats_presence||{};
    const observed=k=>p[k]===true&&valid(t[k]);
    const amount=k=>!observed(k)?null:previous?(pp[k]===true&&valid(prior[k])?Math.max(0,t[k]-prior[k]):null):t[k];
    // Existing recent-chance thresholds, used only to allocate data collection.
    return (amount('sot')??0)>=1||(amount('inbox')??0)>=2||(amount('xg')??0)>=.12||(amount('shots')??0)>=3;
  }
  function plan(fixtures,pool,{enabled=false,now=Date.now(),slots=5}={}) {
    if(enabled!==true)return [];
    const unique=new Map((fixtures||[]).filter(eligible).map(f=>[f.fixture.id,f]));
    const rows=[...unique.values()].map(f=>({f,item:pool.get(f.fixture.id)}));
    const age=r=>valid(r.item?.lastProbeAt)?r.item.lastProbeAt:0;
    const active=r=>{
      const s=r.item?.latest;
      return valid(s?.fresh_at)&&now>=s.fresh_at&&now-s.fresh_at<=55000&&r.item?.collectionActive===true;
    };
    rows.sort((a,b)=>age(a)-age(b)||a.f.fixture.id-b.f.fixture.id);
    const limit=Math.max(0,Math.min(5,Math.floor(slots)||0));
    if(!limit)return [];
    // Reserve one oldest-first slot so quiet/unseen fixtures are revisited.
    const scout=rows.shift();
    rows.sort((a,b)=>Number(active(b))-Number(active(a))||age(a)-age(b)||a.f.fixture.id-b.f.fixture.id);
    return [...(scout?[scout]:[]),...rows.slice(0,limit-1)].map(r=>r.f);
  }
  function appendHistory(history,s,now=Date.now()) {
    if(!valid(s?.fresh_at)||s.fresh_at>now||now-s.fresh_at>55000)return {accepted:false,history};
    // Source observation identity is the stats response time, never render time.
    if((history||[]).some(x=>(x.source_stats_at??x.fresh_at??x.captured_at)===s.fresh_at))return {accepted:false,history};
    const observation={...s,captured_at:s.fresh_at,source_stats_at:s.fresh_at};
    // History needs measured counters, not another copy of fixture/market payloads.
    const point=Object.fromEntries(['captured_at','fresh_at','source_stats_at','minute','status','goals','metrics','stats_presence','dq','integrity'].map(k=>[k,observation[k]]));
    const rows=[...(history||[]),point].filter(x=>valid(x.captured_at)&&x.captured_at>=now-28*60000&&x.captured_at<=now).sort((a,b)=>a.captured_at-b.captured_at).slice(-90);
    return {accepted:true,history:rows,observation};
  }
  function earlyEvaluation(item,s,temporal) {
    return {h1_temporal:true,collection_phase:'EARLY_OBSERVATION',recommendation:'WAIT',score:null,rawScore:null,partialRaw:null,scoreMode:'EARLY_EVIDENCE',dataIncomplete:true,partialData:true,
      game:null,pressure:null,chance:null,momentum:null,market:null,context:null,quality:temporal.qualityScore(item,s),mature:false,delta:null,window_min:0,accel:null,accelValid:false,accelKind:'NOT_PRICED',
      recent3:temporal.displayWindow(item,s,3),recent5:temporal.displayWindow(item,s,5),recent10:temporal.displayWindow(item,s,10),pressure5:temporal.windowFor(item,s,5),pressure10:temporal.windowFor(item,s,10),baselineAge:temporal.historyAge(item,s),
      core:{available:false,complete:false,availableCount:0,strongCount:null,weakCount:null,pass:false,partialPass:false},stats_presence:s.stats_presence||null,market_available:!!s.market?.valid_count,over_available:!!s.market?.has_over,best_over:s.market?.best_over||null,
      hardVeto:false,vetoReasons:[],dataWarnings:['HT_EARLY_VALUATION_PENDING']};
  }
  return {eligible,isEarly,activity,plan,appendHistory,earlyEvaluation};
}
