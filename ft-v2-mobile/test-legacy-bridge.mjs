import assert from 'node:assert/strict';
import {readExistingFTWatch} from './legacy-bridge.mjs';
import {renderFTScreen} from './ui.mjs';
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('PASS '+name)};
const at=Date.UTC(2026,9,23,5,0),now=at+25000;
const live=(id=1555,time=at,minute=71)=>({
 id,home:'FC Seoul',away:'Gimcheon',league:'K League 1',history:[
  {captured_at:time-180000,minute:minute-3,goals:{home:1,away:1},stats_presence:{sot:true},metrics:{total:{sot:8}}},
  {captured_at:time-90000,minute:minute-2,goals:{home:1,away:1},stats_presence:{sot:true},metrics:{total:{sot:9}}},
  {captured_at:time,minute,goals:{home:1,away:1},stats_presence:{sot:true},metrics:{total:{sot:10}}}
 ],
 ui:{fixture:{fixture:{id,status:{short:'2H',elapsed:minute}},league:{name:'K League 1',country:'Korea'},
  teams:{home:{name:'FC Seoul'},away:{name:'Gimcheon'}}},
  snapshot:{captured_at:time,minute,status:'2H',goals:{home:1,away:1},
   stats_presence:{sot:true},metrics:{total:{sot:10}},market_rows:[{category:'over_under',values:[{value:'Over',handicap:2.5,odd:2.1}]}]},
  engines:{FT:{score:81,scoreMode:'FULL'},H1:{score:49}}
 },
 h1History:[{some:'HT'}],hcHistory:[{some:'HC'}],alerts:{'device:h1':{armed:true}},
 oddsHistory:[{odd:2.1}]
});
const bridge=(items)=>({read(){return {watchState:{items},h1WatchState:{items:[{id:88}]},handicapWatchState:{pool:[{id:90}]}}}});
test('read current existing Mobile FT watch snapshot without new API',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 assert.equal(p.rows.length,1);assert.equal(p.source,'EXISTING_FT_WATCH_BRIDGE');
 assert.equal(p.rows[0].home,'FC Seoul');assert.equal(p.rows[0].minute,71);
 assert.equal(p.rows[0].freshness,'CURRENT');
});
test('never promotes normalized-only market prices as confirmed raw quote',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 assert.equal(p.rows[0].quote,null);
 assert.equal(p.rows[0].integrity.reason,'RAW_BOOKMAKER_PROVENANCE_NOT_AVAILABLE_IN_MOBILE_WATCH');
});
test('Goal Radar score 81 is signal, not probability or EV',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 assert.equal(p.rows[0].latest_ft_signal_score,81);
 assert.equal(p.rows[0].model.pmf,null);
 assert.equal(p.rows[0].recommendation.ev,null);
 assert.equal(p.rows[0].recommendation.rank,null);
});
test('observed shots-on-target history comes from recorded stats only',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 assert.deepEqual(p.rows[0].history.map(x=>x.sot_total),[8,9,10]);
 assert(p.rows[0].history.every(x=>x.score===null));
});
test('source state and HT HC alerts remain unchanged after read',()=>{
 const item=live();const src=bridge([item]),before=structuredClone(src.read());
 readExistingFTWatch(src,now);
 assert.deepEqual(src.read(),before);
 assert.deepEqual(item.h1History,[{some:'HT'}]);
 assert.deepEqual(item.hcHistory,[{some:'HC'}]);
 assert.equal(item.alerts['device:h1'].armed,true);
});
test('reading bridge calls only read exactly once',()=>{
 let count=0;const b={read(){count++;return {watchState:{items:[live()]}}}};
 readExistingFTWatch(b,now);assert.equal(count,1);
});
test('no bridge connected gives empty state without fake fixtures',()=>{
 const p=readExistingFTWatch(null,now);assert.equal(p.rows.length,0);assert.equal(p.reason,'FT_BRIDGE_NOT_CONNECTED');
});
test('bridge throws safely without synthetic fallback',()=>{
 const p=readExistingFTWatch({read(){throw Error('app unavailable')}},now);
 assert.equal(p.rows.length,0);assert.equal(p.reason,'FT_BRIDGE_READ_FAILED');
});
test('HT-only bridge cannot masquerade as FT input',()=>{
 const p=readExistingFTWatch({read(){return {h1WatchState:{items:[live()]}}}},now);
 assert.equal(p.rows.length,0);assert.equal(p.reason,'FT_WATCH_ITEMS_UNAVAILABLE');
});
test('1H existing HT fixture cannot appear in FT LIVE list',()=>{
 const a=live();a.ui.snapshot.status='1H';a.ui.snapshot.minute=38;
 assert.equal(readExistingFTWatch(bridge([a]),now).rows.length,0);
});
test('finished FT game cannot appear as LIVE current',()=>{
 const a=live();a.ui.snapshot.status='FT';
 assert.equal(readExistingFTWatch(bridge([a]),now).rows.length,0);
});
test('future timestamp >5s rejected instead of becoming latest',()=>{
 const a=live(1555,now+6000);
 assert.equal(readExistingFTWatch(bridge([a]),now).rows.length,0);
});
test('fixture identity mismatch quarantined',()=>{
 const a=live();a.ui.fixture.fixture.id=1999;
 assert.equal(readExistingFTWatch(bridge([a]),now).rows.length,0);
});
test('missing home or away score quarantined, no score invented',()=>{
 const a=live();a.ui.snapshot.goals.away=null;
 assert.equal(readExistingFTWatch(bridge([a]),now).rows.length,0);
});
test('older than ten minutes excluded',()=>{
 assert.equal(readExistingFTWatch(bridge([live(1555,now-650000)]),now).rows.length,0);
});
test('snapshot 4min old remains visible but flagged STALE',()=>{
 const a=live(1555,now-240000);
 const p=readExistingFTWatch(bridge([a]),now);
 assert.equal(p.rows[0].freshness,'STALE');
 assert(renderFTScreen(p).includes('DỮ LIỆU CŨ'));
});
test('duplicate fixture chooses latest valid snapshot independent of input order',()=>{
 const old=live(1555,at-50000,69),newest=live(1555,at,71);
 for(const items of [[old,newest],[newest,old]]){
  const p=readExistingFTWatch(bridge(items),now);
  assert.equal(p.rows.length,1);assert.equal(p.rows[0].minute,71);
 }
});
test('history excludes future later than source timestamp',()=>{
 const a=live();a.history.push({captured_at:at+15000,minute:72,stats_presence:{sot:true},metrics:{total:{sot:99}}});
 const p=readExistingFTWatch(bridge([a]),now);
 assert.deepEqual(p.rows[0].history.map(x=>x.sot_total),[8,9,10]);
});
test('missing SOT presence is missing, never zero',()=>{
 const a=live();a.history[0].stats_presence.sot=false;
 const p=readExistingFTWatch(bridge([a]),now);
 assert.equal(p.rows[0].history[0].sot_total,null);
});
test('live FT list shows verified match metadata but no pricing or TOP',()=>{
 const p=readExistingFTWatch(bridge([live()]),now),html=renderFTScreen(p);
 assert(html.includes('FC Seoul'));assert(html.includes('K League 1'));
 assert(html.includes('CHỜ MODEL'));
 assert(!html.includes('TOP 1'));assert(!html.includes('EV DEMO'));
 assert(!html.includes('2.10'));
});
test('live real-stat chart has a recorded SOT trend, not Poisson distribution',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 const html=renderFTScreen(p,{selectedId:1555,tab:'chart'});
 assert(html.includes('Sút trúng đích theo thời gian'));
 assert(html.includes('Sút trúng đích lũy kế'));
 assert(html.includes('Đang chờ xác suất tổng bàn FT'));
 assert(!html.includes('Diễn biến điểm tín hiệu FT'));
});
test('real detail shows single legacy score but never interprets it as betting probability',()=>{
 const p=readExistingFTWatch(bridge([live()]),now);
 const html=renderFTScreen(p,{selectedId:1555,tab:'summary'});
 assert(html.includes('81/100'));
 assert(html.includes('không phải xác suất Tài/Xỉu'));
 assert(html.includes('CHỜ MÔ HÌNH FT'));
});
console.log('FE_FT_V2_EXISTING_BRIDGE_PASS '+JSON.stringify({tests,source:'EXISTING_FT_WATCH',syntheticFixturesUsedForTesting:1,provider_calls:0,db_writes:0,ht_hc_changed:false,trade_recommendations:0,deploy:false}));
