// Shared, explicit decision record for the next HT integration stage.
// Pure adapter: never changes model, legacy ranking, subscription or Push state.
export const HT_DECISION_VERSION='HT_DECISION_CONTRACT_V1';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function htDecision(item,row,{now=Date.now(),legacyRank=null,legacyScore=null,deliveryEligible=null,deliveryThreshold=null}={}){
 const id=Number(item?.id);if(!Number.isSafeInteger(id)||id<=0||row?.id!==id)return null;
 const observed=row.at,age=finite(observed)?now-observed:null;
 const dataOK=!!row.dataOK&&age!==null&&age>=0&&age<=55000;
 const modelOK=dataOK&&!!row.modelOK,marketOK=dataOK&&!!row.marketOK;
 const q=modelOK&&marketOK?row.quote:null;
 const actionable=!!q&&finite(q.ev)&&q.ev>0&&row.action==='TRIAL_OVER';
 const state=!dataOK?'WAIT_DATA':!modelOK?'WAIT_MODEL':!marketOK?'WAIT_MARKET':actionable?'TRIAL_OVER':'WAIT_PRICE';
 const recommendation={state,period:'H1',basis:'FIRST_HALF_TOTAL',selection:'OVER',line:marketOK?row.recommendation?.line??null:null,odds:marketOK?row.recommendation?.odds??null:null,estimatedEV:q?.ev??null,fairOdds:q?.fairOdds??null,experimental:true};
 // Explicitly separate forecast probabilities from required price return.
 const halfLine=q&&Math.abs((recommendation.line%1)-.5)<1e-8;
 const pushKnown=typeof deliveryEligible==='boolean'&&finite(deliveryThreshold);
 return {schema:HT_DECISION_VERSION,fixtureId:id,observedAt:observed??null,evaluatedAt:now,score:{...item.latest?.goals},recommendation,
  forecast:{version:row.model?.version??null,validated:row.model?.validated===true,modelOK,winProbability:halfLine?q.win:null,sample:row.model?.sample??null},
  market:{marketOK,binary:!!halfLine,breakEvenProbability:halfLine?1/recommendation.odds:null,noVigOverProbability:row.binary?.over??null},
  ranking:{policy:'LEGACY_HT_SCORE_ORDER_PRESERVED',rank:Number.isInteger(legacyRank)&&legacyRank>0?legacyRank:null,score:finite(legacyScore)?legacyScore:null},
  delivery:{policy:'LEGACY_HT_SIGNAL_THRESHOLD_PRESERVED',state:!dataOK?'WAIT_DATA':!pushKnown?'DEVICE_SETTINGS_REQUIRED':deliveryEligible?'LEGACY_SIGNAL_ELIGIBLE':'LEGACY_SIGNAL_WAIT',threshold:finite(deliveryThreshold)?deliveryThreshold:null,recommendationPushEnabled:false},
  consumers:{card:recommendation.state,topPolicy:'LEGACY_HT_SCORE_ORDER_PRESERVED',pushPolicy:'LEGACY_HT_SIGNAL_THRESHOLD_PRESERVED'},
  reason:!dataOK?'SOURCE_DATA_NOT_USABLE':!modelOK?'INDEPENDENT_MODEL_REQUIRED':!marketOK?'MATCHING_HT_QUOTE_REQUIRED':actionable?'POSITIVE_RESEARCH_VALUE':'PRICE_NOT_POSITIVE_UNDER_MODEL'};
}
