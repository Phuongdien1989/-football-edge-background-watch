import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const a=process.env.CLOUDFLARE_ACCOUNT_ID,t=process.env.CLOUDFLARE_API_TOKEN,db='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4';
if(!a||!t)throw Error('Cloudflare credentials unavailable');
let reads=0;async function query(sql){if(!/^SELECT\b/.test(sql))throw Error('Only SELECT permitted');const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(a)+'/d1/database/'+db+'/query',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(45000)});const j=await r.json(),x=j.result?.[0];if(!r.ok||!j.success||!x?.success)throw Error('D1 read failed HTTP '+r.status);if(Number(x.meta?.rows_written||0))throw Error('Unexpected write');reads+=Number(x.meta?.rows_read||0);return x.results}
const isnum=x=>typeof x==='number'&&Number.isFinite(x);
function settle(total,line,selection,price){
 assert.ok([total,line,price].every(isnum)&&price>1&&line>=0&&['OVER','UNDER'].includes(selection));
 assert.ok(Math.abs(line*4-Math.round(line*4))<1e-8);
 const legs=Number.isInteger(line*2)?[line]:[Math.floor(line*2)/2,Math.ceil(line*2)/2];
 const returns=legs.map(l=>{const d=selection==='OVER'?total-l:l-total;return d>0?price-1:d<0?-1:0});
 const pl=returns.reduce((a,b)=>a+b,0)/returns.length;
 const outcome=returns.every(x=>x>0)?'WIN':returns.every(x=>x<0)?'LOSE':returns.every(x=>x===0)?'PUSH':pl>0?'HALF_WIN':'HALF_LOSE';return {pl,outcome};
}
assert.deepEqual(settle(3,2.75,'OVER',2),{pl:0.5,outcome:'HALF_WIN'});
assert.deepEqual(settle(2,2.25,'OVER',2),{pl:-0.5,outcome:'HALF_LOSE'});
assert.deepEqual(settle(2,2,'OVER',1.9),{pl:0,outcome:'PUSH'});
assert.deepEqual(settle(0,0.5,'UNDER',2),{pl:1,outcome:'WIN'});

const rows=await query("SELECT l.id,l.fixture_id,l.source,l.engine,l.status,l.captured_at,l.minute,l.score_home,l.score_away,json_extract(l.payload_json,'$.fixture.fixture.id') raw_fixture_id,json_extract(l.payload_json,'$.fixture.fixture.status.short') raw_status,json_extract(l.payload_json,'$.fixture.score.halftime.home') halftime_home,json_extract(l.payload_json,'$.fixture.score.halftime.away') halftime_away,json_extract(l.payload_json,'$.fixture.score.fulltime.home') fulltime_home,json_extract(l.payload_json,'$.fixture.score.fulltime.away') fulltime_away,json_extract(l.payload_json,'$.fixture.goals.home') raw_goals_home,json_extract(l.payload_json,'$.fixture.goals.away') raw_goals_away FROM live_snapshots l WHERE l.source IN ('BACKGROUND','EVIDENCE_FOLLOWUP') AND l.status IN ('HT','2H','FT') AND EXISTS (SELECT 1 FROM entry_decisions e WHERE e.fixture_id=l.fixture_id AND e.engine IN ('FT','H1')) ORDER BY l.fixture_id,l.captured_at");
writeFileSync('football-edge-terminal-source-rows.json',JSON.stringify(rows,null,2));
const summary={at:new Date().toISOString(),mode:'READ_ONLY',productionWrites:0,providerCalls:0,rows_read:reads,records:rows.length,fixtures:new Set(rows.map(r=>r.fixture_id)).size,normal_ft_fixtures:new Set(rows.filter(r=>r.status==='FT').map(r=>r.fixture_id)).size,ht_score_fixtures:new Set(rows.filter(r=>isnum(r.halftime_home)&&isnum(r.halftime_away)).map(r=>r.fixture_id)).size};writeFileSync('football-edge-terminal-source-summary.json',JSON.stringify(summary,null,2));console.log('FE_TERMINAL_SOURCE '+JSON.stringify(summary));
