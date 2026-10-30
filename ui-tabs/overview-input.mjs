// Read-only Overview projection through the EXISTING HT assessment/session code.
// No new pricing policy, acquisition, storage, scanner or mutation of the live book.
import {assessHTItem} from '../ht-early-candidate/assess-item.mjs';
import {createHTSessionBook} from '../ht-early-candidate/recommendation-session.mjs';
export function overviewHTInputs(win,packet,now=Date.now()){
 try{
  const ids=new Set((packet.top||[]).slice(0,5).map(x=>x.id));
  if(!ids.size||!win.FEHTCandidateBridge?.read||!win.FEHTPricingView?.sessions)return [];
  const data=win.FEHTCandidateBridge.read(),items=(data.items||[]).filter(x=>ids.has(x.id)).slice(0,5);
  const projection=createHTSessionBook({saved:win.FEHTPricingView.sessions()});
  return items.map(item=>{const old=projection.read(item.id),line=old&&!old.closedAt&&now<old.expiresAt?old.original.line:null;
   const row=assessHTItem(item,data.context,now,{line});return {...row,session:projection.update(item,row,now)};
  });
 }catch{return [];}
}
