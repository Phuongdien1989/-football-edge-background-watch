// Trial-session collector only; not imported into the deployable Worker.
import {buildFTObservation} from './observation.mjs';
import {appendRecord,prepareRecord} from './replay-ledger.mjs';
export function createTrialCollector(db,{enabled=false,maxAttempts,maxRecordBytes,maxSessionBytes}={}){
 if(enabled&&![maxAttempts,maxRecordBytes,maxSessionBytes].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('EXPLICIT_TRIAL_LIMITS_REQUIRED');
 let attempts=0,reservedBytes=0,sqlAttempts=0,insertAttempts=0,tail=Promise.resolve();
 const counted={prepare(sql){const statement=db.prepare(sql);return {bind(...args){const bound=statement.bind(...args);return {
 async first(){sqlAttempts++;return bound.first();},
 async run(){sqlAttempts++;insertAttempts++;return bound.run();}
 };}};}};
 function capture(input){
  if(!enabled)return Promise.resolve({status:'DISABLED'});
  // Freeze at call time: caller mutations while queued must not alter evidence.
  let observation;
  try{observation=buildFTObservation(input);}catch{return Promise.resolve({status:'INVALID_INPUT'});}
  const task=tail.then(async()=>{
   if(attempts>=maxAttempts)return {status:'SESSION_LIMIT'};
   let record;
   try{record=await prepareRecord('OBSERVATION',observation,maxRecordBytes);}catch{return {status:'INVALID_RECORD'};}
   if(record.bytes>maxSessionBytes-reservedBytes)return {status:'SESSION_BYTES_LIMIT'};
   // Reserve before I/O; errors and duplicates consume budget conservatively.
   attempts++;reservedBytes+=record.bytes;
   try{return await appendRecord(counted,'OBSERVATION',observation,{enabled:true,maxBytes:maxRecordBytes});}
   catch{return {status:'RECORD_FAILED'};}
  });
  tail=task.catch(()=>{});
  return task;
 }
 return {capture,metrics:()=>({attempts,reservedBytes,sqlAttempts,insertAttempts,budget_scope:'IN_MEMORY_TRIAL_SESSION'})};
}
