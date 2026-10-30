// FT V2 offline cohort analytics. No API, no production changes.
import {joinPilotEvidence} from './pilot-evidence-join.mjs';
import {auditFTCalibration} from './calibration-audit.mjs';
const mean=(a,k)=>a.length?a.reduce((s,x)=>s+x[k],0)/a.length:null;
export function makeFTV2CohortReport(input,{minSamples=30}={}){
 const joined=joinPilotEvidence(input),calibration=auditFTCalibration(joined.rows,{minSamples});
 const details=[];
 const rejectedCalibrationIndexes=new Set(calibration.excluded.map(x=>x.index));
 for(const [index,row] of joined.rows.entries()){
  if(rejectedCalibrationIndexes.has(index))continue;
  const model=(input.forecasts||[]).find(x=>x.fixture_id===row.fixture_id);
  if(!model)continue;
  const additional=Math.max(0,Math.floor(row.line)+1-row.score.home-row.score.away);
  const p=additional===0?1:row.remaining_goals_pmf.slice(additional).reduce((a,b)=>a+b,0);
  const actual=Number(row.final_score.home+row.final_score.away>row.line);
  if(!Number.isFinite(p)||p<0||p>1)continue;
  details.push({fixture_id:row.fixture_id,minute:model.minute,live:model.live_signal,ev:p*row.market_odds-1,actual,brier:(p-actual)**2});
 }
 const groups=[];
 const group=(dimension,labels,classify)=>{for(const label of labels){
  const entries=details.filter(x=>classify(x)===label);
  groups.push({dimension,label,n:entries.length,win_rate:mean(entries,'actual'),mean_ev:mean(entries,'ev'),mean_brier:mean(entries,'brier'),validated:false});
 }};
 group('EV',['NEGATIVE','0-2%','2-5%','5%+'],x=>x.ev<0?'NEGATIVE':x.ev<.02?'0-2%':x.ev<.05?'2-5%':'5%+');
 group('MINUTE',['BEFORE_65','65-74','75+','UNKNOWN'],x=>!Number.isFinite(x.minute)?'UNKNOWN':x.minute<65?'BEFORE_65':x.minute<75?'65-74':'75+');
 group('LIVE',['CHANCES_ADDED','NO_CONFIRMED_CHANCES','MISSING_STATS','NO_WINDOW','UNKNOWN'],x=>['CHANCES_ADDED','NO_CONFIRMED_CHANCES','MISSING_STATS','NO_WINDOW'].includes(x.live)?x.live:'UNKNOWN');
 return {schema:'FT_V2_COHORT_V1',status:calibration.status,sample:calibration.sample,groups,excluded:[...joined.excluded,...calibration.excluded],calibration,performance_claim_permitted:false};
}