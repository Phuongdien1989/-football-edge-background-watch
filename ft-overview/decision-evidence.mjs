// Staged serializer for the exact browser FT V2 assessment. No I/O or activation.
// The legacy backend FT decision is NOT interchangeable with this record.
import {assess,fingerprint,settlement,VERSION} from './core.mjs';
import {reviewFTDecision,POLICY} from './experimental-decision.mjs';
export function freezeFTDecision(snapshot,{decisionAt,sourceCommit,maxBytes=20000}={}){
 if(!Number.isSafeInteger(decisionAt)||decisionAt<=0||!Number.isSafeInteger(snapshot?.id)||snapshot.id<=0||
 !Number.isSafeInteger(snapshot.at)||snapshot.at<=0||snapshot.at>decisionAt||
 !/^[a-f0-9]{40}$/.test(sourceCommit||''))throw Error('INVALID_EVIDENCE_IDENTITY');
 if(snapshot.contextAt>decisionAt||(snapshot.history||[]).some(x=>x.at>decisionAt))throw Error('FUTURE_SOURCE');
 const copy=structuredClone(snapshot),row=assess(copy,decisionAt,{trialRecommendations:true}),review=reviewFTDecision(row);
 const record={schema:'FT_V2_BROWSER_DECISION_EVIDENCE_V1',fixture_id:copy.id,
  snapshot_at:copy.at,decision_at:decisionAt,context_received_at:copy.contextAt??null,
  source_commit:sourceCommit,engine_version:VERSION,review_policy:POLICY,
  observation:copy,decision:{entry:row.entry,action:row.recommendation.action,blocked:row.blocked,
   marketFresh:row.marketFresh,modelOK:row.modelOK,quote:row.quote,review},
  provenance:'BROWSER_BRIDGE_SNAPSHOT_NOT_PROVIDER_ATTESTATION',
  raw_market:copy.rawMarketRows??null,raw_market_missing_reason:copy.rawMarketRows?'': 'NOT_EXPOSED_BY_BRIDGE',
  final_outcome:null};
 // Canonical serialization freezes input and decision together. Storage must use
 // an atomic unique epoch+fixture insert and persistent quota; JSON alone is not persistence.
 const json=fingerprint(record),bytes=new TextEncoder().encode(json).length;
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||bytes>maxBytes)throw Error('EVIDENCE_TOO_LARGE');
 return {fixture_id:copy.id,json,bytes};
}
export function settleFTEvidence(record,final){
 const r=typeof record==='string'?JSON.parse(record):record;
 if(final?.fixture_id!==r.fixture_id||!Number.isSafeInteger(final.received_at)||final.received_at<=r.decision_at||
 !['FT','AET','PEN'].includes(final.status))return {state:'PENDING'};
 // Caller must supply regulation-time score explicitly, never extra-time total.
 const score=final.regulation_score;
 if(![score?.home,score?.away].every(x=>Number.isInteger(x)&&x>=0))return {state:'PENDING'};
 const before=r.observation.goals;
 if(score.home<before.home||score.away<before.away)return {state:'REVIEW_SCORE_CORRECTION'};
 const m=r.observation.market;
 if(!r.decision.marketFresh||!r.decision.quote||!m)return {state:'FINAL_NO_PRICED_DECISION',score};
 const units=settlement(score.home+score.away,m.line);
 return {state:'RESOLVED',score,units,profit_per_unit:units>0?units*(m.over-1):units,
  hypothetical:true,actually_bet:false};
}
