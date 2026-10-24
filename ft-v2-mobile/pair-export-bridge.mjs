// FT V2 3N — zero-network, zero-write ingestion of exported immutable PAIR rows.
// A valid SHA-256 pair checks internal immutability, NOT remote provider
// authenticity, current bookmaker identity, bet scope or live settlement.
// This path cannot generate an investment recommendation.
import {verifyFTPairRow} from '../ft-audit-fix/pair-outcome-replay.mjs';
import {mapFTLiveRows} from './read-model.mjs';
const validMs=n=>Number.isSafeInteger(n)&&n>0;
const emptyPacket=(now,reason)=>({schema:'FT_V2_MOBILE_READ_ONLY',mode:'LIVE',rows:[],
 reason,top_verified:false,prices_verified:false,generated_at:now,
 source:'EXPORTED_HASH_VERIFIED_FT_PAIRS',source_attestation:'EXPORT_ORIGIN_NOT_VERIFIED'});
const blocked=(reason,index)=>({index,reason});
export async function inspectFTPairExport(rows,{
 now=Date.now(),maxAgeMs=600000,maxRows=250,maxRecordBytes=20000,maxQuoteAgeMs=60000
}={}){
 if(!validMs(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<60000||
 !Number.isSafeInteger(maxRows)||maxRows<1||maxRows>2000||
 !Number.isSafeInteger(maxRecordBytes)||maxRecordBytes<1||
 !Number.isSafeInteger(maxQuoteAgeMs)||maxQuoteAgeMs<1000||maxQuoteAgeMs>maxAgeMs)
 throw Error('INVALID_FT_EXPORT_READ_CONFIG');
 if(!Array.isArray(rows)||rows.length>maxRows)throw Error('INVALID_OR_UNBOUNDED_PAIR_EXPORT');
 const audit={schema:'FT_EXPORTED_PAIR_DISPLAY_AUDIT_3N',total:rows.length,
  hash_verified:0,invalid_or_duplicate:0,older_than_live_window:0,
  future_or_bad_clock:0,quotes_raw_matched:0,quotes_not_matched:0,
  quotes_too_old_for_live:0,quotes_displayed:0,live_fixtures:0,
  issues:[],max_age_ms:maxAgeMs,max_quote_age_ms:maxQuoteAgeMs,
  hashed_source_proves_provider_truth:false,production_ready:false,
  model_calibrated:false,provider_calls:0,d1_queries:0,d1_writes:0};
 const good=[],ids=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const key=row?.observation_id;
  if(typeof key!=='string'||!key||ids.has(key)){
   audit.invalid_or_duplicate++;audit.issues.push(blocked('DUPLICATE_OR_INVALID_OBSERVATION_ID',i));continue;
  }
  ids.add(key);
  const result=await verifyFTPairRow(row,{maxRecordBytes});
  if(result.status!=='VALID_PAIR'){
   audit.invalid_or_duplicate++;audit.issues.push(blocked(result.reason||'PAIR_INTEGRITY_REJECT',i));continue;
  }
  audit.hash_verified++;
  const o=result.observation,d=result.decision;
  // "now" and the source receive-time are independent. No future snapshots.
  if(!validMs(o.decision_at)||!validMs(d.decision_at)||d.decision_at>now||
    o.decision_at>now||d.decision_at<o.decision_at){
   audit.future_or_bad_clock++;audit.issues.push(blocked('PAIR_RECEIVED_AFTER_VIEW_CLOCK',i));continue;
  }
  if(now-o.decision_at>maxAgeMs){
   audit.older_than_live_window++;continue;
  }
  good.push(result);
 }
 const packet=mapFTLiveRows(good,now);
 // Quote must be independently raw-matched by FT 3K and fresh enough for the
 // *viewer*; raw verification at decision time does not certify today's price.
 for(const row of packet.rows){
  if(row.quote?.raw_confirmed===true){
   audit.quotes_raw_matched++;
   const age=now-row.quote.received_at;
   if(!validMs(row.quote.received_at)||age<0||age>maxQuoteAgeMs){
    audit.quotes_too_old_for_live++;row.quote=null;
    row.integrity={...row.integrity,status:'VERIFIED_PAST_PRICE_NOT_CURRENT',
      reason:'RAW_MATCHED_ODDS_TOO_OLD_FOR_VIEW'};
   }else{
    audit.quotes_displayed++;
    row.quote={...row.quote,executable:false,bookmaker_id:null,
     full_match_settlement_rule:'NOT_INDEPENDENTLY_CONFIRMED'};
   }
  }else audit.quotes_not_matched++;
  row.freshness=now-row.decision_at<=60000?'CURRENT':'STALE';
  row.source_attestation='HASH_VERIFIED_EXPORTED_PAIR_ORIGIN_UNVERIFIED';
  row.model={status:'AWAITING_VALIDATED_TOTAL_GOALS_PMF',
   fair_over:null,fair_under:null,ev_over:null,ev_under:null,
   pmf:null,calibrated:false};
  row.recommendation={state:'WAIT_MODEL',side:null,line:null,odds:null,ev:null,rank:null};
 }
 audit.live_fixtures=packet.rows.length;
 packet.source='EXPORTED_HASH_VERIFIED_FT_PAIRS';
 packet.source_attestation='EXPORT_ORIGIN_NOT_VERIFIED';
 packet.prices_verified=false; // raw parity != licensed bookmaker proof
 packet.top_verified=false;
 packet.reason=packet.rows.length?'READ_ONLY_FT_PAIRS_UNPRICED':'NO_RECENT_HASH_VERIFIED_PAIRS';
 return {packet,audit,status:packet.rows.length?'RECENT_PAIR_EVIDENCE_ONLY':'NO_RECENT_PAIR_EVIDENCE',
  releaseGate:'BLOCKED_UNCALIBRATED_AND_UNATTESTED'};
}
