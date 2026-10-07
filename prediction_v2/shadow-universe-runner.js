/* FOOTBALL EDGE — Prediction V2 / B5
 * End-to-end SHADOW universe runner.
 * Attaches prediction, evaluates actual markets, ranks the current universe,
 * and optionally records paired OLD-vs-NEW + paper-market evidence.
 * It does NOT mutate the current production TOP fields.
 */
import {attachShadowPrediction} from './shadow-live-bridge.js';
import {rankOpportunities} from './opportunity-ranking.js';
import {buildPairedObservation} from './old-vs-new-comparator.js';
import {createPaperMarketRecord} from './paper-market-evidence.js';
import {marketPeriodForEngine} from './observation-contract.js';

const fixtureId=item=>Number(item?.id??item?.fixture_id??item?.fixture?.id)||null;
export function runShadowUniverse({
  items=[],engine='FT',contexts=new Map(),bundles=new Map(),extrasByFixture=new Map(),marketRowsByFixture=new Map(),
  oldRankMetaByFixture=new Map(),calibrationByFixture=new Map(),predictionEvidence=null,pairedEvidence=null,paperEvidence=null,
  now=Date.now(),fallbackLambda90=2.5,sourceRefsByFixture=new Map(),strictMarket=false,marketFreshnessPolicy=null
}={}){
  const modeled=[];
  for(const item of items||[]){
    const id=fixtureId(item);if(id==null)continue;
    const context=contexts instanceof Map?contexts.get(id):contexts?.[id],bundle=bundles instanceof Map?bundles.get(id):bundles?.[id],
      extras=extrasByFixture instanceof Map?extrasByFixture.get(id):extrasByFixture?.[id],
      calibration=calibrationByFixture instanceof Map?calibrationByFixture.get(id):calibrationByFixture?.[id];
    const sourceRefs=sourceRefsByFixture instanceof Map?sourceRefsByFixture.get(id):sourceRefsByFixture?.[id],marketPeriod=marketPeriodForEngine(engine);
    const shadow=attachShadowPrediction({item,engine,bundle,context,extras:extras||{},calibration,evidenceRows:predictionEvidence,now,fallbackLambda90,sourceRefs:sourceRefs||[],marketPeriod,evaluationCutoff:now});
    const marketRows=marketRowsByFixture instanceof Map?marketRowsByFixture.get(id):marketRowsByFixture?.[id];
    modeled.push({id,item,prediction:shadow.prediction,state:shadow.packet.state,marketRows:marketRows||[],context:shadow.context,marketPeriod,evaluationCutoff:now,observation:shadow?.evidence?.observation||null});
  }
  const ranked=rankOpportunities(modeled,{strictMarket,freshnessPolicy:marketFreshnessPolicy});
  for(const opp of ranked){
    const id=opp.id;opp.item.predictionV2RankShadow={rank:opp.rank,top:opp.top,rank_score:opp.rank_score,edge_status:opp.edge_status,best_market:opp.best_market||null};
    if(Array.isArray(pairedEvidence)){
      const oldMeta=oldRankMetaByFixture instanceof Map?oldRankMetaByFixture.get(id):oldRankMetaByFixture?.[id],
        hit=opp.item?.validation_hit??null;
      const obs=[...(predictionEvidence||[])].reverse().find(e=>Number(e.fixture_id)===Number(id)&&Number(e.captured_at)===Number(now))?.observation||null;
      pairedEvidence.push(buildPairedObservation({fixtureId:id,capturedAt:now,oldRankMeta:oldMeta,newOpportunity:opp,hit,observation:obs,
        league:opp.item?.latest?.league?.name??opp.item?.league??null,minute:opp.state?.minute}));
    }
    if(Array.isArray(paperEvidence)&&opp.best_market){
      const obs=[...(predictionEvidence||[])].reverse().find(e=>Number(e.fixture_id)===Number(id)&&Number(e.captured_at)===Number(now))?.observation||null;
      const rec=createPaperMarketRecord({fixtureId:id,capturedAt:now,state:opp.state,bestMarket:opp.best_market,marketPeriod:opp.market_period,targetPeriod:opp.market_period,evaluationCutoff:now,observation:obs,strict:strictMarket,
        confidence:opp.prediction?.confidence?.score_100,league:opp.item?.latest?.league?.name??opp.item?.league??null});
      if(rec)paperEvidence.push(rec);
    }
  }
  return ranked;
}