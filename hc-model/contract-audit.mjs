// Evidence report, not a settlement-rule inference. No I/O.
import {resolveHCBasis} from './rule-policy.mjs';
export function auditHCContract(quote,{verifiedRules=[]}={}){
 const q=quote||{},rule=resolveHCBasis(q,{verifiedRules}),missing=[];
 if(!q.sourceId)missing.push('SOURCE_ID');if(q.marketId==null)missing.push('MARKET_ID');
 if(q.sourceQuote!==true)missing.push('ORIGINAL_PAIR');
 if(!['HOME','AWAY'].every(side=>typeof q[side==='HOME'?'homeOdd':'awayOdd']==='number'&&q[side==='HOME'?'homeOdd':'awayOdd']>1))missing.push('PAIRED_ODDS');
 if(typeof q.line!=='number'||!Number.isFinite(q.line)||Math.abs(q.line*4-Math.round(q.line*4))>1e-9)missing.push('QUARTER_LINE');
 if(!q.observedScore)missing.push('OBSERVED_SCORE');if(!Number.isFinite(q.quoteAt))missing.push('QUOTE_TIME');
 if(!rule.verified)missing.push('VERIFIED_SOURCE_SETTLEMENT_RULE');
 return {sourceId:q.sourceId??null,marketId:q.marketId??null,period:q.period??null,mode:q.mode??null,
  givingSide:typeof q.line!=='number'?null:q.line<0?'HOME':q.line>0?'AWAY':'LEVEL',homeLine:q.line??null,awayLine:typeof q.line==='number'?-q.line:null,
  quoteAt:q.quoteAt??null,timestampBasis:q.timestampBasis??'UNAVAILABLE',observedScore:q.observedScore??null,providerScore:q.providerScore??null,
  basis:rule.basis,ruleReference:rule.reference,ruleReason:rule.reason,missing,settlementVerified:rule.verified,
  tradeReady:false,limits:['OBSERVED_SCORE_IS_NOT_PROVIDER_SCORE','NO_RULE_INFERRED_FROM_LINE_OR_BOOK_LABEL']};
}
