import {readFileSync} from 'node:fs';
export function patchHCContracts(input){
 if(input.includes('HC_EXACT_QUOTE_CONTRACT_V1'))throw Error('HC_PATCH_ALREADY_APPLIED');
 const operations=[];let html=input;
 function replace(before,after){if(html.split(before).length!==2)throw Error('HC_PATCH_ANCHOR_DRIFT_'+before.slice(0,75));operations.push({before,after});html=html.replace(before,after);}
 const start=html.indexOf('  function hcMarketQuotes(rows){'),end=html.indexOf('  function hcMarketHistory(',start);
 if(start<0||end<0)throw Error('HC_MARKET_FUNCTIONS_MISSING');replace(html.slice(start,end),readFileSync(new URL('./runtime.js',import.meta.url),'utf8'));
 replace('market=hcMarketFromRows(rows,item.home,item.away),half=',"market=hcMarketFromRows(rows,item.home,item.away,{live:true,fixtureId:f.fixture.id,score:f.goals,at:Date.now(),marketAt:u.marketAt,minQuoteAt:item.resetAt||null}),half=");
 replace("market=hcMarketFromRows(n.market?.live||[],home,away),","market=hcMarketFromRows(n.market?.live||[],home,away,{live:true,fixtureId:id,score:meta.goals}),");
 replace('market=hcMarketFromRows(rows,home,away),captured=',"market=hcMarketFromRows(rows,home,away,{live:true,fixtureId:f.fixture.id,score:f.goals,at:Number(r.captured_at||Date.now()),marketAt:Number(r.captured_at||Date.now())}),captured=");
 replace('s.market=hcMarketFromRows(base.market_rows||[],item.home,item.away);',"s.market=hcMarketFromRows(base.market_rows||[],item.home,item.away,{live:true,fixtureId:row.fixture_id,score:f.goals,at,marketAt:base.market_at??at,minQuoteAt:item.resetAt||null});");
 replace('score:`${Number(f.goals?.home||0)}-${Number(f.goals?.away||0)}`,line:Number(market.line),',"score:`${Number(f.goals?.home||0)}-${Number(f.goals?.away||0)}`,sourceId:market.sourceId,marketId:market.marketId??null,period:market.period,basis:market.basis,quoteAt:market.quoteAt??null,line:Number(market.line),");
 replace('      line:Number(mkt.line),',"      sourceId:mkt.sourceId,marketId:mkt.marketId??null,period:mkt.period,basis:mkt.basis,quoteAt:mkt.quoteAt??null,\n      line:Number(mkt.line),");
 replace('const changed=!last||last.score!==snap.score||Number(last.line)!==snap.line||',"const changed=!last||last.sourceId!==snap.sourceId||last.marketId!==snap.marketId||last.basis!==snap.basis||last.score!==snap.score||Number(last.line)!==snap.line||");
 replace('.filter(x=>x.score===score&&now-Number(x.captured_at||0)<=20*60*1000)',".filter(x=>x.score===score&&x.sourceId===s.market?.sourceId&&x.marketId===(s.market?.marketId??null)&&x.period===s.market?.period&&x.basis===s.market?.basis&&now-Number(x.captured_at||0)<=20*60*1000)");
 replace('const hasH=Number.isFinite(h0)&&Number.isFinite(h1),hasA=Number.isFinite(a0)&&Number.isFinite(a1);',"const sameLine=Number(first.line)===Number(last.line);\n    const hasH=sameLine&&Number.isFinite(h0)&&Number.isFinite(h1),hasA=sameLine&&Number.isFinite(a0)&&Number.isFinite(a1);");
 replace("status:'HISTORY',text,sameScore:true,lineDir,priceDir,velocity,marketSide,","status:'HISTORY',text,sameScore:true,priceComparable:sameLine,lineDir,priceDir,velocity,marketSide,");
 let restored=html;for(const op of [...operations].reverse())restored=restored.replace(op.after,op.before);if(restored!==input)throw Error('HC_UNRELATED_SOURCE_MUTATION');
 return {html,operations:operations.length,restoredExactly:true};
}
