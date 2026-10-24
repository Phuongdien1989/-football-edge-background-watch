// Trial-only shared reservation for v130 scan + FT result-fetch attempts in one watcher DO.
export const NOTIFY_BUDGET_KEY='notify:budget';
export function notifyBudgetLimit(env){return Number(env?.NOTIFY_DAILY_BUDGET)||5000;}
export async function reserveNotifyAttempt(tx,now,limit){
 if(!Number.isSafeInteger(now)||now<=0||!Number.isSafeInteger(limit)||limit<=0)return {status:'INVALID_SHARED_BUDGET'};
 const day=new Date(now).toISOString().slice(0,10),old=await tx.get(NOTIFY_BUDGET_KEY);
 if(old&&(!Number.isSafeInteger(old.used)||old.used<0||typeof old.day!=='string'||old.day>day))return {status:'INVALID_SHARED_BUDGET'};
 const used=old?.day===day?old.used:0;
 if(used>=limit)return {status:'NOTIFY_DAILY_BUDGET_REACHED'};
 const budget={day,used:used+1};
 await tx.put(NOTIFY_BUDGET_KEY,budget);
 return {status:'RESERVED',budget};
}
export async function reserveScanAttempt(owner,now=Date.now()){
 if(typeof owner.ctx?.storage?.transaction!=='function')throw Error('SHARED_BUDGET_TRANSACTION_REQUIRED');
 const r=await owner.ctx.storage.transaction(tx=>reserveNotifyAttempt(tx,now,notifyBudgetLimit(owner.env)));
 if(r.status!=='RESERVED')throw Error(r.status);
 return r.budget;
}
