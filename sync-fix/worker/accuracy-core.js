// Measurement only. Never imported by the forecasting/scoring engine.
export const VERSION='FE_ACCURACY_V1_20261010';
export const number=v=>v!==null&&v!==undefined&&v!==''&&typeof v!=='boolean'&&Number.isFinite(Number(v))?Number(v):null;
const cancelled=new Set(['CANC','ABD','AWD','WO','PST']);
const halfDone=new Set(['HT','2H','ET','BT','P','FT','AET','PEN']);
const fullDone=new Set(['FT','AET','PEN']);
export function gapCheck(v,last,now=Date.now()){
  const start=number(v.gap_signed),end=number(last?.gap),at=number(last?.at),age=at===null?Infinity:now-at;
  if(start===null||end===null||age<0||age>150000||last?.reason==='STATS_UNAVAILABLE'||['EMPTY','ERROR','INVALID'].includes(last?.sourceHealth?.stats))return {pending:true,reason:'HC_STATE_NOT_FRESH_OR_MISSING'};
  return {result:Math.abs(end)<20?'NEUTRALIZED':Math.sign(start)!==Math.sign(end)?'FLIPPED':Math.abs(end)>=(number(v.threshold)??70)?'SAME_ABOVE_THRESHOLD':'SAME_BELOW_THRESHOLD',gap_end:end,gap_start:start,gap_delta:end-start,state_age_ms:age,measurement_version:VERSION,bet_result:false};
}
export function goalPeriod(v,f,events){
  const st=f?.fixture?.status?.short;
  if(cancelled.has(st))return {result:'VOID',reason:'FIXTURE_'+st};
  if(!f)return {pending:true,reason:'FIXTURE_UNAVAILABLE'};
  if(!(v.engine==='H1'?halfDone:fullDone).has(st))return {pending:true,reason:'PERIOD_NOT_FINISHED'};
  const end=v.engine==='H1'?45:90,sc=v.engine==='H1'?f.score?.halftime:f.score?.fulltime;
  const nums=[v.minute,v.score_home,v.score_away,sc?.home,sc?.away,f.goals?.home,f.goals?.away].map(number);
  if(nums.some(x=>x===null)||!Array.isArray(events))return {pending:true,reason:'BASELINE_OR_FINAL_EVIDENCE_MISSING'};
  const [minute,sh,sa,ph,pa,fh,fa]=nums;
  if(minute<0||minute>end||sh<0||sa<0||ph<sh||pa<sa)return {pending:true,reason:'INVALID_OR_CORRECTED_BASELINE'};
  const goals=events.filter(e=>String(e.type).toLowerCase()==='goal'&&!/miss|cancel|disallow|shootout/i.test(String(e.detail||'')));
  if(goals.some(e=>number(e.time?.elapsed)===null)||goals.length!==fh+fa||goals.filter(e=>Number(e.time.elapsed)<=end).length!==ph+pa)return {pending:true,reason:'FINAL_LEDGER_MISMATCH'};
  // Recorded score fixes the baseline, including goals in the same minute.
  const periodGoals=goals.filter(e=>Number(e.time.elapsed)<=end).sort((a,b)=>Number(a.time.elapsed)-Number(b.time.elapsed)||(number(a.time.extra)??0)-(number(b.time.extra)??0));
  if(periodGoals.slice(0,sh+sa).some(e=>Number(e.time.elapsed)>minute)||periodGoals.slice(sh+sa).some(e=>Number(e.time.elapsed)<minute))return {pending:true,reason:'BASELINE_LEDGER_AMBIGUITY'};
  return {result:ph+pa>sh+sa?'HIT':'MISS',final_score_home:ph,final_score_away:pa,fixture_status:st,source_quality:'OFFICIAL_PERIOD_SCORE_AND_EVENT_LEDGER',target:v.engine==='H1'?'GOAL_BEFORE_HT':'GOAL_BEFORE_FT',measurement_version:VERSION,bet_result:false};
}
export function settlePaper(r,f){
  const st=f?.fixture?.status?.short;
  if(cancelled.has(st))return {result:'VOID',reason:'FIXTURE_'+st,unit_pl:null};
  if(!['H1','FT'].includes(r.engine)||r.market_type!==(r.engine==='H1'?'OU_H1':'OU_FT')||!r.auto_settle_supported)return {unsupported:true,reason:'UNSUPPORTED_MARKET'};
  if(!(r.engine==='H1'?halfDone:fullDone).has(st))return {pending:true,reason:'PERIOD_NOT_FINISHED'};
  const sc=r.engine==='H1'?f?.score?.halftime:f?.score?.fulltime,line=number(r.line),price=number(r.price),sel=String(r.selection||'').toUpperCase();
  if(line===null||line<0||Math.abs(line*4-Math.round(line*4))>1e-8||price===null||price<=1||r.odds_format!=='DEC'||!['OVER','UNDER'].includes(sel)||number(sc?.home)===null||number(sc?.away)===null)return {unsupported:true,reason:'INVALID_MARKET_CONTRACT'};
  const total=Number(sc.home)+Number(sc.away),legs=Math.round(line*4)%2?[Math.floor(line*2)/2,Math.ceil(line*2)/2]:[line];
  const results=legs.map(l=>Math.sign(sel==='OVER'?total-l:l-total));
  const unit_pl=results.reduce((a,x)=>a+(x>0?price-1:x<0?-1:0),0)/results.length;
  const s=results.reduce((a,x)=>a+x,0)/results.length,result=s===1?'WIN':s===.5?'HALF_WIN':s===0?'PUSH':s===-.5?'HALF_LOSE':'LOSE';
  return {result,unit_pl,final_score_home:Number(sc.home),final_score_away:Number(sc.away),source_quality:'OFFICIAL_PERIOD_SCORE',settlement_basis:r.engine==='H1'?'H1_SEGMENT':'FULL_MATCH',sample_type:'ENTRY_POLICY_PAPER',execution_verified:false,measurement_version:VERSION};
}
