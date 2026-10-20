import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {assessHT,htNoVig,rankHT} from './valuation.mjs';
import {snapshotForHT,htMarketLadder} from './valuation-adapter.mjs';
const now=1792555200000;
function sample(pmf=[.4,.4,.2]) {
  const s={id:1,at:now,minute:12,status:'1H',goals:{home:0,away:0},statsError:false,cooldownUntil:0,resetAt:0,
    market:{period:'H1',basis:'FIRST_HALF_TOTAL',bookmaker:'Same book',line:.5,over:1.9,under:1.9,at:now,score:{home:0,away:0}}};
  s.model={version:'SUPPLIED_TEST_HT_PMF',fixtureId:1,period:'H1_REMAINING',independent:true,validated:false,kind:'RESEARCH',at:now,pmf,condition:{at:now,minute:12,goals:{...s.goals}}};
  return s;
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,JSON.stringify({a,b}));
let count=0;
function test(name,run){run();count++;console.log('PASS '+name);}
test('early HT quote works before minute20 with a supplied matching PMF',()=>{
  const a=assessHT(sample(),now,{trialRecommendations:true});
  assert.equal(a.state,'TRIAL_OVER');near(a.quote.win,.6);near(a.quote.fairOdds,5/3);near(a.quote.ev,.14);
  assert(a.warnings.includes('MODEL_NOT_VALIDATED'));assert(a.warnings.includes('UNCERTAINTY_NOT_SUPPLIED'));
});
test('shadow mode does not silently enable recommendations',()=>{const a=assessHT(sample(),now);assert.equal(a.action,'RESEARCH_ONLY');});
test('zero-goal expectation is valid and does not become missing input',()=>{const a=assessHT(sample([1,0,0]),now);assert(a.modelOK);near(a.quote.lose,1);assert.equal(a.action,'WAIT');});
test('quarter line accounts for half-loss rather than binary win rate',()=>{const s=sample();s.market.line=.25;const a=assessHT(s,now);near(a.quote.halfLose,.4);near(a.quote.win,.6);near(a.quote.ev,.34);assert.equal(a.binary,null);});
test('integer line accounts for a push',()=>{const s=sample();s.market.line=1;const a=assessHT(s,now);near(a.quote.push,.4);near(a.quote.win,.2);near(a.quote.lose,.4);near(a.quote.fairOdds,3);near(a.quote.ev,-.22);});
test('current first-half goal is included once, not ignored or counted twice',()=>{
  const s=sample();s.goals={home:0,away:1};s.market.score={...s.goals};s.market.line=1.5;s.model.condition.goals={...s.goals};
  const a=assessHT(s,now);near(a.quote.win,.6);near(a.quote.lose,.4);near(a.quote.ev,.14);
});
test('one-and-three-quarter contract uses half wins correctly',()=>{
  const s=sample();s.goals={home:1,away:0};s.market.score={...s.goals};s.market.line=1.75;s.model.condition.goals={...s.goals};
  const a=assessHT(s,now);near(a.quote.halfWin,.4);near(a.quote.win,.2);near(a.quote.lose,.4);near(a.quote.ev,-.04);
});
test('FT, second-half and remaining-only contracts cannot be priced as full HT',()=>{
  for(const patch of [{period:'FT'},{period:'H2'},{basis:'REMAINING_ONLY'}]){const s=sample();Object.assign(s.market,patch);assert.equal(assessHT(s,now).quote,null);}
});
test('no score-to-probability fallback and no FT prior relabelled as HT',()=>{
  for(const patch of [null,{score:91},{...sample().model,period:'FT_REMAINING'},{...sample().model,independent:false}]){const s=sample();s.model=patch;assert.equal(assessHT(s,now).state,'MODEL_WAIT');}
});
test('model condition must match fixture, score, minute and source time',()=>{
  const models=[{...sample().model,fixtureId:2},{...sample().model,at:now+1},{...sample().model,condition:{...sample().model.condition,minute:13}},{...sample().model,condition:{...sample().model.condition,goals:{home:1,away:0}}}];
  for(const model of models){const s=sample();s.model=model;assert.equal(assessHT(s,now).modelOK,false);}
});
test('invalid or non-normalized distributions fail closed',()=>{
  for(const pmf of [[.4,.4],[-.1,1.1],[NaN,1],[.5,'0.5'],[]])assert.equal(assessHT(sample(pmf),now).quote,null);
});
test('missing, stale or future snapshots cannot renew freshness',()=>{
  for(const at of [null,now+1,now-56000]){const s=sample();s.at=at;assert.equal(assessHT(s,now).dataOK,false);}
});
test('wrong-score, old, future or suspended prices cannot be used',()=>{
  for(const patch of [{at:now-56000},{at:now+1},{score:{home:1,away:0}},{suspended:true},{over:1},{line:.3},{line:null}]){const s=sample();Object.assign(s.market,patch);assert.equal(assessHT(s,now).quote,null);}
});
test('goal reset invalidates the pre-goal quote without a new price',()=>{const s=sample();s.resetAt=now;s.market.at=now-1;assert.equal(assessHT(s,now).quote,null);});
test('ambiguous LIVE phase needs explicit HT confirmation',()=>{const s=sample();s.status='LIVE';assert.equal(assessHT(s,now).dataOK,false);s.periodConfirmed='H1';assert.equal(assessHT(s,now).dataOK,true);});
test('HT-ended status cannot produce a new HT recommendation',()=>{for(const status of ['HT','2H','FT','CANC']){const s=sample();s.status=status;assert.equal(assessHT(s,now,{trialRecommendations:true}).action,'WAIT');}});
test('positive model-market difference does not override negative offered-price value',()=>{
  const s=sample([.45,.55]);s.market.over=1.7;s.market.under=1.9;
  const a=assessHT(s,now,{trialRecommendations:true});assert(a.delta>0);assert(a.quote.ev<0);assert.equal(a.action,'WAIT');
});
test('supplied sensitivity range is displayed without inventing a confidence interval',()=>{
  const s=sample();s.model.scenarios=[{name:'lower',pmf:[.6,.3,.1]},{name:'higher',pmf:[.2,.4,.4]}];
  const a=assessHT(s,now,{trialRecommendations:true});assert(a.scenarioEVRange.min<0);assert(a.scenarioEVRange.max>0);
  assert(a.warnings.includes('VALUE_CHANGES_SIGN_ACROSS_SCENARIOS'));assert.equal(a.action,'TRIAL_OVER');
  assert.equal(a.scenarioEVRange.kind,'SUPPLIED_SCENARIO_RANGE_NOT_CONFIDENCE_INTERVAL');
});
test('no-vig probability is defined only for paired binary HT lines',()=>{
  const m=sample().market;near(htNoVig(m).over,.5);assert.equal(htNoVig({...m,line:.25}),null);assert.equal(htNoVig({...m,under:null}),null);
});
function item() {return {id:1,lastMarketAt:now,latest:{fresh_at:now,minute:12,status:'1H',goals:{home:0,away:0},stats_presence:{shots:true,sot:true},metrics:{total:{shots:0,sot:0}},market_rows:[{category:'h1_total',bookmaker:'A',values:[{value:'Over',handicap:.5,odd:'1.90'},{value:'Under',handicap:.5,odd:'1.90'}]}]}};}
test('adapter uses explicit HT category and real market acquisition time',()=>{
  const i=item();const q=htMarketLadder(i);assert.equal(q.length,1);assert.equal(q[0].at,now);assert.equal(q[0].timestampBasis,'MARKET_RECEIPT');
  delete i.lastMarketAt;assert.equal(htMarketLadder(i).length,0);
  i.latest.market_rows[0].category='over_under';assert.equal(htMarketLadder(i).length,0);
});
test('adapter does not pair prices across bookmakers',()=>{
  const i=item();i.latest.market_rows=[{category:'h1_total',bookmaker:'A',update:now,values:[{value:'Over',handicap:.5,odd:2}]},{category:'h1_total',bookmaker:'B',update:now,values:[{value:'Under',handicap:.5,odd:1.8}]}];
  const q=htMarketLadder(i);assert.equal(q.length,1);assert.equal(q[0].under,undefined);assert.equal(htNoVig(q[0]),null);
});
test('conflicting duplicate prices and blocked markets are excluded',()=>{
  const i=item();i.latest.market_rows[0].values.push({value:'Over',handicap:.5,odd:2.1});assert.equal(htMarketLadder(i).length,0);
  const j=item();j.latest.market_rows[0].feed_status={blocked:true};assert.equal(htMarketLadder(j).length,0);
});
test('adapter preserves observed zero stats; missing stats do not become zero',()=>{
  const i=item(),s=snapshotForHT(i);assert.equal(s.statsError,false);assert.equal(s.model,null);
  i.latest.stats_presence={};assert.equal(snapshotForHT(i).statsError,true);
});
test('attention TOP5 contains distinct fixtures and can include WAIT candidates',()=>{
  const rows=Array.from({length:8},(_,i)=>({...assessHT(sample(),now),id:i+1}));
  rows.push({...rows[0],at:now-1});const ranked=rankHT(rows);assert.equal(ranked.length,5);assert.equal(new Set(ranked.map(x=>x.id)).size,5);
  const wait=sample();wait.id=10;wait.model=null;const r=assessHT(wait,now);assert.equal(rankHT([r])[0].state,'MODEL_WAIT');
});
test('calculation does not mutate snapshots, source times or arrays',()=>{
  const s=sample(),before=JSON.stringify(s);assessHT(s,now,{trialRecommendations:true});assert.equal(JSON.stringify(s),before);
});
mkdirSync('ht-early-candidate/generated',{recursive:true});
writeFileSync('ht-early-candidate/generated/valuation-test-report.json',JSON.stringify({status:'PASS',tests:count,production_deployed:false,real_api_calls:0,real_d1_writes:0,forecast_training:false,phone_push_verified:false,remaining:['HT-specific independent predictive model from real available data','connect candidate display without changing production','real phone acceptance and quota measurement']},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',tests:count}));
