// FT V2 LIVE probability candidate — read-only and fail-closed.
// Historical Poisson is the baseline; LIVE deltas are evidence, not secretly
// invented probability weights. Calibrated LIVE adjustments require measured
// replay/outcome calibration and are deliberately disabled in this version.
import {number,validatePMF} from './core.mjs';
export const LIVE_MODEL_POLICY='FT_V2_LIVE_EVIDENCE_UNCALIBRATED_V1';
const keys=['shots','sot','inbox','xg'];
const val=(v)=>{const n=number(v);return n!==null&&n>=0?n:null;};
export function liveEvidence(snapshot,{windowMinutes=10}={}){
 const now=number(snapshot?.at),minute=number(snapshot?.minute),cur=snapshot?.metrics||{};
 if(now===null||minute===null||minute<0||minute>90)return {status:'NO_OBSERVATION',delta:null,sourceAt:null};
 const history=(snapshot.history||[]).filter(r=>{
  const t=number(r?.at);return t!==null&&t<now&&now-t<=windowMinutes*60000
   &&r.goals?.home===snapshot.goals?.home&&r.goals?.away===snapshot.goals?.away;
 }).sort((a,b)=>a.at-b.at);
 if(!history.length)return {status:'NO_WINDOW',delta:null,sourceAt:null};
 const prior=history[0];const delta={};let known=0;
 for(const key of keys){
  const a=val(cur[key]),b=val(prior.metrics?.[key]);
  delta[key]=a!==null&&b!==null&&a>=b?a-b:null;
  if(delta[key]!==null)known++;
 }
 if(!known)return {status:'MISSING_STATS',delta,sourceAt:prior.at};
 const quality=['sot','inbox','xg'].some(k=>delta[k]!==null&&delta[k]>0);
 return {status:quality?'CHANCES_ADDED':'NO_CONFIRMED_CHANCES',delta,sourceAt:prior.at,observedAt:now,
  elapsedMinutes:(now-prior.at)/60000,qualityInputs:known,
  adjustment:'NOT_CALIBRATED',additionalProbability:null};
}
export function liveProbability(snapshot){
 const baseline=snapshot?.model||null;
 const evidence=liveEvidence(snapshot);
 if(!baseline?.independent||!validatePMF(baseline.pmf)||baseline.at!==snapshot?.at)
  return {status:'MODEL_WAIT',policy:LIVE_MODEL_POLICY,pmf:null,evidence,reason:'Thiếu phân phối bàn độc lập và cùng thời điểm'};
 const conditioned=baseline.scoreTimeConditioned===true;
 const fromBaseline=baseline.version==='RECENT_RATE_TIME_ONLY_V1';
 return {status:conditioned?'SCORE_TIME_CONDITIONED_WITH_LIVE_EVIDENCE':fromBaseline?'BASELINE_WITH_LIVE_EVIDENCE':'EXTERNAL_MODEL_EVIDENCE',
  policy:LIVE_MODEL_POLICY,pmf:baseline.pmf,modelVersion:baseline.version,
  calibrated:baseline.validated===true,
  liveAdjusted:false,scoreTimeConditioned:conditioned,evidence,
  reason:conditioned?'Đã cập nhật phân phối theo bàn đã ghi và phút quan sát; sức ép LIVE chưa được chuyển thành hệ số xác suất':fromBaseline?'Chỉ dùng Poisson lịch sử để định giá; tín hiệu LIVE đang được ghi nhận để kiểm chứng, chưa có hệ số điều chỉnh đã hiệu chỉnh':'Phân phối độc lập được chuyển nguyên trạng; không tự thay đổi xác suất'};
}


