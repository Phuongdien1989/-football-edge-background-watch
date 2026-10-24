// Offline only: verify each immutable D1 OUTCOME ledger row's exact canonical
// hash + record identity before it can provide training labels.
// This does not attest the provider truthfulness; it prevents altered exports.
import {prepareRecord} from './replay-ledger.mjs';
export async function verifyFTOutcomeExport(rows,{maxRecordBytes=20000}={}){
 if(!Array.isArray(rows))throw Error('OUTCOME_EXPORT_ARRAY_REQUIRED');
 const outcomes=[],issues=[],seen=new Set();
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  try{
   if(row?.kind!=='OUTCOME'||typeof row.payload_json!=='string')throw Error('INVALID_OUTCOME_EXPORT_SHAPE');
   const obj=JSON.parse(row.payload_json);
   const expected=await prepareRecord('OUTCOME',obj,maxRecordBytes);
   for(const k of ['record_id','kind','observation_id','fixture_id','recorded_at','content_hash']){
    if(row[k]!==expected[k])throw Error('OUTCOME_EXPORT_HASH_OR_ID_MISMATCH');
   }
   if(seen.has(row.record_id))throw Error('DUPLICATE_OUTCOME_RECORD_ID');
   seen.add(row.record_id);
   outcomes.push(obj);
  }catch(e){issues.push({index:i,reason:String(e.message||e).slice(0,100)});}
 }
 return {status:issues.length?'SOME_OUTCOME_ROWS_QUARANTINED':'ALL_OUTCOME_ROWS_HASH_VERIFIED',
  verified_outcomes:outcomes,issues,verified_rows:outcomes.length,
  claimed_provider_authenticity:false};
}
