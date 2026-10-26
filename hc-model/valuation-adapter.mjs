// Reads existing detached bridges only. No new provider request or legacy mutation.
import {readHCResearch} from './adapter.mjs';
import {reviewHCQuote} from './valuation.mjs';
export function readHCPricing(legacyBridge,bundleBridge,{now,verifiedRules=[],fixtureIds=null}={}){
 const state=legacyBridge?.read?.()||{},bundles=bundleBridge?.read?.()||[];
 // The production list bridge strips cooldown/reset fields. Read the existing
 // controls bridge instead; never assume a missing list field means no cooldown.
 let controls=[],controlsFailed=false;try{controls=bundleBridge?.readControls?.()||[];}catch{controlsFailed=true;}
 const byControl=new Map();for(const c of controls){const id=Number(c.id),old=byControl.get(id)||{cooldownUntil:0,resetAt:0};byControl.set(id,{cooldownUntil:Math.max(old.cooldownUntil,Number(c.cooldownUntil)||0),resetAt:Math.max(old.resetAt,Number(c.resetAt)||0)});}
 const pool=state.handicapWatchState?.pool||[],selected=Array.isArray(fixtureIds)?fixtureIds.slice(0,5).map(id=>pool.find(x=>Number(x.id)===Number(id))).filter(Boolean):pool;
 const filtered={...state,handicapWatchState:{...state.handicapWatchState,pool:selected}};
 const models=readHCResearch({read:()=>filtered},{read:()=>bundles}),items=new Map(selected.map(x=>[Number(x.id),x]));
 return models.map(row=>{const item=items.get(row.id),market=item?.latest?.market,pairs=market?.quotes?.length?market.quotes:market?[market]:[],control=byControl.get(row.id)||{};
  const valuations=pairs.slice(0,50).map(q=>{const quote={...q,fixtureId:row.id,mode:q.sourceId?.startsWith('pre:')?'PRE':'LIVE'},cooldownUntil=Math.max(control.cooldownUntil||0,item.cooldownUntil||0),resetAt=Math.max(control.resetAt||0,item.resetAt||0);
   const result=controlsFailed||resetAt>quote.quoteAt?{status:'DATA_WAIT',reason:controlsFailed?'Không đọc được trạng thái khóa HC hiện có':'Báo giá có trước thời điểm HC yêu cầu lập mốc lại',experimental:true,tradeReady:false,recommendation:null,prices:null,scenarios:null}:reviewHCQuote({model:row.model,quote,now,verifiedRules,cooldownUntil});
   return {sourceId:quote.sourceId,line:quote.line,quote,result};});
  return {...row,context:{minute:item?.latest?.minute,status:item?.latest?.status,score:structuredClone(item?.latest?.goals||{}),red:item?.latest?.stats_presence?.red===true?item?.latest?.metrics?.total?.red:null,resetAt:Math.max(control.resetAt||0,item.resetAt||0)},valuations};
 });
}
