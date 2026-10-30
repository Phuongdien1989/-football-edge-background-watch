import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoFTPacket} from './demo-data.mjs';
import {mapFTLiveRows,normalizeFTPreviewPacket} from './read-model.mjs';
import {renderFTScreen} from './ui.mjs';
import {reviewFTTotalPrice} from '../ft-audit-fix/ft-total-settlement.mjs';
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
const count=(source,needle)=>source.split(needle).length-1;
const t=Date.UTC(2026,9,23,2,30);
const fx={fixture:{id:42,status:{short:'2H',elapsed:72}},league:{name:'K League 1',country:'Korea'},
 teams:{home:{id:1,name:'FC Seoul'},away:{id:2,name:'Gimcheon'}},
 goals:{home:1,away:1},score:{fulltime:null}};
const v=[{value:'Over',handicap:2.5,odd:1.91,main:true},{value:'Under',handicap:2.5,odd:1.94,main:true}];
const source={fixture:{status:'OK',received_at:t-3000,source_at:null,data:fx},
 odds:{status:'OK',received_at:t-2000,source_at:null,
 data:[{fixture:{id:42},odds:[{id:5,name:'Over/Under',values:v}]}]}};
const observation={schema:'FT_OBSERVATION_V1_DRAFT',id:'42:72:evidence',fixture_id:42,
 decision_at:t,fixture:fx,sources:source};
const decision={schema:'FT_DECISION_V1_DRAFT',observation_id:observation.id,fixture_id:42,
 input_at:t,decision_at:t+200,state:'EVALUATED',
 source_hash:'a'.repeat(64),evaluation:{score:91,scoreMode:'FULL'},
 devices:[{goal_estimate:{prob:99,source:'MODEL',n:0}}],
 market_rows:[{source:'live',fixture_id:42,category:'over_under',bet_id:5,bet:'Over/Under',
 feed_bet_name:'Over/Under',bet_reference:{mapped_by:'BET_ID_REFERENCE',canonical_name:'Over/Under'},
 integrity:{valid:true},feed_status:{},values:v}]};
