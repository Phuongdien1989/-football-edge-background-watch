// Football Edge FT AI V2: read-only mobile presentation adapter.
// Consumes independently frozen observation/decision pairs, using existing
// market-provenance checks. No remote fetch, storage, mutation or ranking.
import {extractFTPricingEvidence} from '../ft-audit-fix/ft-pricing-evidence-bridge.mjs';
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const i=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const txt=x=>typeof x==='string'?x.slice(0,120):'';
export function mapFTLiveRows(pairs,now=Date.now()){
 if(!Array.isArray(pairs))return {schema:'FT_V2_MOBILE_READ_ONLY',mode:'LIVE',rows:[],reason:'NO_PAIR_INPUT'};
 const matches=new Map();
 for(const pair of pairs.slice(0,200)){
  const observation=pair?.observation,decision=pair?.decision;
  if(!observation||!decision)continue;
  const id=i(observation.fixture_id),minute=i(observation.fixture?.fixture?.status?.elapsed);
  const home=i(observation.fixture?.goals?.home),away=i(observation.fixture?.goals?.away);
  if(!id||minute===null||home===null||away===null||
    !Number.isSafeInteger(observation.decision_at)||observation.decision_at>now+5000)continue;
  const evidence=extractFTPricingEvidence({observation,decision});
  const receipt=n(evidence?.evidence_received_at);
  const existing=matches.get(id);
  const event={at:observation.decision_at,minute,score:n(decision.evaluation?.score),
    received_at:receipt,status:evidence.status};
  const rows=existing?.history||[];
  if(!rows.some(x=>x.at===event.at))rows.push(event);
  const recent=existing?.decision_at??0;
  if(recent>observation.decision_at){existing.history=rows;continue;}
  const quote=evidence.status==='EVIDENCE_READY_UNPRICED'?evidence.bookmaker_quote:null;
  const fixture=observation.fixture;
  matches.set(id,{
   id,league:txt(fixture?.league?.name)||'Giải đấu chưa xác định',
   country:txt(fixture?.league?.country),
   home:txt(fixture?.teams?.home?.name)||'Đội nhà',
   away:txt(fixture?.teams?.away?.name)||'Đội khách',
   home_goals:home,away_goals:away,minute,
   state:txt(fixture?.fixture?.status?.short),decision_at:observation.decision_at,
   quote:quote?{
    line:n(quote.line),over_odds:n(quote.over_odds),under_odds:n(quote.under_odds),
    received_at:n(quote.market_received_at),bookmaker_id:quote.bookmaker_id,
    executable:false,
    raw_confirmed:true
   }:null,
   model:{status:'AWAITING_VALIDATED_TOTAL_GOALS_PMF',fair_over:null,fair_under:null,
    ev_over:null,ev_under:null,pmf:null,calibrated:false},
   recommendation:{state:'WAIT_MODEL',side:null,line:null,odds:null,ev:null,rank:null},
   integrity:{status:evidence.status,reason:evidence.reason||null,
    market_reasons:Array.isArray(evidence.market_reasons)?evidence.market_reasons:[]},
   history:rows
  });
 }
 const rows=[...matches.values()].map(x=>({...x,history:x.history
  .filter(y=>Number.isSafeInteger(y.at)&&y.at<=x.decision_at)
  .sort((a,b)=>a.at-b.at||a.minute-b.minute).slice(-60)}))
  .sort((a,b)=>b.decision_at-a.decision_at||a.id-b.id);
 return {schema:'FT_V2_MOBILE_READ_ONLY',mode:'LIVE',rows,
  reason:rows.length?'MODEL_NOT_YET_VALIDATED':'NO_VERIFIED_LIVE_PAIR',
  top_verified:false,prices_verified:false,generated_at:now};
}
export function normalizeFTPreviewPacket(packet,{demo=false}={}){
 if(!packet||packet.schema!=='FT_V2_MOBILE_READ_ONLY'||!Array.isArray(packet.rows))return {mode:'LIVE',rows:[],demo:false};
 if(!demo&&packet.mode!=='LIVE')return {mode:'LIVE',rows:[],demo:false};
 if(demo&&packet.mode!=='DEMO')return {mode:'LIVE',rows:[],demo:false};
 const rows=packet.rows.slice(0,50).filter(x=>i(x.id)>0).map(row=>{
  const x=structuredClone(row);
  if(!demo){
   // No provisional PMF, FT score or binary goal_ft signal may ever turn
   // into an executable recommendation merely by editing presentation data.
   x.model={status:'AWAITING_VALIDATED_TOTAL_GOALS_PMF',fair_over:null,fair_under:null,
    ev_over:null,ev_under:null,pmf:null,calibrated:false};
   x.recommendation={state:'WAIT_MODEL',side:null,line:null,odds:null,ev:null,rank:null};
  }
  return x;
 });
 return {schema:packet.schema,mode:demo?'DEMO':'LIVE',demo,rows,
  generated_at:n(packet.generated_at),status:demo?'SYNTHETIC_PREVIEW_ONLY':'UNPRICED_LIVE_EVIDENCE_ONLY'};
}
