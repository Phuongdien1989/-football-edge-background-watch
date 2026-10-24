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
 const fromBaseline=baseline.version==='RECENT_RATE_TIME_ONLY_V1';
 return {status:fromBaseline?'BASELINE_WITH_LIVE_EVIDENCE':'EXTERNAL_MODEL_EVIDENCE',
  policy:LIVE_MODEL_POLICY,pmf:baseline.pmf,modelVersion:baseline.version,
  calibrated:baseline.validated===true,
  liveAdjusted:false,evidence,
  reason:fromBaseline?'Chỉ dùng Poisson lịch sử để định giá; tín hiệu LIVE đang được ghi nhận để kiểm chứng, chưa có hệ số điều chỉnh đã hiệu chỉnh':'Phân phối độc lập được chuyển nguyên trạng; không tự thay đổi xác suất'};
}
