import {safeInput,adaptDeep} from './contracts.mjs';
import {predict} from './model.mjs';
import {predictRecent} from './recent-fallback.mjs';
import {evaluate,rankFixtures,noVigPairs} from './pricing.mjs';
import {explain,modulesFor,investmentStatus} from './narrative.mjs';
export async function analyze(raw,{now=Date.now()}={}){
 const input=safeInput(raw.schema?raw:adaptDeep(raw));const rows=[];
 for(const f of input.fixtures){const artifacts=input.artifacts.filter(a=>a.leagueId===f.league.id&&a.cutoff<=f.observedAt).sort((a,b)=>b.cutoff-a.cutoff||String(a.hash).localeCompare(String(b.hash)));let r=await predict(f,artifacts[0],{now});if(!r.forecast&&!artifacts.length){const context=(raw.contexts||[]).find(c=>c.fixtureId===f.id);if(context)r=await predictRecent(f,context,{now})||r;}r.evaluations=[];for(const q of input.quotes.filter(q=>q.fixtureId===f.id))r.evaluations.push(await evaluate(r.forecast,q,{now}));rows.push(r);}
 const ranked=rankFixtures(rows);for(const r of ranked.rows){r.status=investmentStatus(r,now);r.narrative=explain(r);r.modules=modulesFor(r,input.evidence);}
 return {schema:'FE_PREMATCH_ANALYSIS_V1',at:now,label:input.label,rows:ranked.rows,top:ranked.top.map(r=>({fixtureId:r.fixture.id,rank:r.rank,role:r.role,evaluationId:(r.top||r.candidate).id})),marketBenchmarks:noVigPairs(input.quotes),providerRequests:0,productionWrites:0};
}
