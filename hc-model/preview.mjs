// Synthetic demonstration. No connection to production or provider services.
import {modelHC,differenceSummary} from './core.mjs';
import {reviewHCQuote} from './valuation.mjs';
import {mountHCResearch} from './view.mjs';
const at=Date.now(),rows=Array.from({length:8},(_,i)=>({fixture_id:900+i,date:new Date(at-(i+1)*86400000).toISOString(),status:'FT',home_id:1,away_id:2,goals:{home:2,away:1}}));
const {model}=modelHC({fixtureId:100,homeId:1,awayId:2,homeRecent:rows,awayRecent:rows,kickoff:at-55*60000,at,minute:55,status:'2H',goals:{home:0,away:1}});
const quote={fixtureId:100,sourceQuote:true,sourceId:'live:book:DEMO',marketId:33,mode:'LIVE',period:'FT',quoteAt:at,observedScore:{home:0,away:1},line:-.25,homeOdd:2.1,awayOdd:1.8};
mountHCResearch(document.getElementById('preview'),[{id:100,home:'Home United',away:'Away City',league:'Demo League · trận minh họa',at,model,summary:differenceSummary(model),legacy:{gap:26},valuations:[{sourceId:quote.sourceId,line:quote.line,result:reviewHCQuote({model,quote,now:at})}]}],{now:at});
