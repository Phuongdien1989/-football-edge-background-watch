import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {number,settlement,priceOver,noVig,createStore,researchBaseline,assess} from './core.mjs';
import {readLegacy,marketFromRows} from './adapter.mjs';
import {demoSnapshots} from './demo.mjs';
import {trendChart} from './charts.mjs';
let tests=0;const test=(name,fn)=>{fn();tests++;console.log('PASS '+name);};
const now=Date.UTC(2026,9,19,10,0),sample=()=>demoSnapshots(now)[0];
test('Missing data and booleans never become numeric zero',()=>{for(const v of [null,undefined,'',false,true])assert.equal(number(v),null);assert.equal(number(0),0);});
test('Quarter/whole/half settlement matches split stakes',()=>{
  assert.equal(settlement(2,2.25),-.5);assert.equal(settlement(3,2.75),.5);assert.equal(settlement(2,2),0);assert.equal(settlement(3,2.5),1);assert.equal(settlement(2,2.5),-1);
});
test('Full score counted once and EV/fair odds consistent',()=>{
  const p=priceOver([.2,.35,.30,.15],1,2.5,2.40);assert.ok(Math.abs(p.win-.45)<1e-9);assert.ok(Math.abs(p.ev-.08)<1e-9);assert.ok(Math.abs(p.fairOdds-1/.45)<1e-9);
  const q=priceOver([.2,.35,.30,.15],1,2.25,2.40);assert.ok(Math.abs(q.halfLose-.35)<1e-9);assert.ok(Math.abs(q.ev-(.45*1.4-.35/2-.2))<1e-9);
});
test('Invalid or incomplete distribution and invalid line rejected',()=>{assert.equal(priceOver([.2,.2],1,2.5,2),null);assert.equal(priceOver([1],1,2.3,2),null);assert.equal(priceOver([1],1,2.5,null),null);});
test('No-vig only compares matched binary full-time contracts',()=>{const s=sample();assert.ok(noVig(s.market));assert.equal(noVig({...s.market,line:2.25}),null);assert.equal(noVig({...s.market,under:null}),null);assert.equal(noVig({...s.market,basis:'REMAINING'}),null);});
test('Replay after lost ACK does not create duplicate ledger or chart point',()=>{const s=sample(),st=createStore();assert.equal(st.ingest(s).accepted,true);st.read(now);assert.equal(st.ingest(s).reason,'DUPLICATE');for(let i=0;i<20;i++)st.read(now);assert.equal(st.export().ledger.length,1);assert.equal(st.read(now)[0].points.length,1);});
test('Out-of-order and same-revision conflicts preserve newest data',()=>{const st=createStore(),s=sample();st.ingest(s);assert.equal(st.ingest({...s,at:now-1}).reason,'OUT_OF_ORDER');assert.equal(st.ingest({...s,goals:{home:0,away:0}}).reason,'REVISION_CONFLICT');assert.equal(st.read(now)[0].snapshot.goals.home,1);});
test('Freshness expires without another server update',()=>{const st=createStore();st.ingest(sample());assert.equal(st.read(now+61000)[0].entry,'STALE');assert.equal(st.read(now+61000)[0].rank,null);});
test('Stats errors and post-goal stale price cannot issue recommendation',()=>{let s=sample();s.statsError=true;assert.equal(assess(s,now).entry,'DATA WAIT');s=sample();s.eventAt=now+1;assert.equal(assess(s,now).entry,'WAIT PRICE');s=sample();s.market.score={home:0,away:0};assert.equal(assess(s,now).marketFresh,false);});
test('Demo and research are explicitly gated from live recommendations',()=>{let s=sample();assert.equal(assess(s,now).entry,'DEMO');assert.equal(assess(s,now).recommendation.action,'NO_LIVE_RECOMMENDATION');s.model.kind='RESEARCH';assert.equal(assess(s,now).entry,'RESEARCH');});
test('Agreement or model above market is not automatically a good entry price',()=>{const s=demoSnapshots(now)[2],r=assess(s,now);assert.ok(r.delta>0);assert.ok(r.quote.ev<0);assert.ok(r.synthesis.includes('chưa cho lợi thế'));});
test('Independent model cannot be substituted with legacy score or wrong observation',()=>{const s=sample();s.model=null;s.legacy={score:99};assert.equal(assess(s,now).modelOK,false);s.model=sample().model;s.model.at--;assert.equal(assess(s,now).modelOK,false);});
test('Missing historical goals, future and duplicate matches not learned as evidence',()=>{
  const r={date:'2026-10-10T10:00:00Z',status:'FT',home_id:1,away_id:2,goals:{home:2,away:1}};
  const input={homeId:1,awayId:2,homeRecent:[r,r,{...r,date:'2026-10-21T10:00:00Z'},{...r,date:'2026-10-09T10:00:00Z',goals:{home:null,away:1}}],awayRecent:[r],kickoff:now-3600000,at:now,minute:60,status:'2H'};
  const m=researchBaseline(input);assert.deepEqual(m.sample,{home:1,away:1});assert.equal(m.validated,false);assert.equal(researchBaseline({...input,status:'ET'}),null);assert.equal(researchBaseline({...input,homeRecent:[]}),null);
});
test('Goal resets football delta context; no false momentum across score change',()=>{const s=sample();s.history=[{at:now-300000,goals:{home:0,away:0},metrics:{sot:0}}];assert.equal(assess(s,now).data.label,'BASELINE');});
test('Restart restores ledger/state and a replay remains idempotent',()=>{const a=createStore();a.ingest(sample());a.read(now);const b=createStore();assert.equal(b.restore(a.export()),true);assert.equal(b.ingest(sample()).reason,'DUPLICATE');b.read(now);assert.equal(b.export().ledger.length,1);});
test('Top fixtures unique and stable on identical repeated inputs',()=>{const st=createStore();demoSnapshots(now).forEach(s=>st.ingest(s));const a=st.read(now).map(x=>x.id);assert.deepEqual(st.read(now).map(x=>x.id),a);assert.equal(new Set(a).size,5);assert.equal(st.export().ledger.length,5);});
test('Contract changes interrupt graph instead of drawing false continuity',()=>{const points=[{at:1,minute:30,key:'A',model:.4,market:.3},{at:2,minute:31,key:'B',model:.6,market:.5}];const chart=trendChart(points,'B');assert.ok(!chart.includes('NaN'));assert.equal((chart.match(/<circle/g)||[]).length,2);});
test('Adapter reads detached bridge without fetching or mutation',()=>{
  const fixture={id:5,home:'A',away:'B',latest:{captured_at:now,minute:32,status:'1H',goals:{home:0,away:0},metrics:{total:{shots:10,sot:4,inbox:7,xg:1}},stats_presence:{shots:true,sot:true,inbox:true,xg:true}},eval:{score:76,scoreMode:'FULL'},history:[]};
  const packet={h1WatchState:{items:[fixture]},watchState:{items:[]},handicapWatchState:{pool:[]}},before=JSON.stringify(packet);
  const rows=readLegacy({read:()=>structuredClone(packet)});assert.equal(rows.length,1);assert.equal(rows[0].model,null);assert.equal(rows[0].legacy.independent,false);assert.equal(JSON.stringify(packet),before);
});
test('Adapter does not mix half-time market with full-time totals',()=>{const s=sample();const m=marketFromRows([{category:'h1_total',values:[{value:'Over 2.5',odd:2},{value:'Under 2.5',odd:2}]}],s);assert.equal(m,null);});
test('Module integration cannot write legacy store or send notifications',()=>{
  for(const p of ['core.mjs','adapter.mjs','charts.mjs','ui.mjs']){
    const src=readFileSync(new URL(p,import.meta.url),'utf8');assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|localStorage\.setItem|\.request\s*\(|\.send\s*\(|\.toggleManual\s*\(/.test(src),p);
  }
});
console.log(JSON.stringify({status:'PASS',tests,network_calls:0,production_mutations:0}));
