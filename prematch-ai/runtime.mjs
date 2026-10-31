import {classifyEvaluations} from './market-lines.mjs';
import {safeInput,adaptDeep,marketKey} from './contracts.mjs';
import {predict} from './model.mjs';
import {predictRecent} from './recent-fallback.mjs';
import {evaluate,rankFixtures,noVigPairs} from './pricing.mjs';
import {explain,modulesFor,investmentStatus} from './narrative.mjs';
export async function analyze(raw,{now=Date.now()}={}){
 const input=safeInput(raw.schema?raw:adaptDeep(raw));const rows=[];
 for(const f of input.fixtures){const artifacts=input.artifacts.filter(a=>a.leagueId===f.league.id&&a.cutoff<=f.observedAt).sort((a,b)=>b.cutoff-a.cutoff||String(a.hash).localeCompare(String(b.hash)));let r=await predict(f,artifacts[0],{now});if(!r.forecast&&!artifacts.length){const context=(raw.contexts||[]).find(c=>c.fixtureId===f.id);if(context)r=await predictRecent(f,context,{now})||r;}r.evaluations=[];for(const q of input.quotes.filter(q=>q.fixtureId===f.id))r.evaluations.push(await evaluate(r.forecast,q,{now}));r.marketChoices=classifyEvaluations(r.evaluations);rows.push(r);}
 const marketBenchmarks=noVigPairs(input.quotes);const ranked=rankFixtures(rows);for(const r of ranked.rows){const e=r.top||r.candidate||r.evaluations.filter(e=>e.price).sort((a,b)=>b.price.ev-a.price.ev)[0];const benchmark=e?marketBenchmarks.find(b=>b.contracts.includes(marketKey(e.quote))&&b.receivedAt===e.quote.receivedAt&&b.sourceUpdatedAt===(e.quote.sourceUpdatedAt??null)):null;r.marketBenchmarks=marketBenchmarks.filter(b=>b.fixtureId===r.fixture.id);r.marketComparison=e?{benchmark,breakeven:['1X2'].includes(e.quote.type)||e.quote.type==='OU'&&Math.abs(e.quote.line%1-.5)<1e-8?1/e.quote.odds:null,modelProbability:e.price?.profitProbability??null,marketProbability:benchmark?.probabilities[e.quote.selection]??null}:null;r.status=investmentStatus(r,now);r.narrative=explain(r);r.modules=modulesFor(r,input.evidence);}
 return {schema:'FE_PREMATCH_ANALYSIS_V1',at:now,label:input.label,rows:ranked.rows,top:ranked.top.map(r=>({fixtureId:r.fixture.id,rank:r.rank,role:r.role,evaluationId:(r.top||r.candidate).id})),marketBenchmarks,providerRequests:0,productionWrites:0};
}
