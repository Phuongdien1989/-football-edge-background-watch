import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {htTeamModel} from './model.mjs';
import {readHTContext} from './context.mjs';
import {assessHTItem} from './assess-item.mjs';
const now=Date.now(),day=86400000;
const fixture={fixture:{id:1,timestamp:Math.floor((now-12*60000)/1000)},teams:{home:{id:10},away:{id:20}}};
const s={id:1,at:now,minute:12,status:'1H',goals:{home:0,away:0}};
const context={at:now-1,rows:Array.from({length:8},(_,i)=>({fixture_id:100+i,kickoff:Math.floor((now-(i+1)*day)/1000),status:'FT',home_team_id:i%2?20:10,away_team_id:30,halftime_home:i%3,halftime_away:i%2}))};
let tests=0;
async function check(name,run){await run();tests++;console.log('PASS '+name);}
await check('real half-time scores create normalized independent HT predictive PMF before20',()=>{
 const m=htTeamModel(s,fixture,context);assert(m);assert.equal(m.sample.home,4);assert.equal(m.sample.away,4);assert.equal(m.sample.unique,8);
 assert(Math.abs(m.pmf.reduce((a,b)=>a+b,0)-1)<1e-8);assert.equal(m.period,'H1_REMAINING');assert.equal(m.independent,true);assert.equal(m.validated,false);
});
await check('market odds and legacy score cannot influence the forecast',()=>{
 const a=htTeamModel(s,fixture,context),b=htTeamModel({...s,legacyScore:99,market:{line:2,odd:9}},fixture,context);assert.deepEqual(a,b);
});
await check('zero HT goals are observed zeros, not missing values',()=>{
 const c={...context,rows:context.rows.map(r=>({...r,halftime_home:0,halftime_away:0}))};assert(htTeamModel(s,fixture,c));assert(htTeamModel(s,fixture,c).lambda>0);
});
await check('missing HT is not filled from FT or a fixed FT fraction',()=>{
 const c={...context,rows:context.rows.map(r=>({...r,halftime_home:null,halftime_away:null,score_home:4,score_away:3}))};assert.equal(htTeamModel(s,fixture,c),null);
});
await check('historical sample ends before target kickoff and excludes the target',()=>{
 const added=[{...context.rows[0],fixture_id:1},{...context.rows[0],fixture_id:999,kickoff:fixture.fixture.timestamp+1}];
 const m=htTeamModel(s,fixture,{...context,rows:[...context.rows,...added]});assert.equal(m.sample.unique,8);assert(!m.provenance.fixtureIds.includes(1));assert(!m.provenance.fixtureIds.includes(999));
});
await check('context received in the future cannot leak into an old observation',()=>assert.equal(htTeamModel(s,fixture,{...context,at:now+1}),null));
await check('shared historical fixture counted once; conflicting scores excluded',()=>{
 const c={...context,rows:[...context.rows,context.rows[0]]};assert.equal(htTeamModel(s,fixture,c).sample.unique,8);
 c.rows.push({...context.rows[0],halftime_home:9});assert.equal(htTeamModel(s,fixture,c).sample.unique,7);
});
await check('at most eight actual observations per team, with honest sample counts',()=>{
 const c={at:now-1,rows:Array.from({length:40},(_,i)=>({...context.rows[i%8],fixture_id:500+i,home_team_id:i%2?10:20,kickoff:Math.floor((now-(i+1)*day)/1000)}))};const m=htTeamModel(s,fixture,c);assert.equal(m.sample.home,8);assert.equal(m.sample.away,8);assert.equal(m.sample.unique,16);
});
await check('no model at minute0 or nominal45 when remaining stoppage time is unknown',()=>{
 assert.equal(htTeamModel({...s,minute:0},fixture,context),null);assert.equal(htTeamModel({...s,minute:45},fixture,context),null);
});
await check('live goals update the rate and are included once in contract settlement',()=>{
 const item={id:1,latest:{fixture,fresh_at:now,minute:12,status:'1H',goals:{home:0,away:1},metrics:{total:{shots:3,sot:1}},stats_presence:{shots:true,sot:true},market_at:now,market_rows:[{category:'h1_total',bookmaker:'TEST',values:[{value:'Over',handicap:1.5,odd:2}]}]}};
 const r=assessHTItem(item,context,now);assert(r.quote);assert.equal(r.recommendation.line,1.5);assert(Math.abs(r.quote.win-(1-r.model.pmf[0]))<1e-8);
 assert.equal(r.model.provenance.alpha,.5+context.rows.reduce((n,x)=>n+x.halftime_home+x.halftime_away,0)+1);
});
await check('one read per hour cache, no writes or provider calls',async()=>{
 let reads=0;const db={prepare(sql){assert(sql.endsWith('ORDER BY kickoff DESC LIMIT 500'));assert(!sql.includes('UPDATE'));return {async all(){reads++;return {success:true,results:context.rows,meta:{rows_read:8}}}}}};
 const c=await readHTContext(db,now);await readHTContext(db,c.at+1000,c);assert.equal(reads,1);assert.equal(c.rowsRead,8);
 await readHTContext(db,c.at+3600001,c);assert.equal(reads,2);
});
await check('database errors preserve old engine operation with model-wait context',async()=>{
 const c=await readHTContext({prepare(){throw Error('DB_UNAVAILABLE')}},now);assert.equal(c.rows.length,0);assert.equal(c.error,'DB_UNAVAILABLE');
 const r=assessHTItem({id:1,latest:{fresh_at:now,minute:12,status:'1H',goals:{home:0,away:0}}},c,now);assert.equal(r.quote,null);
});
mkdirSync('ht-early-candidate/generated',{recursive:true});
writeFileSync('ht-early-candidate/generated/model-test-report.json',JSON.stringify({status:'PASS',tests,production_deployed:false,model_validated:false,real_provider_calls:0,real_db_writes:0},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',tests}));
