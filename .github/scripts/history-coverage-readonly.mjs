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

const qs={
 table_counts:"SELECT 'fixture_history' name,COUNT(*) n,MIN(fixture_id) min_id,MAX(fixture_id) max_id FROM fixture_history UNION ALL SELECT 'fixtures',COUNT(*),MIN(fixture_id),MAX(fixture_id) FROM fixtures UNION ALL SELECT 'live_snapshots',COUNT(*),MIN(fixture_id),MAX(fixture_id) FROM live_snapshots",
 history_statuses:"SELECT COALESCE(status,'NULL') status,COUNT(*) n,SUM(fulltime_home IS NOT NULL AND fulltime_away IS NOT NULL) ft_score,SUM(halftime_home IS NOT NULL AND halftime_away IS NOT NULL) ht_score FROM fixture_history GROUP BY status",
 joining:"SELECT e.engine,COUNT(*) n,SUM(f.fixture_id IS NOT NULL) history_id_match,SUM(f.status IS NOT NULL) history_status_known,SUM(b.fixture_id IS NOT NULL) fixtures_id_match FROM (SELECT DISTINCT fixture_id,engine FROM entry_decisions WHERE engine IN ('FT','H1')) e LEFT JOIN fixture_history f ON f.fixture_id=e.fixture_id LEFT JOIN fixtures b ON b.fixture_id=e.fixture_id GROUP BY e.engine",
 open_stored_final:"SELECT engine,resolution,COUNT(*) n,SUM(json_type(payload_json,'$.final_score.home') IN ('integer','real') AND json_type(payload_json,'$.final_score.away') IN ('integer','real')) final_score_in_entry_payload,COUNT(DISTINCT fixture_id) fixtures FROM entry_decisions WHERE engine IN ('FT','H1') GROUP BY engine,resolution",
 snapshots_terminal:"SELECT source,engine,status,COUNT(*) n,COUNT(DISTINCT fixture_id) fixtures FROM live_snapshots WHERE status IN ('FT','HT','AET','PEN') GROUP BY source,engine,status",
 resolved_fixture_detail:"SELECT e.engine,e.fixture_id,MIN(b.home) home,MIN(b.away) away,MIN(e.captured_at) first_at,MAX(e.captured_at) last_at,COUNT(*) n,MIN(e.line) min_line,MAX(e.line) max_line,MIN(e.price) min_price,MAX(e.price) max_price,MIN(json_extract(e.payload_json,'$.final_score.home')) final_home_min,MAX(json_extract(e.payload_json,'$.final_score.home')) final_home_max,MIN(json_extract(e.payload_json,'$.final_score.away')) final_away_min,MAX(json_extract(e.payload_json,'$.final_score.away')) final_away_max,ROUND(SUM(e.unit_pl),5) pl FROM entry_decisions e LEFT JOIN fixtures b ON b.fixture_id=e.fixture_id WHERE e.resolution='RESOLVED' AND e.engine IN ('FT','H1') GROUP BY e.engine,e.fixture_id",
 final_score_arithmetic:"SELECT engine,outcome,COUNT(*) n,SUM(unit_pl IS NULL) missing_pl,MIN(unit_pl) min_pl,MAX(unit_pl) max_pl FROM entry_decisions WHERE resolution='RESOLVED' GROUP BY engine,outcome",
 source_ids:"SELECT engine,COUNT(*) n,COUNT(DISTINCT json_extract(payload_json,'$.signature')) signatures,SUM(json_extract(payload_json,'$.id') IS NOT id) id_mismatch,SUM(json_extract(payload_json,'$.auto_settle_supported')=1) auto_settle_supported FROM entry_decisions GROUP BY engine"
};
const results={};for(const [k,sql] of Object.entries(qs))results[k]=await query(sql);
const report={at:new Date().toISOString(),mode:'READ_ONLY',productionWrites:0,providerCalls:0,results};writeFileSync('football-edge-history-coverage.json',JSON.stringify(report,null,2));console.log('FE_HISTORY_COVERAGE '+JSON.stringify(report));
