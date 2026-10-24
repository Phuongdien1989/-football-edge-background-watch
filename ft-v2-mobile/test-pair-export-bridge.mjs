import assert from 'node:assert/strict';
import {buildFTObservation} from '../ft-audit-fix/observation.mjs';
import {buildFTDecision} from '../ft-audit-fix/decision-trace.mjs';
import {prepareFTPair} from '../ft-audit-fix/ft-pair-collector.mjs';
import {inspectFTPairExport} from './pair-export-bridge.mjs';
import {renderFTScreen} from './ui.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const now=Date.UTC(2026,9,23,8);
let tests=0;
const check=async(name,fn)=>{await fn();tests++;console.log('PASS '+name)};
async function makePair(id=3301,minute=73,age=20000,opts={}){
 const at=now-age,sourceAt=at-3000;
 const fixture={
  fixture:{id,status:{short:'2H',elapsed:minute}},
  league:{name:'Verified FT Export',country:'QA'},
  teams:{home:{name:'Alpha'},away:{name:'Beta'}},
  goals:{home:1,away:1},score:{fulltime:null}
 };
 const vals=[{value:'Over',handicap:2.75,odd:1.95,main:true},
  {value:'Under',handicap:2.75,odd:1.93,main:true}];
 const source={fixture:{status:'OK',received_at:sourceAt,source_at:null,data:fixture},
  odds:opts.noOdds?undefined:{status:'OK',received_at:at-5000,source_at:null,
    data:[{fixture:{id},odds:[{id:5,name:'Over/Under',values:structuredClone(vals)}]}]}};
 const o=buildFTObservation({id:id+':'+minute+':'+at,fixture_id:id,decision_at:at,fixture,sources:source});
 const d=buildFTDecision({observation:o,decision_at:at+1000,state:'EVALUATED',
  evaluation:{score:72,scoreMode:'FULL'},source_hash:'a'.repeat(64),
  market_rows:opts.noOdds?null:[{
   source:'live',fixture_id:id,category:'over_under',
   bet:'Over/Under',feed_bet_name:'Over/Under',bet_id:5,
   bet_reference:{canonical_name:'Over/Under'},integrity:{valid:true},
   feed_status:{},values:opts.tamperPrice?
    [{...vals[0],odd:1.25},vals[1]]:structuredClone(vals)
  }]
 });
 return prepareFTPair(o,d,20000);
}
await check('hash-verified live export displays exact fixture and raw matched odds',async()=>{
 const p=await makePair(),r=await inspectFTPairExport([p],{now});
 assert.equal(r.packet.rows.length,1);
 assert.equal(r.packet.rows[0].id,3301);
 assert.equal(r.packet.rows[0].quote.line,2.75);
 assert.equal(r.packet.rows[0].quote.over_odds,1.95);
 assert.equal(r.packet.rows[0].quote.executable,false);
 assert.equal(r.audit.hash_verified,1);assert.equal(r.audit.quotes_displayed,1);
});
await check('raw match does not authorize bet: still no executable book, EV or TOP',async()=>{
 const r=await inspectFTPairExport([await makePair()],{now});
 assert.equal(r.releaseGate,'BLOCKED_UNCALIBRATED_AND_UNATTESTED');
 assert.equal(r.packet.rows[0].model.pmf,null);
 assert.equal(r.packet.rows[0].recommendation.ev,null);
 assert.equal(r.packet.rows[0].recommendation.rank,null);
 assert.equal(r.packet.prices_verified,false);
 assert.equal(r.packet.rows[0].quote.bookmaker_id,null);
});
await check('a tampered hash rejects entire observation/decision pair',async()=>{
 const p=await makePair();p.content_hash='f'.repeat(64);
 const r=await inspectFTPairExport([p],{now});
 assert.equal(r.packet.rows.length,0);
 assert.equal(r.audit.invalid_or_duplicate,1);
 assert.match(r.audit.issues[0].reason,/HASH_OR_ID_MISMATCH/);
});
await check('tampered price behind valid pair hash gets blocked by independent raw parity',async()=>{
 const r=await inspectFTPairExport([await makePair(3302,73,20000,{tamperPrice:true})],{now});
 assert.equal(r.packet.rows.length,1);assert.equal(r.packet.rows[0].quote,null);
 assert.equal(r.audit.quotes_not_matched,1);
});
await check('missing original source cannot become market quote',async()=>{
 const r=await inspectFTPairExport([await makePair(3303,73,20000,{noOdds:true})],{now});
 assert.equal(r.packet.rows.length,1);assert.equal(r.packet.rows[0].quote,null);
});
await check('quote older than 60 sec excluded even when snapshot is within 10 min',async()=>{
 const r=await inspectFTPairExport([await makePair(3304,72,90000)],{now});
 assert.equal(r.packet.rows.length,1);assert.equal(r.packet.rows[0].quote,null);
 assert.equal(r.audit.quotes_raw_matched,1);
 assert.equal(r.audit.quotes_too_old_for_live,1);
 assert.equal(r.packet.rows[0].integrity.reason,'RAW_MATCHED_ODDS_TOO_OLD_FOR_VIEW');
 assert.equal(r.packet.rows[0].freshness,'STALE');
});
await check('archive older than default ten minutes is not LIVE',async()=>{
 const r=await inspectFTPairExport([await makePair(3305,66,650000)],{now});
 assert.equal(r.packet.rows.length,0);
 assert.equal(r.audit.older_than_live_window,1);
 assert.equal(r.status,'NO_RECENT_PAIR_EVIDENCE');
});
await check('future timestamp is excluded even if hash is valid',async()=>{
 const r=await inspectFTPairExport([await makePair(3306,66,-60000)],{now});
 assert.equal(r.packet.rows.length,0);assert.equal(r.audit.future_or_bad_clock,1);
});
await check('duplicate immutable pair observation key not counted twice',async()=>{
 const p=await makePair();
 const r=await inspectFTPairExport([p,p],{now});
 assert.equal(r.packet.rows.length,1);
 assert.equal(r.audit.invalid_or_duplicate,1);
});
await check('many different matches are displayed, never combined by line',async()=>{
 const r=await inspectFTPairExport([await makePair(10),await makePair(11),await makePair(12)],{now});
 assert.equal(r.packet.rows.length,3);
 assert.equal(new Set(r.packet.rows.map(x=>x.id)).size,3);
});
await check('same fixture latest snapshot is selected, but each pair is audited',async()=>{
 const old=await makePair(2200,65,45000),newest=await makePair(2200,73,20000);
 for(const a of [[old,newest],[newest,old]]){
  const r=await inspectFTPairExport(a,{now});
  assert.equal(r.packet.rows.length,1);
  assert.equal(r.packet.rows[0].minute,73);
  assert.equal(r.packet.rows[0].history.length,2);
  assert.equal(r.audit.hash_verified,2);
 }
});
await check('view-only HTML has market O/U numbers but never independent AI price',async()=>{
 const r=await inspectFTPairExport([await makePair()],{now});
 const h=renderFTScreen(r.packet,{selectedId:3301,tab:'pricing'});
 assert(h.includes('1.95 / 1.93'));
 assert(h.includes('Chưa hiệu chỉnh'));
 assert(!h.includes('EV DEMO'));
});
await check('limits reject oversized input before hash computation',async()=>{
 const p=await makePair();const rows=Array.from({length:251},()=>p);
 await assert.rejects(()=>inspectFTPairExport(rows,{now}),/INVALID_OR_UNBOUNDED_PAIR_EXPORT/);
});
await check('invalid observation JSON is quarantined, never crashes whole audit',async()=>{
 const p=await makePair();p.observation_json='not-json';
 const r=await inspectFTPairExport([p],{now});
 assert.equal(r.audit.invalid_or_duplicate,1);
 assert.equal(r.packet.rows.length,0);
});
await check('no pair export returns explicit empty not fake demo',async()=>{
 const r=await inspectFTPairExport([],{now});
 assert.equal(r.packet.rows.length,0);
 assert.equal(r.packet.mode,'LIVE');
 assert.equal(r.packet.source_attestation,'EXPORT_ORIGIN_NOT_VERIFIED');
});
await check('bad reader configuration fails before processing any rows',async()=>{
 await assert.rejects(()=>inspectFTPairExport([],{now,maxQuoteAgeMs:700000}),/INVALID_FT_EXPORT_READ_CONFIG/);
});
await check('offline CLI accepts valid local export and retains provenance limitations',async()=>{
 const rows=[await makePair(7711)];
 mkdirSync('ft-audit-output/ft-v2-pair-export',{recursive:true});
 const file='ft-audit-output/ft-v2-pair-export/input.json';
 const report='ft-audit-output/ft-v2-pair-export/report.json';
 // The CLI uses the actual wall clock, so snapshots may be past or future.
 writeFileSync(file,JSON.stringify({pair_rows:rows}));
 execFileSync(process.execPath,['ft-v2-mobile/inspect-export.mjs',file,report]);
 const result=JSON.parse(readFileSync(report,'utf8'));
 assert.equal(result.audit.hash_verified,1);
 assert.equal(result.ingestion_source,'OPERATOR_SUPPLIED_LOCAL_FILE_NOT_CLOUDFLARE_AUTHENTICATED');
 assert.equal(result.source_attestation,'UNVERIFIED_REMOTE_EXPORT_ORIGIN');
 assert(result.packet.rows.every(x=>x.recommendation.ev===null&&x.model.pmf===null));
 assert.equal(result.d1_writes,0);assert.equal(result.production_deploy,false);
});
await check('offline CLI rejects unknown input format without creating false report',async()=>{
 const bad='ft-audit-output/ft-v2-pair-export/bad.json';
 writeFileSync(bad,JSON.stringify({watchState:{items:[]}}));
 assert.throws(()=>execFileSync(process.execPath,
  ['ft-v2-mobile/inspect-export.mjs',bad,'ft-audit-output/ft-v2-pair-export/invalid-report.json'],
  {stdio:'pipe'}));
});
console.log('FE_FT_V2_PAIR_EXPORT_PASS '+JSON.stringify({tests,real_provider_data_used:false,hash_verified_test_cases:true,
 calibrated_probability:false,trade_recommendations:0,provider_calls:0,d1_queries:0,d1_writes:0,production_deploy:false}));
