import {POLICY,priceCandidates,legacyCandidates,planDelivery,mechanismPayload} from './core.mjs';
export async function deliverMechanisms(w,{device,fixture,snapshot,item,packet,legacySignals,now}) {
 const key='notify:mechanism:'+device.id+':'+fixture.fixture.id;
 const previous=await w.ctx.storage.get(key),candidates=[...priceCandidates(packet,device.prefs,fixture,snapshot),...legacyCandidates(legacySignals,snapshot.captured_at,snapshot)];
 const oldLast=Math.max(0,...Object.entries(item.alerts||{}).filter(([k])=>k.startsWith(device.id+':')).map(([,r])=>Number(r.lastSent)||0));
 const plan=planDelivery(previous,candidates,{now,observedAt:snapshot.captured_at,results:packet.results,legacyLastSent:oldLast});
 if(plan.changed)await w.ctx.storage.put(key,plan.state);
 if(!plan.send.length)return {schema:POLICY,state:'WAIT_OR_ALREADY_SENT',sent:false,referenceUntil:previous?.referenceUntil??null};
 // Reserve durably BEFORE transport. Unknown transport outcomes are held for
 // five minutes; exactly-once physical device delivery cannot be guaranteed.
 let accepted=false,error=null;
 try{accepted=await w.send(device,mechanismPayload(fixture,snapshot,plan.send,now));if(!accepted)error='SUBSCRIPTION_NOT_ACCEPTED';}
 catch(e){error=String(e?.message||e).slice(0,160);}
 plan.state.outcome=accepted?'PUSH_SERVICE_ACCEPTED':'TRANSPORT_UNCONFIRMED';plan.state.error=error;
 for(const c of plan.send)plan.state.records[c.kind].deliveryState=accepted?'ACCEPTED':'UNCONFIRMED';
 await w.ctx.storage.put(key,plan.state);
 if(accepted)for(const c of plan.send)if(c.type==='SIGNAL')item.alerts[device.id+':'+c.kind]={armed:false,lastSent:now};
 return {schema:POLICY,state:plan.state.outcome,sent:accepted,kinds:plan.send.map(c=>c.kind),error,referenceUntil:plan.state.referenceUntil};
}
