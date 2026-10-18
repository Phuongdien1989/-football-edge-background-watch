// Independent paper measurement. No engine calls, provider requests or production writes.
export const VERSION='CENTRAL_ENTRY_PAPER_V1';
export const SCHEMA_SQL=`CREATE TABLE IF NOT EXISTS fe_entry_measurements (
 measurement_id TEXT PRIMARY KEY,
 sample_key TEXT NOT NULL,
 algorithm_version TEXT NOT NULL,
 anchor_entry_id TEXT NOT NULL,
 fixture_id INTEGER NOT NULL,
 engine TEXT NOT NULL,
 observed_at INTEGER NOT NULL,
 measurement_status TEXT NOT NULL,
 payload_json TEXT NOT NULL
)`;
export const INSERT_SQL=`INSERT INTO fe_entry_measurements(measurement_id,sample_key,algorithm_version,anchor_entry_id,fixture_id,engine,observed_at,measurement_status,payload_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(measurement_id) DO NOTHING`;
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const integer=x=>numeric(x)&&Number.isSafeInteger(x);
const score=x=>integer(x)&&x>=0;
const validId=x=>integer(x)&&x>0;
const round=x=>Math.round(x*1e9)/1e9;
export function settlePeriodOU(total,line,selection,price){
 if(!score(total)||!numeric(line)||line<0||Math.abs(line*4-Math.round(line*4))>1e-8||!numeric(price)||price<=1||!['OVER','UNDER'].includes(selection))throw Error('UNSUPPORTED_OU_INPUT');
 const legs=Number.isInteger(line*2)?[line]:[Math.floor(line*2)/2,Math.ceil(line*2)/2];
 const values=legs.map(l=>selection==='OVER'?total-l:l-total);
 const pl=round(values.reduce((a,d)=>a+(d>0?price-1:d<0?-1:0),0)/values.length);
 const outcome=values.every(x=>x>0)?'WIN':values.every(x=>x<0)?'LOSE':values.every(x=>x===0)?'PUSH':pl>0?'HALF_WIN':'HALF_LOSE';
 return {outcome,unit_pl:pl};
}
export function firstEntries(entries){
 const sorted=entries.filter(e=>['H1','FT'].includes(e.engine)&&validId(e.fixture_id)&&typeof e.id==='string'&&e.id.length).slice().sort((a,b)=>{
  const aa=numeric(a.captured_at)?a.captured_at:-Infinity,bb=numeric(b.captured_at)?b.captured_at:-Infinity;
  return aa-bb||(a.id<b.id?-1:a.id>b.id?1:0);
 });
 const map=new Map();for(const e of sorted){const k=e.engine+':'+e.fixture_id;if(!map.has(k))map.set(k,e)}return [...map.values()];
}
function base(e){return {algorithm_version:VERSION,sample_key:e.engine+':'+e.fixture_id,anchor_entry_id:e.id,fixture_id:e.fixture_id,engine:e.engine,captured_at:e.captured_at,minute:e.minute??null,entry_score:{home:e.score_home,away:e.score_away},policy_status:e.policy_status??null,market_type:e.market_type,selection:e.selection,line:e.line,price:e.price,odds_format:e.odds_format,measurement_status:'UNKNOWN',reason:null,bookmaker_result_verified:false,settlement_basis:'WHOLE_PERIOD_ASSUMED_NOT_TICKET_VERIFIED',timestamp_basis:'CLIENT_CAPTURED_NOT_INDEPENDENTLY_VERIFIED',outcome:null,unit_pl:null,final_score:null,evidence:null}}
export function measureEntry(e,snapshots){
 const m=base(e),unknown=reason=>({...m,reason});
 if(!['H1','FT'].includes(e.engine)||!validId(e.fixture_id)||!numeric(e.captured_at)||e.captured_at<=0)return unknown('INVALID_ENTRY_ID_TIME_OR_ENGINE');
 if(e.odds_format!=='DEC'||e.market_type!==(e.engine==='H1'?'OU_H1':'OU_FT')||!['OVER','UNDER'].includes(e.selection)||!numeric(e.price)||e.price<=1||!numeric(e.line)||e.line<0||Math.abs(e.line*4-Math.round(e.line*4))>1e-8)return unknown('UNSUPPORTED_MARKET_OR_PRICE');
 if(!score(e.score_home)||!score(e.score_away))return unknown('MISSING_ENTRY_SCORE');
 const isFT=e.engine==='FT',h=isFT?'fulltime_home':'halftime_home',a=isFT?'fulltime_away':'halftime_away';
 const candidates=[];
 for(const s of snapshots){
  if(s.fixture_id!==e.fixture_id||s.raw_fixture_id!==e.fixture_id||s.raw_status!==s.status||!['BACKGROUND','EVIDENCE_FOLLOWUP','PROVIDER_FINAL_REFRESH'].includes(s.source)||typeof s.id!=='string')continue;
  if(!numeric(s.captured_at)||s.captured_at<e.captured_at)continue;
  if(isFT?s.status!=='FT':!['HT','2H','FT'].includes(s.status))continue;
  if(!score(s[h])||!score(s[a]))continue;
  // Reject snapshots whose period score contradicts the same raw fixture response.
  if(s.status==='FT'&&isFT&&(!score(s.raw_goals_home)||!score(s.raw_goals_away)||s[h]!==s.raw_goals_home||s[a]!==s.raw_goals_away))continue;
  if(s.status==='HT'&&!isFT&&(!score(s.raw_goals_home)||!score(s.raw_goals_away)||s[h]!==s.raw_goals_home||s[a]!==s.raw_goals_away))continue;
  if(!isFT&&score(s.raw_goals_home)&&score(s.raw_goals_away)&&(s[h]>s.raw_goals_home||s[a]>s.raw_goals_away))continue;
  candidates.push(s);
 }
 if(!candidates.length)return unknown('NO_CONFIRMED_RAW_PERIOD_SCORE');
 const pairs=new Set(candidates.map(s=>s[h]+':'+s[a]));
 if(pairs.size!==1)return unknown('CONFLICTING_RAW_PERIOD_SCORES');
 candidates.sort((x,y)=>x.captured_at-y.captured_at||(x.id<y.id?-1:x.id>y.id?1:0));
 const s=candidates[0],total=s[h]+s[a];
 if(total<e.score_home+e.score_away)return unknown('FINAL_BELOW_ENTRY_TOTAL_REVIEW_CORRECTION');
 const result=settlePeriodOU(total,e.line,e.selection,e.price);
 return {...m,measurement_status:'PAPER_RESOLVED',reason:null,...result,final_score:{home:s[h],away:s[a]},evidence:{id:s.id,source:s.source,status:s.status,captured_at:s.captured_at}};
}
function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x??null)}
export async function identifyMeasurement(m,observedAt=Date.now()){
 const bytes=new TextEncoder().encode(canonical(m));const digest=await crypto.subtle.digest('SHA-256',bytes);
 const id=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 return {...m,measurement_id:id,observed_at:observedAt};
}
export async function measureCohort(entries,snapshots,{observedAt=Date.now()}={}){
 const selected=firstEntries(entries),measurements=[];
 for(const e of selected)measurements.push(await identifyMeasurement(measureEntry(e,snapshots),observedAt));
 return measurements;
}
export function ledgerValues(m){return [m.measurement_id,m.sample_key,m.algorithm_version,m.anchor_entry_id,m.fixture_id,m.engine,m.observed_at,m.measurement_status,JSON.stringify(m)]}
export function summarize(measurements){
 const report={algorithm_version:VERSION,selection:'FIRST_CAPTURE_PER_FIXTURE_ENGINE',real_bet_roi:null,engines:{}};
 for(const engine of ['FT','H1']){
  const rows=measurements.filter(x=>x.engine===engine),settled=rows.filter(x=>x.measurement_status==='PAPER_RESOLVED'),pl=round(settled.reduce((a,b)=>a+b.unit_pl,0));
  report.engines[engine]={samples:rows.length,reconciled:settled.length,unknown:rows.length-settled.length,positive:settled.filter(x=>x.unit_pl>0).length,negative:settled.filter(x=>x.unit_pl<0).length,push:settled.filter(x=>x.unit_pl===0).length,paper_unit_pl:pl,paper_roi_pct:settled.length?round(100*pl/settled.length):null,unknown_reasons:Object.fromEntries([...new Set(rows.filter(x=>x.reason).map(x=>x.reason))].map(k=>[k,rows.filter(x=>x.reason===k).length]))};
 }
 return report;
}
