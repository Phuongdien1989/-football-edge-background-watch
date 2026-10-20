import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {readHTContext} from '../../ht-early-candidate/context.mjs';
import {htTeamModel} from '../../ht-early-candidate/model.mjs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
assert(account&&token,'CONFIGURED_CLOUDFLARE_AUTH_REQUIRED');
const expected="SELECT fixture_id,kickoff,status,home_team_id,away_team_id,halftime_home,halftime_away FROM fixture_history ORDER BY kickoff DESC LIMIT 500";
const db={prepare(sql){assert.equal(sql,expected,'READ_ONLY_SQL_MISMATCH');return {async all(){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/d1/database/0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params:[]}),signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok||!j.success)throw Error('D1_READ_HTTP_'+r.status+'_'+(j.errors||[]).map(e=>e.code).join('_'));
 return j.result[0];
}}}};
const context=await readHTContext(db),valid=context.rows.filter(r=>r.status==='FT'&&Number.isInteger(r.halftime_home)&&Number.isInteger(r.halftime_away)&&r.halftime_home>=0&&r.halftime_away>=0);
const now=Date.now();let diagnostic=null;
if(valid.length){const r=valid[0],id=900000001;diagnostic=htTeamModel({id,at:now,minute:12,status:'1H',goals:{home:0,away:0}},{fixture:{id,timestamp:Math.floor((now-12*60000)/1000)},teams:{home:{id:r.home_team_id},away:{id:r.away_team_id}}},context);}
const report={status:context.error?'FAIL':'PASS',mode:'READ_ONLY_REAL_HT_CONTEXT',at:context.at,rows_returned:context.rows.length,rows_read:context.rowsRead??null,usable_ft_halftime_rows:valid.length,diagnostic_target:'SYNTHETIC_TARGET_REAL_HISTORY_NOT_A_LIVE_PICK',diagnostic_model_built:!!diagnostic,diagnostic_sample:diagnostic?.sample??null,error:context.error??null,d1_write_queries:0,provider_calls:0,scanner_toggled:false,production_deployed:false,prediction_accuracy_validated:false};
mkdirSync('audits/2026-10-21',{recursive:true});writeFileSync('audits/2026-10-21/ht-real-context-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
if(context.error)process.exitCode=1;
