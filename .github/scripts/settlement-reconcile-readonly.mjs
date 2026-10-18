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
const data=[];
for(const engine of ['FT','H1']){
 const rows=await query(`SELECT e.id,e.fixture_id,e.engine,e.policy_status,e.captured_at,e.minute,e.score_home,e.score_away,e.market_type,e.selection,e.line,e.price,e.odds_format,e.resolution,e.outcome,e.unit_pl,e.resolved_at,json_extract(e.payload_json,'$.signature') signature,json_extract(e.payload_json,'$.auto_settle_supported') auto_settle_supported,f.status history_status,f.kickoff,f.halftime_home,f.halftime_away,f.fulltime_home,f.fulltime_away,f.last_seen_at history_seen,json_type(f.payload_json,'$.halftime_home') raw_ht_home_type,json_type(f.payload_json,'$.halftime_away') raw_ht_away_type,json_type(f.payload_json,'$.fulltime_home') raw_ft_home_type,json_type(f.payload_json,'$.fulltime_away') raw_ft_away_type FROM entry_decisions e LEFT JOIN fixture_history f ON f.fixture_id=e.fixture_id WHERE e.engine='${engine}' ORDER BY e.captured_at,e.id`);
 for(const row of rows){
  const r={...row,reconcile:'UNVERIFIABLE',reason:null};data.push(r);
  if(!r.history_status){r.reason='NO_FIXTURE_HISTORY';continue}
  const isFT=engine==='FT',ended=isFT?r.history_status==='FT':['HT','2H','FT'].includes(r.history_status);
  if(!ended){r.reason='HISTORY_PERIOD_NOT_CONFIRMED_COMPLETE';continue}
  const h=isFT?r.fulltime_home:r.halftime_home,w=isFT?r.fulltime_away:r.halftime_away;
  const ht=isFT?r.raw_ft_home_type:r.raw_ht_home_type,wt=isFT?r.raw_ft_away_type:r.raw_ht_away_type;
  if(![h,w].every(x=>isnum(x)&&Number.isInteger(x)&&x>=0)||![ht,wt].every(x=>['integer','real'].includes(x))){r.reason='PERIOD_SCORE_MISSING_OR_RAW_NULL';continue}
  if(!isnum(r.line)||r.line<0||Math.abs(r.line*4-Math.round(r.line*4))>1e-8||!isnum(r.price)||r.price<=1||r.odds_format!=='DEC'||!['OVER','UNDER'].includes(r.selection)||r.market_type!==(isFT?'OU_FT':'OU_H1')){r.reason='UNSUPPORTED_MARKET_OR_PRICE';continue}
  if(![r.score_home,r.score_away].every(x=>isnum(x)&&x>=0)||h+w<r.score_home+r.score_away){r.reason='ENTRY_FINAL_SCORE_CONFLICT';continue}
  const result=settle(h+w,r.line,r.selection,r.price);r.reconcile='PAPER_FROM_STORED_FINAL';r.reason=null;r.recomputed_outcome=result.outcome;r.recomputed_unit_pl=result.pl;r.final_total=h+w;
  r.stored_mismatch=r.resolution==='RESOLVED'&&(r.outcome!==result.outcome||!isnum(r.unit_pl)||Math.abs(r.unit_pl-result.pl)>1e-7);
 }
}
function stats(rows){const settled=rows.filter(r=>r.reconcile==='PAPER_FROM_STORED_FINAL'),pl=settled.reduce((a,b)=>a+b.recomputed_unit_pl,0);return {records:rows.length,fixtures:new Set(rows.map(r=>r.fixture_id)).size,stored_resolved:rows.filter(r=>r.resolution==='RESOLVED').length,stored_open:rows.filter(r=>r.resolution==='OPEN').length,reconciled:settled.length,reconciled_fixtures:new Set(settled.map(r=>r.fixture_id)).size,newly_computable_open:settled.filter(r=>r.resolution==='OPEN').length,positive:settled.filter(r=>r.recomputed_unit_pl>0).length,negative:settled.filter(r=>r.recomputed_unit_pl<0).length,push:settled.filter(r=>r.recomputed_unit_pl===0).length,paper_unit_pl:Math.round(pl*1e6)/1e6,paper_roi_pct:settled.length?Math.round(pl/settled.length*1e5)/1000:null,stored_mismatches:settled.filter(r=>r.stored_mismatch).length,unverifiable_reasons:Object.fromEntries([...new Set(rows.filter(r=>r.reason).map(r=>r.reason))].map(reason=>[reason,rows.filter(r=>r.reason===reason).length]))}}
const summaries={};
for(const engine of ['FT','H1']){
 const all=data.filter(r=>r.engine===engine),first=new Map(),terms=new Map(),groups=new Map();
 for(const r of all){if(!first.has(r.fixture_id))first.set(r.fixture_id,r);const key=JSON.stringify([r.fixture_id,r.engine,r.policy_status,r.market_type,r.selection,r.line,r.price,r.minute,r.score_home,r.score_away]);if(!terms.has(key))terms.set(key,r);(groups.get(r.fixture_id)||groups.set(r.fixture_id,[]).get(r.fixture_id)).push(r)}
 summaries[engine]={all_snapshots:stats(all),first_snapshot_per_fixture:stats([...first.values()]),same_terms_minute_score_collapsed:stats([...terms.values()]),repeated_observation_count:all.length-terms.size,first_by_policy:Object.fromEntries([...new Set([...first.values()].map(r=>r.policy_status))].map(p=>[p,stats([...first.values()].filter(r=>r.policy_status===p))])),most_repeated: [...groups.entries()].map(([id,rows])=>({fixture_id:id,records:rows.length,first_at:rows[0].captured_at,last_at:rows.at(-1).captured_at,history_status:rows[0].history_status})).sort((a,b)=>b.records-a.records).slice(0,5)};
}
const report={at:new Date().toISOString(),mode:'READ_ONLY_OFFLINE_RECONCILIATION',productionWrites:0,providerCalls:0,rows_read:reads,arithmeticTests:'PASS',summaries,limits:['Stored D1 fixture history is not independently rechecked with provider.','Paper results assume line applies to whole H1/FT period, matching current frontend. Original bookmaker executable line and remaining-goals settlement basis were not recorded.','First fixture snapshot is a predeclared diagnostic, not a proven betting strategy. All snapshots are correlated and cannot be counted as independent bets.','No OPEN row or historical outcome was changed. Missing or conflicting final scores are excluded, not assigned losses.']};
writeFileSync('football-edge-reconciliation-summary.json',JSON.stringify(report,null,2));
writeFileSync('football-edge-reconciliation-rows.json',JSON.stringify(data,null,2));console.log('FE_RECONCILIATION_SUMMARY '+JSON.stringify(report));