// FT-specific, score/time-conditioned research distribution. Shares no market
// inputs and leaves the legacy FT Overview researchBaseline unchanged.
export const FT_STATE_POLICY='FT_GAMMA_POISSON_STATE_V1';
export function ftStateModel({fixtureId,homeId,awayId,homeRecent,awayRecent,kickoff,at,minute,status,goals}={}){
 const missing=reason=>({ok:false,reason,model:null});
 const m=number(minute),h=number(homeId),a=number(awayId),time=number(at),start=number(kickoff);
 if(!Number.isSafeInteger(fixtureId)||!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h===a||!time||!start||!['NS','1H','HT','2H','LIVE'].includes(status)||m===null||m<0)return missing('INVALID_FIXTURE_CLOCK');
 if(!Number.isInteger(goals?.home)||goals.home<0||!Number.isInteger(goals?.away)||goals.away<0)return missing('INVALID_SCORE');
 if(status!=='NS'&&start>time||status==='NS'&&(m!==0||goals.home+goals.away!==0))return missing('CLOCK_SCORE_MISMATCH');
 if(status!=='NS'&&status!=='1H'&&status!=='HT'&&m>=90)return missing('ADDED_TIME_NOT_MODELED');
 if(m>90||status==='2H'&&m<45||status==='HT'&&m<45)return missing('CLOCK_PHASE_MISMATCH');
 const elapsed=status==='NS'?0:status==='HT'?45:status==='1H'?Math.min(m,45):m;
 const unique=new Map();
 for(const r of [...(homeRecent||[]),...(awayRecent||[])]){
  const date=Date.parse(r.date),gh=number(r.goals?.home),ga=number(r.goals?.away),rh=number(r.home_id),ra=number(r.away_id);
  if(r.status!=='FT'||!Number.isFinite(date)||date>=start||date>time||!Number.isInteger(gh)||!Number.isInteger(ga)||gh<0||ga<0||![rh,ra].includes(h)&&![rh,ra].includes(a))continue;
  if(number(r.fixture_id)===fixtureId)continue;
  const key=number(r.fixture_id)!==null?'id:'+r.fixture_id:JSON.stringify([date,rh,ra]);
  const old=unique.get(key),row={key,date,home:rh,away:ra,gh,ga};
  if(old&&(old.conflict||old.date!==date||old.home!==rh||old.away!==ra||old.gh!==gh||old.ga!==ga)){unique.set(key,{conflict:true});continue;}
  unique.set(key,row);
 }
 const ordered=[...unique.values()].filter(r=>!r.conflict).sort((x,y)=>y.date-x.date||String(x.key).localeCompare(y.key));
 const homeRows=ordered.filter(r=>[r.home,r.away].includes(h)).slice(0,8),awayRows=ordered.filter(r=>[r.home,r.away].includes(a)).slice(0,8);
 if(!homeRows.length||!awayRows.length)return missing('MISSING_FT_HISTORY');
 const pool=[...new Map([...homeRows,...awayRows].map(r=>[r.key,r])).values()];
 const historicalGoals=pool.reduce((sum,r)=>sum+r.gh+r.ga,0),observedGoals=goals.home+goals.away;
 const priorAlpha=.5+historicalGoals,priorBeta=pool.length,alpha=priorAlpha+observedGoals,beta=priorBeta+elapsed/90,exposure=(90-elapsed)/90;
 const q=exposure/(beta+exposure);let p=Math.pow(1-q,alpha),sum=p;const pmf=[p];
 for(let k=1;k<1000;k++){p*=((alpha+k-1)/k)*q;pmf.push(p);sum+=p;if(k>alpha*exposure/beta&&1-sum<1e-12)break;}
 if(!Number.isFinite(sum)||1-sum>1e-8)return missing('DISTRIBUTION_INVALID');pmf[pmf.length-1]+=1-sum;
 if(!validatePMF(pmf))return missing('DISTRIBUTION_INVALID');
 return {ok:true,reason:null,model:{version:FT_STATE_POLICY,kind:'RESEARCH',independent:true,validated:false,at:time,pmf,
  lambda90:priorAlpha/priorBeta,lambda:alpha/beta*exposure,scoreTimeConditioned:true,livePressureAdjusted:false,
  condition:{fixtureId,at:time,minute:m,nominalElapsed:elapsed,goals:{...goals},status},
  sample:{home:homeRows.length,away:awayRows.length,unique:pool.length},
  provenance:{fixtureKeys:pool.map(r=>r.key),historicalGoals,priorAlpha,priorBeta,alpha,beta,remainingExposure:exposure},
  assumptions:['HISTORICAL_FT_TOTALS','GAMMA_POISSON_POSTERIOR','CURRENT_SCORE_AND_OBSERVED_REGULATION_MINUTE','CONSTANT_RATE','NO_OPPONENT_STRENGTH_ADJUSTMENT','NO_SHOT_XG_RED_CARD_RATE_ADJUSTMENT','ADDED_TIME_NOT_ESTIMATED','UNCALIBRATED_RESEARCH']}};
}
