import {reserveNotifyAttempt,notifyBudgetLimit} from './shared-api-budget.mjs';
import {ftReplaySqlRemaining} from './replay-sql-budget.mjs';
// Explicit trial entrypoint, never called by alarm/notifyTick automatically.
import {recordFTOutcome} from './decision-trace.mjs';
export const OUTCOME_BUDGET_KEY='ft:outcome:api-budget:v1';
const positive=x=>Number.isSafeInteger(x)&&x>0;
export async function runFTOutcomePass(owner,observations,{clock=Date.now}={}){
 if(owner.env?.FT_REPLAY_PAIR_TRIAL_ENABLED==='true'&&source!=='PAIR_DISCOVERY_VALIDATED')return {status:'PAIR_DISCOVERY_REQUIRED',api_calls:0};
 if(owner.env?.FT_OUTCOME_TRIAL_ENABLED!=='true'||owner.env?.FT_REPLAY_TRIAL_ENABLED!=='true')return {status:'DISABLED',api_calls:0};
 if(typeof owner.scanControl!=='function'||(await owner.scanControl())?.enabled!==true)return {status:'SCANNER_OFF',api_calls:0};
 const config=Object.fromEntries(['MAX_OBSERVATIONS','MAX_FIXTURES','MAX_WRITES','RETRY_MS','MAX_ATTEMPTS'].map(k=>[k,Number(owner.env['FT_OUTCOME_TRIAL_'+k])]));
 if(!Object.values(config).every(positive)||!Array.isArray(observations)||observations.length>config.MAX_OBSERVATIONS||typeof owner.ctx?.storage?.transaction!=='function')return {status:'INVALID_CONFIG',api_calls:0};
 const groups=new Map(),seen=new Map();
 for(const observation of observations){
  if(observation?.schema!=='FT_OBSERVATION_V1_DRAFT'||typeof observation.id!=='string'||!observation.id||!positive(observation.fixture_id)||!positive(observation.decision_at)||observation.fixture?.fixture?.id!==observation.fixture_id)return {status:'INVALID_OBSERVATION',api_calls:0};
  const old=seen.get(observation.id);
  if(old){if(JSON.stringify(old)!==JSON.stringify(observation))return {status:'CONFLICTING_OBSERVATION',api_calls:0};continue;}
  seen.set(observation.id,observation);
  if(!groups.has(observation.fixture_id))groups.set(observation.fixture_id,[]);
  groups.get(observation.fixture_id).push(structuredClone(observation));
 }
 const report={status:'COMPLETE_PASS',api_calls:0,write_attempts:0,results:[],deferred_fixtures:0};
 // Fair selection/discovery is the caller's responsibility; explicit bounded pass only.
 let visited=0;
 for(const [id,items]of groups){
  if(visited>=config.MAX_FIXTURES||report.write_attempts>=config.MAX_WRITES){report.deferred_fixtures++;continue;}
  visited++;
  // Need room for one outcome reservation plus immutable insert/read (4 SQL calls).
  // Avoid wasting provider API quota when this invocation cannot store any result.
  if(ftReplaySqlRemaining(owner)<4){report.status='SQL_LIMIT_DEFERRED';report.results.push({fixture_id:id,status:'SQL_LIMIT_DEFERRED'});return report;}
  const now=clock();
  if(!positive(now)||items.some(x=>x.decision_at>now)){report.results.push({fixture_id:id,status:'INVALID_CLOCK'});continue;}
  let reserved;
  try{
   reserved=await owner.ctx.storage.transaction(async tx=>{
    const key='ft:outcome:fixture:'+id,previous=await tx.get(key);
    if(previous&&(!positive(previous.next_at)||!positive(previous.attempts)))return 'INVALID_RETRY_STATE';
    if(previous&&(previous.next_at>now||previous.attempts>=config.MAX_ATTEMPTS))return 'NOT_DUE';
    const budget=await tx.get(OUTCOME_BUDGET_KEY);
    if(!budget||!positive(budget.start)||!positive(budget.end)||!positive(budget.max_calls)||!Number.isSafeInteger(budget.used)||budget.used<0||now<budget.start||now>=budget.end||budget.used>=budget.max_calls||budget.last_at>now)return 'API_BUDGET_DENIED';
    const shared=await reserveNotifyAttempt(tx,now,notifyBudgetLimit(owner.env));
    if(shared.status!=='RESERVED')return shared.status;
    await tx.put(OUTCOME_BUDGET_KEY,{...budget,used:budget.used+1,last_at:now});
    await tx.put(key,{attempts:(previous?.attempts||0)+1,next_at:now+config.RETRY_MS,reserved_at:now});
    return 'RESERVED';
   });
  }catch{reserved='RESERVATION_FAILED';}
  if(reserved!=='RESERVED'){report.results.push({fixture_id:id,status:reserved});continue;}
  report.api_calls++;
  let rows;
  try{rows=await owner.api('/fixtures',{id},true);}catch{report.results.push({fixture_id:id,status:'FETCH_ERROR'});continue;}
  const receivedAt=clock();
  if(!Array.isArray(rows)||rows.length!==1||rows[0]?.fixture?.id!==id){report.results.push({fixture_id:id,status:'RESULT_UNCONFIRMED'});continue;}
  for(const observation of items){
   if(report.write_attempts>=config.MAX_WRITES){report.results.push({observation_id:observation.id,status:'DEFERRED_WRITE'});continue;}
   // This counts attempts to resolve/persist, not successful writes or billed rows.
   report.write_attempts++;
   const result=await recordFTOutcome(owner,observation,rows[0],receivedAt,receivedAt);
   report.results.push({observation_id:observation.id,fixture_id:id,...result});
   if(result.status==='SQL_LIMIT_DEFERRED'){report.status='SQL_LIMIT_DEFERRED';return report;}
   if(['BUDGET_DENIED','BUDGET_UNAVAILABLE','PAUSED','RECORD_FAILED','PAUSE_READ_FAILED'].includes(result.status)){
    report.status='STORAGE_BLOCKED';return report;
   }
  }
 }
 return report;
}
