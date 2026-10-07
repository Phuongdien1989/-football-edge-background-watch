import {eligible} from './fixture-selector-runtime.js';
export const LIMIT=40,RESERVE=20,SELECTION_CAP=20,TICK_COST=5;
export async function runEligiblePilot({approved,budget,remoteMutate,provider,sha256,collector,oldNew,persistAck,exportEvidence,now=()=>new Date().toISOString(),maxAgeMs=15000}){
 if(!approved)throw Error('REMOTE_PILOT_APPROVAL_REQUIRED');const initial=await budget.load();if(initial?.stop_reason)throw Error('DURABLE_STOP_ACTIVE');if((initial?.total_requests||0)>=LIMIT)throw Error('DURABLE_BUDGET_EXHAUSTED');await remoteMutate();
 let used=Number(initial?.total_requests||0),selectionUsed=0;const attempt=async(req,{selection=false}={})=>{if(used>=LIMIT)throw Error('TOTAL_BUDGET_EXHAUSTED');if(selection&&selectionUsed>=SELECTION_CAP)throw Error('SELECTION_RESERVE_GUARD');const r=await provider(req);used++;if(selection)selectionUsed++;await budget.save({...await budget.load(),total_requests:used});return r};
 const status=await attempt({endpoint:'/status'},{selection:true}),disc=await attempt({endpoint:'/fixtures'},{selection:true});let chosen=null;
 for(const fixture of disc.payload.response||[]){if(selectionUsed+3>SELECTION_CAP)break;const fid=fixture.fixture.id,stats=await attempt({endpoint:'/fixtures/statistics',fixture_id:fid},{selection:true}),events=await attempt({endpoint:'/fixtures/events',fixture_id:fid},{selection:true}),market=await attempt({endpoint:'/odds/live',fixture_id:fid},{selection:true}),e=await eligible({fixture,stats,events,market,cutoff:now(),maxAgeMs,sha256});if(e.football_eligible){chosen={fixture,e};break}}
 if(!chosen)return await exportEvidence({status:'NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET',used,selectionUsed});
 if(LIMIT-used<RESERVE)throw Error('RESERVE_VIOLATION');
 const ticks=[];for(let i=0;i<4;i++){if(LIMIT-used<TICK_COST)break;const raw=[];for(const endpoint of ['/status','/fixtures','/fixtures/statistics','/fixtures/events','/odds/live'])raw.push(await attempt({endpoint,fixture_id:chosen.fixture.fixture.id}));const observation=await collector({fixture:chosen.fixture,raw,match_phase:chosen.e.match_phase});const outputs=await oldNew({observation,raw});const ack=await persistAck({observation,outputs,raw});ticks.push({observation,outputs,ack})}
 return await exportEvidence({status:'COMPLETED_SCOPE',fixture_id:chosen.fixture.fixture.id,eligibility:chosen.e,used,selectionUsed,ticks,status_probe:status});
}
