// Candidate recorder-trial ONLY. Counts executed replay SQL statements per Worker invocation.
// Hard cap is deliberately BELOW the documented D1 Free 50-query invocation limit.
// It is NOT a total D1 budget: inherited backend queries and billed rows are unmeasured.
const states=new WeakMap();
export const FT_REPLAY_SQL_HARD_CAP=24;
function getState(owner){
 let s=states.get(owner);
 if(!s){beginFTReplaySqlInvocation(owner);s=states.get(owner);}
 return s;
}
export function beginFTReplaySqlInvocation(owner){
 if(!owner || typeof owner!=='object')throw Error('INVALID_REPLAY_OWNER');
 const requested=Number(owner.env?.FT_REPLAY_TRIAL_SQL_BUDGET_PER_INVOCATION);
 const limit=Number.isSafeInteger(requested)&&requested>=1?Math.min(requested,FT_REPLAY_SQL_HARD_CAP):FT_REPLAY_SQL_HARD_CAP;
 states.set(owner,{db:owner.env?.FT_REPLAY_DB,limit,used:0});
 return {limit,scope:'REPLAY_SIDE_CAR_ONLY'};
}
export function ftReplaySqlRemaining(owner){
 const s=getState(owner);return Math.max(0,s.limit-s.used);
}
export function ftReplayQueryDB(owner){
 const s=getState(owner);
 if(!s.db || typeof s.db.prepare!=='function')throw Error('REPLAY_DB_MISSING');
 return {prepare(sql){
   const stmt=s.db.prepare(sql);
   return {bind(...args){
     const bound=stmt.bind(...args);
     const result={};
     for(const method of ['first','all','run']){
       if(typeof bound[method]==='function')result[method]=async (...more)=>{
         if(s.used>=s.limit){const e=Error('FT_REPLAY_INVOCATION_SQL_LIMIT');e.code='FT_REPLAY_INVOCATION_SQL_LIMIT';throw e;}
         // Count attempted executions, including failed requests. Never refund.
         s.used++;
         return bound[method](...more);
       };
     }
     return result;
   }};
 }};
}
