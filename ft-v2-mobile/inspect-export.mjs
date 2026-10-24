// CLI: node ft-v2-mobile/inspect-export.mjs input.json output.json
// Read exported D1 PAIR rows from a supplied local JSON file. Offline only;
// NO Cloudflare token, API-Football, internet, D1 or production interaction.
import {readFileSync,writeFileSync,statSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {inspectFTPairExport} from './pair-export-bridge.mjs';
const [sourcePath,destinationPath,...extras]=process.argv.slice(2);
if(extras.length||!sourcePath||!destinationPath||resolve(sourcePath)===resolve(destinationPath))
 throw Error('INPUT_OUTPUT_TWO_DISTINCT_LOCAL_PATHS_REQUIRED');
if(statSync(sourcePath).size>25_000_000)throw Error('FT_PAIR_EXPORT_FILE_EXCEEDS_SIZE_LIMIT');
const payload=JSON.parse(readFileSync(sourcePath,'utf8'));
if(!payload||!Array.isArray(payload.pair_rows))throw Error('FT_PAIR_ROWS_ARRAY_REQUIRED');
const now=Date.now();
const result=await inspectFTPairExport(payload.pair_rows,{now});
const output={
 schema:'FT_V2_READ_ONLY_PAIR_EXPORT_REPORT_3N',
 examined_at:new Date(now).toISOString(),
 ingestion_source:'OPERATOR_SUPPLIED_LOCAL_FILE_NOT_CLOUDFLARE_AUTHENTICATED',
 source_attestation:'UNVERIFIED_REMOTE_EXPORT_ORIGIN',
 ...result,provider_calls:0,d1_queries:0,d1_writes:0,
 scanner_actions:0,ht_hc_changes:0,production_deploy:false,
 warning:'Snapshot odds are historical evidence only. Bookmaker/settlement and model pricing not validated.'
};
mkdirSync(dirname(resolve(destinationPath)),{recursive:true});
writeFileSync(destinationPath,JSON.stringify(output,null,2),'utf8');
console.log('FE_FT_LOCAL_EXPORT_INSPECT '+JSON.stringify({
 status:result.status,submitted:result.audit.total,valid_hashes:result.audit.hash_verified,
 invalid:result.audit.invalid_or_duplicate,recent_fixtures:result.audit.live_fixtures,
 raw_matched_quotes:result.audit.quotes_raw_matched,displayed_quotes:result.audit.quotes_displayed,
 real_ev:false,deploy:false,d1_writes:0
}));
