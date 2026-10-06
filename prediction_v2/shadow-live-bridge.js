/* FOOTBALL EDGE — Prediction V2 / B3
 * Runtime bridge for candidate items. Purely additive: attaches item.predictionV2Shadow.
 */
import {buildMatchContextFeatures} from './context-feature-layer.js';
import {buildLiveFeaturePacket,buildBundleContextInput} from './live-feature-adapter.js';
import {predictShadowProbability} from './probability-engine.js';
import {compactShadowEvidence,shouldRecordShadow} from './shadow-evidence.js';

export function contextFromBundle(bundle,extras={}){
  return buildMatchContextFeatures(buildBundleContextInput(bundle,extras));
}
export function attachShadowPrediction({item,engine='FT',bundle=null,context=null,extras={},calibration=null,evidenceRows=null,now=Date.now(),fallbackLambda90=2.5}={}){
  if(!item)throw new Error('item required');
  const ctx=context||(bundle?contextFromBundle(bundle,extras):null),
    packet=buildLiveFeaturePacket({fixtureId:item.id,engine,item,snapshot:item.latest,evaluation:item.eval,context:ctx,calibration,now}),
    prediction=predictShadowProbability(packet,{fallbackLambda90,calibration});
  item.predictionV2Shadow={packet,prediction,context:ctx};
  if(Array.isArray(evidenceRows)){
    const row=compactShadowEvidence({item,packet,prediction,context:ctx,now}),
      prev=[...evidenceRows].reverse().find(x=>Number(x.fixture_id)===Number(row.fixture_id)&&String(x.engine)===String(row.engine));
    if(shouldRecordShadow(prev,row))evidenceRows.push(row);
  }
  return item.predictionV2Shadow;
}
