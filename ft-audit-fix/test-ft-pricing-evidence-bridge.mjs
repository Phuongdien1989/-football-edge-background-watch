import assert from 'node:assert/strict';
import {extractFTPricingEvidence as bridge} from './ft-pricing-evidence-bridge.mjs';
const t=1782150000000;
const fx={fixture:{id:42,status:{short:'2H',elapsed:75}},goals:{home:1,away:1},score:{fulltime:null}};
const observation={
 schema:'FT_OBSERVATION_V1_DRAFT',id:'42:75:locked',fixture_id:42,decision_at:t,fixture:fx,
 sources:{
  fixture:{status:'OK',received_at:t-1200,source_at:null,data:fx},
  odds:{status:'OK',received_at:t-1000,source_at:null,data:[{fixture:{id:42},odds:[]}]}
 }
};
const vals=(line=2.5,over=1.95,under=1.9,main=true)=>[
 {value:'Over',handicap:line,odd:over,main,suspended:false},
 {value:'Under',handicap:line,odd:under,main,suspended:false}
];
const market=(values=vals())=>({
 source:'live',fixture_id:42,category:'over_under',bet:'Over/Under',feed_bet_name:'Over/Under',
 bet_id:5,bet_reference:{mapped_by:'BET_ID_REFERENCE',canonical_name:'Over/Under'},
 integrity:{valid:true,trusted:true},feed_status:{blocked:false,stopped:false,finished:false},values,
 update:'2026-10-22T10:00:00Z'
});
const decision={schema:'FT_DECISION_V1_DRAFT',observation_id:observation.id,fixture_id:42,
 input_at:t,decision_at:t+100,state:'EVALUATED',evaluation:{score:78,scoreMode:'FULL',best_over:{line:2.5,odd:1.95}},
 source_hash:'a'.repeat(64),market_rows:[market()],
 devices:[{device_slot:0,goal_estimate:{prob:71,n:0,source:'MODEL',basis:'MODEL'}}]};
