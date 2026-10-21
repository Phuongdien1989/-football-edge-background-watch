import {htTeamModel} from './model.mjs';
import {snapshotForHT,htMarketLadder} from './valuation-adapter.mjs';
import {assessHT} from './valuation.mjs';
export function assessHTItem(item,context,now=Date.now(),{line=null}={}) {
 context=item.htContext??context;
 const input=snapshotForHT(item),fixture=item.latest?.fixture;
 const model=htTeamModel(input,fixture,context);
 const markets=htMarketLadder(item).filter(m=>line===null||m.line===line);
 const rows=(markets.length?markets:[null]).map(m=>assessHT({...input,model,market:m},now,{trialRecommendations:true}));
 rows.sort((a,b)=>(b.quote?.ev??-Infinity)-(a.quote?.ev??-Infinity));
 return {...rows[0],model,sample:model?.sample??null,contextError:context?.error??null,ladder:rows.filter(r=>r.marketOK).map(r=>({line:r.recommendation.line,odds:r.recommendation.odds,quote:r.quote,action:r.action}))};
}