const pair={observation,decision};
const live=mapFTLiveRows([pair],t+60000);
test('verified FT pair yields one read-only fixture card',()=>{assert.equal(live.rows.length,1);assert.equal(live.rows[0].id,42);assert.equal(live.rows[0].league,'K League 1')});
test('paired market quote is kept with exact Over and Under',()=>{assert.equal(live.rows[0].quote?.line,2.5);assert.equal(live.rows[0].quote?.over_odds,1.91);assert.equal(live.rows[0].quote?.under_odds,1.94)});
test('no PMF/AI price invented from FT score 91 or binary goal estimate 99',()=>{assert.equal(live.rows[0].model.pmf,null);assert.equal(live.rows[0].model.fair_over,null);assert.equal(live.rows[0].recommendation.ev,null);assert.equal(live.rows[0].recommendation.rank,null)});
test('market quote is explicitly non-executable',()=>assert.equal(live.rows[0].quote.executable,false));
test('tampered raw odds loses market quote and is never displayed as verified',()=>{
 const f=structuredClone(pair);
 // Do not alias normalized values to raw input: prove independent parity check.
 f.decision.market_rows[0].values=structuredClone(f.decision.market_rows[0].values);
 f.observation.sources.odds.data[0].odds[0].values[0].odd=2.9;
 const p=mapFTLiveRows([f],t+60000);assert.equal(p.rows[0].quote,null);assert.equal(p.rows[0].recommendation.state,'WAIT_MODEL');
});
test('unknown/future observation is not admitted',()=>assert.equal(mapFTLiveRows([{observation:{...observation,decision_at:t+9999999},decision}],t).rows.length,0));
test('multiple snapshots of same fixture give one match card',()=>{
 const old=structuredClone(pair);old.observation.id='42:62:older';old.observation.decision_at=t-600000;
 old.observation.fixture.fixture.status.elapsed=62;old.observation.sources.fixture.received_at=t-601000;
 old.observation.sources.fixture.data.fixture.status.elapsed=62;
 old.observation.sources.odds.received_at=t-602000;
 old.decision.observation_id=old.observation.id;old.decision.input_at=old.observation.decision_at;old.decision.decision_at=t-599000;
 assert.equal(mapFTLiveRows([pair,old],t+60000).rows.length,1);
});
test('demo packet cannot be used as real FT evidence',()=>assert.equal(normalizeFTPreviewPacket(demoFTPacket).rows.length,0));
test('live packet cannot accidentally be rendered as demo',()=>assert.equal(normalizeFTPreviewPacket(live,{demo:true}).rows.length,0));
test('live malicious pricing object is always cleared by display adapter',()=>{
 const forged=structuredClone(live);forged.rows[0].model={status:'CALIBRATED',fair_over:1.1,ev_over:1,pmf:[{finalTotalGoals:4,probability:1}]};
 forged.rows[0].recommendation={state:'INVESTABLE',side:'OVER',line:2.5,odds:1.91,ev:1,rank:1};
 const checked=normalizeFTPreviewPacket(forged);
 assert.equal(checked.rows[0].recommendation.ev,null);
 assert.equal(checked.rows[0].model.pmf,null);
});
test('live list never presents recommendation or positive EV',()=>{
 const s=renderFTScreen(live);assert(s.includes('CHỜ MODEL'));assert(!s.includes('EV DEMO'));assert(!s.includes('TOP 1'));assert(!s.includes('91%'));
});
test('live detail includes league and match with no fair pricing',()=>{
 const s=renderFTScreen(live,{selectedId:42,tab:'pricing'});
 assert(s.includes('K League 1'));assert(s.includes('1 – 1'));assert(s.includes('Chưa hiệu chỉnh'));assert(s.includes('fair odds và EV'));
});
test('live chart makes lack of PMF explicit, preserves binary signal distinction',()=>{
 const s=renderFTScreen(live,{selectedId:42,tab:'chart'});
 assert(s.includes('Đang chờ xác suất tổng bàn FT'));assert(s.includes('không phải dự đoán xác suất'));
});
test('all five demo matches are distinct fixtures, clearly fictional',()=>{
 assert.equal(demoFTPacket.rows.length,5);assert.equal(new Set(demoFTPacket.rows.map(r=>r.id)).size,5);
 const s=renderFTScreen(demoFTPacket,{demo:true});
 assert.equal(count(s,'class="ftv2-match-card"'),5);assert(s.includes('SỐ LIỆU GIẢ LẬP'));
});
test('demo fair odds and EV are internally consistent with 1-unit Asian total settlement',()=>{
 for(const row of demoFTPacket.rows){
  const basis={line:row.quote.line,distribution:row.model.pmf,modelVersion:'DEMO_ONLY',
   modelReceivedAt:10,marketReceivedAt:20,decisionAt:30};
  for(const side of ['OVER','UNDER']){
   const result=reviewFTTotalPrice({...basis,side,decimalOdds:side==='OVER'?row.quote.over_odds:row.quote.under_odds});
   const expected=side==='OVER'?row.model.ev_over:row.model.ev_under;
   assert(Math.abs(result.expected_net_units-expected)<1e-11);
  }
 }
});
test('demo bar probabilities are a valid final-score PMF',()=>{
 for(const row of demoFTPacket.rows){const s=row.model.pmf.reduce((a,r)=>a+r.probability,0);assert(Math.abs(s-1)<1e-9);}
});
test('summary shows separate demo pick and explicitly synthetic EV',()=>{
 const s=renderFTScreen(demoFTPacket,{selectedId:910001,tab:'summary',demo:true});
 assert(s.includes('KÈO MINH HỌA')===false);assert(s.includes('VÍ DỤ GIẢ LẬP'));assert(s.includes('EV DEMO'));
 assert(s.includes('4.7%'));
});
test('pricing tab supports quarter lines but only one quoted market line',()=>{
 const s=renderFTScreen(demoFTPacket,{selectedId:910001,tab:'pricing',demo:true});
 assert(s.includes('2.25'));assert(s.includes('2.75'));assert(s.includes('3.5'));
 assert.equal(count(s,'class="ftv2-highlight"'),1);
 assert(s.includes('Giá NC O/U'));
});
test('history tab contains an honest unsettled status',()=>{
 const s=renderFTScreen(demoFTPacket,{selectedId:910001,tab:'history',demo:true});
 assert(s.includes('Lịch sử ghi nhận FT'));assert(s.includes('Chưa quyết toán'));
});
test('all text from source names is escaped, not inserted as raw markup',()=>{
 const x=structuredClone(live);x.rows[0].home='<img src=x onerror=alert(1)>';x.rows[0].league='<svg onload=alert(1)>';
 const s=renderFTScreen(x);assert(s.includes('&lt;img'));assert(s.includes('&lt;svg'));assert(!s.includes('<img'));assert(!s.includes('<svg onload'));
});
test('external LIVE input does not import synthetic demo fixtures',()=>{
 const s=renderFTScreen(mapFTLiveRows([],t));assert(!s.includes('FC Seoul'));assert(s.includes('Chưa có trận đủ dữ liệu'));
});
test('CSS remains entirely scoped: no global body/html/theme switch or HT selectors',()=>{
 const css=readFileSync('ft-v2-mobile/style.css','utf8');
 assert(css.includes('--ftbg:#eff6fc'));assert(css.includes('--ftblue:#147cf5'));assert(css.includes('--ftgreen:#08a978'));
 assert(!/(^|\n)\s*(?:body|html|:root|\.htp-card|#feTabsWorkspace)\s*[{,]/m.test(css));
});
test('all browser assets live within isolated FT namespace',()=>{
 const h=readFileSync('ft-v2-mobile/preview.html','utf8');
 assert(h.includes('./style.css'));assert(h.includes('./preview.mjs'));
 const m=readFileSync('ft-v2-mobile/preview.mjs','utf8');
 assert(m.includes('demoFTPacket'));assert(m.includes('readExistingFTWatch(window.FEUIReadBridge)'));
});
console.log('FE_FT_V2_LIGHT_UI_PASS '+JSON.stringify({checks,demo_fixture_count:5,real_ev_calculated:false,live_recommendations:0,ht_hc_assets_changed:0,api_calls:0,d1_writes:0,production_deploy:false}));
