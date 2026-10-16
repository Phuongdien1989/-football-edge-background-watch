// Read-only D1 schema/index parity and aggregated write-churn inventory.
// Does not export raw rows, fixture/team/device ids, or sensitive payloads.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('CLOUDFLARE_CREDENTIALS_MISSING');
const prod='0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4',stage='7d503048-9118-4b29-b662-4e1ba6e32167';
async function query(db,sql,params=[]){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database/'+db+'/query',{
 method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(30000)});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.success||!j.result?.[0]?.success)throw Error('D1_READ_'+r.status+'_CODES_'+(j.errors||[]).map(x=>x.code).join(','));
 return j.result[0].results||[];
}
const target=['fixtures','entry_decisions','entry_outcomes','teams','fixture_history','team_fixture_history'];
const indexes={};const report={mode:'READ_ONLY',production_changes:0,source:'actual Cloudflare D1',production_db:prod,staging_db:stage,counts:{},schema:{}};
for(const [key,id] of [['production',prod],['staging',stage]]){
 const ix=await query(id,"SELECT tbl_name,name,sql FROM sqlite_master WHERE type='index' AND tbl_name IN ('fixtures','entry_decisions','entry_outcomes','teams','fixture_history','team_fixture_history') ORDER BY tbl_name,name");
 indexes[key]=ix.map(x=>({table:x.tbl_name,index:x.name,sql:x.sql||'AUTO_PK'}));
 const tbl=await query(id,"SELECT name,sql FROM sqlite_master WHERE type='table' AND name IN ('fixtures','entry_decisions','entry_outcomes','teams','fixture_history','team_fixture_history') ORDER BY name");
 report.schema[key]={tables:tbl.map(x=>x.name),indexes:indexes[key]};
}
const normalize=a=>a.map(x=>JSON.stringify(x)).sort();
report.schema.exact_index_parity=JSON.stringify(normalize(indexes.production))===JSON.stringify(normalize(indexes.staging));
const from=Date.parse('2026-10-15T00:00:00Z'),to=Date.parse('2026-10-16T00:00:00Z');
const statements={
 entries:"SELECT COUNT(*) AS unique_rows, SUM(CASE WHEN updated_at>=? AND updated_at<? THEN 1 ELSE 0 END) AS unique_touched_oct15, SUM(CASE WHEN resolved_at IS NOT NULL THEN 1 ELSE 0 END) AS resolved_rows, SUM(CASE WHEN score_home=0 AND score_away=0 THEN 1 ELSE 0 END) AS zero_score_rows FROM entry_decisions",
 outcomes:"SELECT COUNT(*) AS unique_rows, SUM(CASE WHEN updated_at>=? AND updated_at<? THEN 1 ELSE 0 END) AS unique_touched_oct15 FROM entry_outcomes",
 fixtures:"SELECT COUNT(*) AS unique_rows, SUM(CASE WHEN last_seen_at>=? AND last_seen_at<? THEN 1 ELSE 0 END) AS unique_touched_oct15 FROM fixtures",
 history:"SELECT COUNT(*) AS unique_rows, SUM(CASE WHEN last_seen_at>=? AND last_seen_at<? THEN 1 ELSE 0 END) AS unique_touched_oct15 FROM fixture_history"
};
for(const [name,sql] of Object.entries(statements)){
 try{const rows=await query(prod,sql,[from,to]);report.counts[name]=rows[0]||null;}
 catch(e){report.counts[name]={error:String(e.message||e).slice(0,160)};}
}
console.log('FE_D1_SYNC_INDEX_AND_CHURN '+JSON.stringify(report));
