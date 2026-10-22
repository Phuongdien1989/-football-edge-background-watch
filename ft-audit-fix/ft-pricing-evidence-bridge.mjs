// FT 3K: strictly evidence-only bridge from the EXISTING Goal Radar FT binary signal
// to an independently timestamped full-match O/U live bookmaker quote.
// Never convert goal_ft, a 0–100 strength score, or per-device probabilities
// to a full regulation final-goals distribution. Never rank or recommend here.
import {inspectFTObservation} from './replay-integrity.mjs';
const goodTime=t=>Number.isSafeInteger(t)&&t>0;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validLine=n=>finite(n)&&n>=0&&n<=30&&Math.abs(n*4-Math.round(n*4))<1e-8;
const no=(reason,extra={})=>({
 schema:'FT_PRICING_EVIDENCE_3K_DRAFT',status:'EVIDENCE_BLOCKED',reason,
 bookmaker_quote:null,signal:null,pricing:{status:'UNPRICED',reason:'NO_VERIFIED_FULL_REGULATION_GOALS_DISTRIBUTION',fair_decimal_odds:null,ev:null,final_recommendation:null},...extra
});
const scopeReject=/first\s*half|1st\s*half|half\s*time|halftime|second\s*half|2nd\s*half|team\s*total|home\s*total|away\s*total|corner|1h\s*total|2h\s*total/i;
function sideFromSelection(x){
 const v=String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 if(/^over(?=\s|$|[()0-9])/i.test(v)||/^tai(?=\s|$|[()0-9])/i.test(v))return 'OVER';
 if(/^under(?=\s|$|[()0-9])/i.test(v)||/^xiu(?=\s|$|[()0-9])/i.test(v))return 'UNDER';
 return null;
}
function lineFromSelection(v){
 const raw=v?.handicap;
 if(raw!==null&&raw!==undefined&&raw!==''){
  const h=typeof raw==='number'?raw:typeof raw==='string'&&/^(?:\d+)(?:[.,]\d+)?$/.test(raw.trim())?Number(raw.replace(',','.')):NaN;
  return validLine(h)?h:null;
 }
 const label=String(v?.value??'');
 const m=label.match(/^(?:over|under|tai|xiu|tài|xỉu)\s*\(?\s*(\d+(?:[.,]\d+)?)\s*\)?\s*$/i);
 if(!m)return null;
 const num=Number(m[1].replace(',','.'));
 return validLine(num)?num:null;
}
function normalizedQuote(m,fixtureId){
 if(m?.source!=='live'||m?.category!=='over_under'||m?.fixture_id!==fixtureId)return {reason:'NOT_MATCHED_LIVE_FT_OU'};
 if(m.integrity?.valid!==true||m.feed_status?.blocked||m.feed_status?.stopped||m.feed_status?.finished||
 m.status?.blocked||m.status?.stopped||m.status?.finished)return {reason:'MARKET_NOT_ACTIVE_OR_NOT_INTEGRITY_CHECKED'};
 if(scopeReject.test(String(m.feed_bet_name??''))||scopeReject.test(String(m.bet??''))||scopeReject.test(String(m.bet_reference?.canonical_name??'')))return {reason:'NOT_FULL_MATCH_MARKET'};
 const groups=new Map();
 for(const v of (Array.isArray(m.values)?m.values:[])){
  if(v?.suspended===true)continue;
  const side=sideFromSelection(v?.value),line=lineFromSelection(v);
  const price=typeof v?.odd==='number'?v.odd:typeof v?.odd==='string'&&/^(?:\d+)(?:\.\d+)?$/.test(v.odd.trim())?Number(v.odd):NaN;
  if(!side||line===null||!finite(price)||price<=1||price>1000)continue;
  const key=String(line),group=groups.get(key)||{line,over:[],under:[]};
  group[side==='OVER'?'over':'under'].push({odds:price,main:v.main===true});
  groups.set(key,group);
 }
 const paired=[];
 for(const g of groups.values())if(g.over.length===1&&g.under.length===1){
  paired.push({line:g.line,over_odds:g.over[0].odds,under_odds:g.under[0].odds,
   main_pair:g.over[0].main&&g.under[0].main,
   bet_id:m.bet_id??null,bet_name:m.bet??m.feed_bet_name??null,
   bet_reference:m.bet_reference??null,provider_update:m.update??null});
 }
 const main=paired.filter(p=>p.main_pair);
 const chosen=main.length===1?main[0]:main.length===0&&paired.length===1?paired[0]:null;
 if(!chosen)return {reason:paired.length>1?'AMBIGUOUS_FT_MAIN_LINE':'NO_COMPLETE_FT_OVER_UNDER_PAIR'};
 return {quote:chosen};
}
function rawLiveOddsConfirm(sourceRows,fixtureId,quote){
 if(!Array.isArray(sourceRows)||quote.bet_id==null)return false;
 const reference=String(quote.bet_id);
 for(const response of sourceRows){
  if(response?.fixture?.id!==fixtureId||!Array.isArray(response.odds))continue;
  for(const bet of response.odds){
   if(String(bet?.id??'')!==reference||scopeReject.test(String(bet?.name??'')))continue;
   if(!Array.isArray(bet?.values))continue;
   const sides=new Set();
   for(const v of bet.values){
    if(v?.suspended===true)continue;
    const side=sideFromSelection(v?.value??v?.name??v?.label);
    const line=lineFromSelection({handicap:v?.handicap,value:v?.value??v?.name??v?.label});
    const rawOdd=v?.odd??v?.price;
    const odd=typeof rawOdd==='number'?rawOdd:typeof rawOdd==='string'&&/^(?:\\d+)(?:\\.\\d+)?$/.test(rawOdd.trim())?Number(rawOdd):NaN;
    if(!side||line!==quote.line||!finite(odd))continue;
    if(side==='OVER'&&Math.abs(odd-quote.over_odds)<1e-9)sides.add('OVER');
    if(side==='UNDER'&&Math.abs(odd-quote.under_odds)<1e-9)sides.add('UNDER');
   }
   if(sides.size===2)return true;
  }
 }
 return false;
}
export function extractFTPricingEvidence({observation,decision}={}){
 if(observation?.schema!=='FT_OBSERVATION_V1_DRAFT'||decision?.schema!=='FT_DECISION_V1_DRAFT'||
 typeof observation.id!=='string'||!observation.id||
 !Number.isSafeInteger(observation.fixture_id)||observation.fixture_id<=0||
 decision.observation_id!==observation.id||decision.fixture_id!==observation.fixture_id||
 decision.input_at!==observation.decision_at||!goodTime(observation.decision_at)||
 !goodTime(decision.decision_at)||decision.decision_at<observation.decision_at)return no('PAIR_IDENTITY_OR_TIME_MISMATCH');
 if(observation.fixture?.fixture?.id!==observation.fixture_id||
 observation.fixture?.fixture?.status?.short!=='2H'||
 observation.fixture?.score?.fulltime!=null)return no('NOT_VALID_LIVE_SECOND_HALF_FIXTURE');
 if(inspectFTObservation(observation).status==='REJECT')return no('FORECAST_INPUT_INTEGRITY_REJECT');
 const source=observation.sources?.odds;
 if(source?.status!=='OK'||!goodTime(source.received_at)||source.received_at>observation.decision_at||
 source.source_at!=null&&(!goodTime(source.source_at)||source.source_at>source.received_at))return no('LIVE_ODDS_SOURCE_RECEIPT_UNVERIFIED');
 const signal={family:'GOAL_RADAR_FT_BINARY_EVENT_NOT_FULL_TOTAL_DISTRIBUTION',
  goal_ft_score:decision.state==='EVALUATED'&&finite(decision.evaluation?.score)?decision.evaluation.score:null,
  score_mode:decision.evaluation?.scoreMode??null,
  source_hash:decision.source_hash??null,
  signal_contract:'BINARY_GOAL_FT_NOT_A_FINISHING_GOALS_PMF',
  device_goal_signals:Array.isArray(decision.devices)?decision.devices.map(d=>({
    device_slot:d?.device_slot??null,
    event_probability_pct:finite(d?.goal_estimate?.prob)&&d.goal_estimate.prob>=0&&d.goal_estimate.prob<=100?d.goal_estimate.prob:null,
    sample_n:Number.isSafeInteger(d?.goal_estimate?.n)&&d.goal_estimate.n>=0?d.goal_estimate.n:null,
    basis:d?.goal_estimate?.basis??null,
    source:d?.goal_estimate?.source??null
  })):[]};
 const rows=decision.market_rows;
 if(!Array.isArray(rows)||!rows.length)return no('NO_NORMALIZED_LIVE_MARKET_ROWS',{signal});
 if(rows.length>24)return no('UNEXPECTED_MARKET_ROW_VOLUME',{signal});
 const candidates=rows.filter(m=>m?.category==='over_under');
 if(!candidates.length)return no('NO_FULL_TIME_OU_MARKET',{signal});
 const valid=[],reject=[];
 for(const row of candidates){
  const q=normalizedQuote(row,observation.fixture_id);
  if(q.quote)valid.push(q.quote);else reject.push(q.reason);
 }
 if(valid.length!==1)return no(valid.length>1?'MULTIPLE_FT_MARKETS_WITHOUT_BOOKMAKER_ID':'NO_COMPLETE_TRUSTED_FT_QUOTE',
   {signal,market_reasons:reject,accepted_quote_candidates:valid.length});
 const quote=valid[0];
 if(!rawLiveOddsConfirm(source.data,observation.fixture_id,quote))return no('NORMALIZED_MARKET_NOT_RECONCILED_WITH_RAW_ODDS',{signal,market_reasons:reject});
 // The legacy normalizer does not preserve bookmaker identity or explicit live
 // settlement convention; a price snapshot is evidence, NOT an executable bet.
 return {schema:'FT_PRICING_EVIDENCE_3K_DRAFT',status:'EVIDENCE_READY_UNPRICED',
  observation_id:observation.id,fixture_id:observation.fixture_id,
  evidence_received_at:source.received_at,provider_source_at:source.source_at??null,
  decision_at:decision.decision_at,live_score:observation.fixture.goals??null,
  bookmaker_quote:{...quote,market_received_at:source.received_at,
    provider_source_at:source.source_at??null,
    bookmaker_id:null,bookmaker_identity:'NOT_CAPTURED',
    full_match_settlement_rule:'NOT_INDEPENDENTLY_CONFIRMED',
    executable:false},signal,
  pricing:{status:'UNPRICED',reason:'NO_VERIFIED_FULL_REGULATION_GOALS_DISTRIBUTION',
   fair_decimal_odds:null,ev:null,final_recommendation:null,edge_rank:null},
  warnings:[
   ...(source.source_at==null?['ODDS_PROVIDER_SOURCE_TIME_UNKNOWN']:[]),
   ...((decision.decision_at-source.received_at)>300000?['ODDS_RECEIPT_OVER_FIVE_MINUTES']:[]),
   'BOOKMAKER_IDENTITY_AND_LIVE_SETTLEMENT_UNCONFIRMED'
  ],market_reasons:reject};
}