let tests=0;const test=(title,fn)=>{fn();tests++;console.log('PASS '+title)};
const call=(o=observation,d=decision,keepRaw=false)=>{
 // Real source is the unnormalized API response, not a manufactured market price.
 // Test harness uses the same selected inputs to simulate that raw input by default.
 const raw=(Array.isArray(d?.market_rows)?d.market_rows:[]).map(m=>({
  fixture:{id:m.fixture_id},odds:[{id:m.bet_id,name:m.feed_bet_name,values:m.values}]
 }));
 const source=keepRaw?o:{...o,sources:{...o.sources,odds:{...o.sources.odds,data:raw}}};
 return bridge({observation:source,decision:d});
};
test('real normalized Over/Under pair is evidence but NO artificial fair price',()=>{
 const x=call();assert.equal(x.status,'EVIDENCE_READY_UNPRICED');
 assert.equal(x.bookmaker_quote.line,2.5);assert.equal(x.bookmaker_quote.over_odds,1.95);
 assert.equal(x.bookmaker_quote.under_odds,1.9);assert.equal(x.pricing.fair_decimal_odds,null);
 assert.equal(x.pricing.ev,null);assert.equal(x.pricing.final_recommendation,null);
 assert.equal(x.bookmaker_quote.executable,false);assert.equal(x.bookmaker_quote.bookmaker_id,null);
});
test('goal_ft probability 71 never treated as final total goals probability',()=>{
 const x=call();assert.equal(x.signal.device_goal_signals[0].event_probability_pct,71);
 assert.equal(x.signal.device_goal_signals[0].sample_n,0);
 assert.match(x.signal.signal_contract,/NOT_A_FINISHING_GOALS_PMF/);
 assert.equal(x.pricing.status,'UNPRICED');
});
test('raw live odds fixture identity is required',()=>{
 const x=call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,
  data:[{fixture:{id:43},odds:[{id:5,name:'Over/Under',values:vals()}]}]}}},decision,true);
 assert.equal(x.reason,'NORMALIZED_MARKET_NOT_RECONCILED_WITH_RAW_ODDS');
});
test('normalized Over quote with changed price fails raw cross-check',()=>{
 const x=call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,
  data:[{fixture:{id:42},odds:[{id:5,name:'Over/Under',values:vals(2.5,1.5,1.9)}]}]}}},decision,true);
 assert.equal(x.reason,'NORMALIZED_MARKET_NOT_RECONCILED_WITH_RAW_ODDS');
});
test('raw second half market cannot be promoted to FT even with corrected normalized category',()=>{
 const x=call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,
  data:[{fixture:{id:42},odds:[{id:5,name:'Second Half Over/Under',values:vals()}]}]}}},decision,true);
 assert.equal(x.reason,'NORMALIZED_MARKET_NOT_RECONCILED_WITH_RAW_ODDS');
});
test('raw bookmaker bet id different is rejected',()=>{
 const x=call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,
  data:[{fixture:{id:42},odds:[{id:999,name:'Over/Under',values:vals()}]}]}}},decision,true);
 assert.equal(x.reason,'NORMALIZED_MARKET_NOT_RECONCILED_WITH_RAW_ODDS');
});
test('FT score 78 never converted into probability of Over 2.5',()=>{const x=call();assert.equal(x.signal.goal_ft_score,78);assert.equal(x.pricing.ev,null)});
test('missing odds source blocked',()=>assert.equal(call({...observation,sources:{...observation.sources,odds:{status:'MISSING'}}}).reason,'LIVE_ODDS_SOURCE_RECEIPT_UNVERIFIED'));
test('future source receipt rejected',()=>assert.equal(call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,received_at:t+1}}}).status,'EVIDENCE_BLOCKED'));
test('invalid provider source timestamp rejected',()=>assert.equal(call({...observation,sources:{...observation.sources,odds:{...observation.sources.odds,source_at:t-500}}}).status,'EVIDENCE_BLOCKED'));
test('future decision cannot pair with earlier observation',()=>assert.equal(call(observation,{...decision,input_at:t+1}).status,'EVIDENCE_BLOCKED'));
test('mismatched fixture ID rejected',()=>assert.equal(call(observation,{...decision,fixture_id:43}).status,'EVIDENCE_BLOCKED'));
test('completed fixture rejected',()=>{const x=call({...observation,fixture:{...fx,fixture:{id:42,status:{short:'FT'}}}});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('source fixture with hidden final score rejected',()=>{const x=call({...observation,sources:{...observation.sources,fixture:{...observation.sources.fixture,data:{...fx,score:{fulltime:{home:2,away:1}}}}}});assert.equal(x.reason,'FORECAST_INPUT_INTEGRITY_REJECT')});
test('HT total market not accepted',()=>{const x=call(observation,{...decision,market_rows:[{...market(),category:'h1_total'}]});assert.equal(x.reason,'NO_FULL_TIME_OU_MARKET')});
test('second-half total disguised as FT explicitly rejected',()=>{const x=call(observation,{...decision,market_rows:[{...market(),feed_bet_name:'Second Half Over/Under'}]});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('team goals total disguised as FT explicitly rejected',()=>{const x=call(observation,{...decision,market_rows:[{...market(),bet:'Home Team Total Over/Under'}]});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('bookmaker quote fixture 43 not used for fixture 42',()=>{const x=call(observation,{...decision,market_rows:[{...market(),fixture_id:43}]});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('suspended Over leg cannot be paired',()=>{const v=vals();v[0].suspended=true;assert.equal(call(observation,{...decision,market_rows:[market(v)]}).status,'EVIDENCE_BLOCKED')});
test('stopped market cannot be priced or shown as tradable',()=>{const m=market();m.feed_status={stopped:true};assert.equal(call(observation,{...decision,market_rows:[m]}).status,'EVIDENCE_BLOCKED')});
test('invalid market integrity rejected',()=>{const m=market();m.integrity.valid=false;assert.equal(call(observation,{...decision,market_rows:[m]}).status,'EVIDENCE_BLOCKED')});
test('conflicting over prices per same line not arbitrarily selected',()=>{const v=[...vals(),{value:'Over',handicap:2.5,odd:1.8,main:true}];assert.equal(call(observation,{...decision,market_rows:[market(v)]}).status,'EVIDENCE_BLOCKED')});
test('two bookmakers without bookmaker identity remains ambiguous',()=>{const x=call(observation,{...decision,market_rows:[market(),market()]});assert.equal(x.reason,'MULTIPLE_FT_MARKETS_WITHOUT_BOOKMAKER_ID')});
test('two full-match lines with no main pair remain ambiguous',()=>{const x=call(observation,{...decision,market_rows:[market([...vals(2.5,1.9,2,false),...vals(2.75,1.95,1.9,false)])]});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('one explicit main line selected if both sides are main',()=>{const x=call(observation,{...decision,market_rows:[market([...vals(2.5,1.9,2,true),...vals(2.75,1.95,1.9,false)])]});assert.equal(x.status,'EVIDENCE_READY_UNPRICED');assert.equal(x.bookmaker_quote.line,2.5)});
test('Asian FT 2.75 quote preserved with both sides',()=>{const x=call(observation,{...decision,market_rows:[market(vals(2.75))]});assert.equal(x.bookmaker_quote.line,2.75)});
test('Over 2.25 labels parsed if numeric handicap missing',()=>{const x=call(observation,{...decision,market_rows:[market([{value:'Over 2.25',handicap:null,odd:'1.90',main:true},{value:'Under 2.25',handicap:null,odd:'1.95',main:true}])]});assert.equal(x.status,'EVIDENCE_READY_UNPRICED');assert.equal(x.bookmaker_quote.line,2.25)});
test('market without line not defaulted to zero',()=>{const x=call(observation,{...decision,market_rows:[market([{value:'Over',handicap:null,odd:1.9,main:true},{value:'Under',handicap:null,odd:1.9,main:true}])]});assert.equal(x.status,'EVIDENCE_BLOCKED')});
test('stale 6 minute receipt is flagged, not allowed executable status',()=>{
 const o={...observation,sources:{...observation.sources,odds:{...observation.sources.odds,received_at:t-360001}}};const x=call(o);
 assert.equal(x.status,'EVIDENCE_READY_UNPRICED');assert(x.warnings.includes('ODDS_RECEIPT_OVER_FIVE_MINUTES'));assert.equal(x.bookmaker_quote.executable,false);
});
test('no provider timestamp is warning, never invented',()=>{const x=call();assert.equal(x.provider_source_at,null);assert(x.warnings.includes('ODDS_PROVIDER_SOURCE_TIME_UNKNOWN'))});
test('independent score is not a source-derived model distribution',()=>{const x=call(observation,{...decision,evaluation:{score:100,scoreMode:'FULL',best_over:{line:2.5,odd:1.95}}});assert.equal(x.pricing.fair_decimal_odds,null)});
test('device fallback n=0 never promoted to calibrated proof',()=>{const x=call();assert.equal(x.signal.device_goal_signals[0].source,'MODEL');assert.equal(x.pricing.final_recommendation,null)});
console.log('FE_FT_PRICING_EVIDENCE_3K_PASS '+JSON.stringify({tests,model_pmf_exists:false,synthetic_model_claims:0,production_deploy:false,D1_writes:0}));
