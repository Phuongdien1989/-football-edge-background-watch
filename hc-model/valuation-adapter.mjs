// Reads the existing bridges once. No new provider request or legacy mutation.
import {readHCResearch} from './adapter.mjs';
import {reviewHCQuote} from './valuation.mjs';
export function readHCPricing(legacyBridge,bundleBridge,{now,verifiedRules=[]}={}){
 const state=legacyBridge?.read?.()||{},bundles=bundleBridge?.read?.()||[];
 const models=readHCResearch({read:()=>state},{read:()=>bundles}),items=new Map((state.handicapWatchState?.pool||[]).map(x=>[Number(x.id),x]));
 return models.map(row=>{const item=items.get(row.id),market=item?.latest?.market,pairs=market?.quotes?.length?market.quotes:market?[market]:[];
  const valuations=pairs.slice(0,50).map(q=>{const quote={...q,fixtureId:row.id,mode:q.sourceId?.startsWith('pre:')?'PRE':'LIVE'};return {sourceId:quote.sourceId,line:quote.line,result:reviewHCQuote({model:row.model,quote,now,verifiedRules,cooldownUntil:item.cooldownUntil||0})};});
  return {...row,valuations};
 });
}
