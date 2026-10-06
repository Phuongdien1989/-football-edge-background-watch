/* FOOTBALL EDGE — Prediction V2 / B5
 * Validation/calibration metrics for shadow predictions.
 * Uses only settled outcomes. No model tuning or production decision is performed here.
 */
const finite=v=>v===null||v===undefined||(typeof v==='string'&&!v.trim())?null:(Number.isFinite(Number(v))?Number(v):null);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const round=(v,d=4)=>{const n=finite(v);if(n==null)return null;const p=10**d;return Math.round(n*p)/p};
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function toProb(v){const n=finite(v);if(n==null)return null;return clamp(n>1?n/100:n,0,1)}
function toOutcome(v){if(v===true||v===1||v==='1')return 1;if(v===false||v===0||v==='0')return 0;return null}
function getPath(obj,path){return String(path).split('.').reduce((o,k)=>o==null?undefined:o[k],obj)}
export function calibrationMetrics(rows,{probPath='p_goal_10m',outcomePath='outcome.goal_10m',buckets=10}={}){
  const clean=[];
  for(const r of rows||[]){const p=toProb(getPath(r,probPath)),y=toOutcome(getPath(r,outcomePath));if(p==null||y==null)continue;clean.push({p,y,row:r})}
  if(!clean.length)return {n:0,brier:null,log_loss:null,observed_rate:null,mean_probability:null,ece:null,buckets:[]};
  const eps=1e-9,brier=mean(clean.map(x=>(x.p-x.y)**2)),logLoss=-mean(clean.map(x=>x.y*Math.log(clamp(x.p,eps,1-eps))+(1-x.y)*Math.log(clamp(1-x.p,eps,1-eps)))),
    observed=mean(clean.map(x=>x.y)),mp=mean(clean.map(x=>x.p)),bs=Math.max(2,Math.min(20,Number(buckets)||10)),bucketRows=[];
  for(let i=0;i<bs;i++){
    const lo=i/bs,hi=(i+1)/bs,items=clean.filter(x=>x.p>=lo&&(i===bs-1?x.p<=hi:x.p<hi));if(!items.length)continue;
    const avgP=mean(items.map(x=>x.p)),rate=mean(items.map(x=>x.y));
    bucketRows.push({bucket:`${Math.round(lo*100)}-${Math.round(hi*100)}`,n:items.length,mean_probability:round(avgP*100,2),observed_rate:round(rate*100,2),calibration_gap_pp:round((avgP-rate)*100,2)});
  }
  const ece=bucketRows.reduce((s,b)=>s+(b.n/clean.length)*Math.abs(b.calibration_gap_pp/100),0);
  return {n:clean.length,brier:round(brier,5),log_loss:round(logLoss,5),observed_rate:round(observed*100,2),mean_probability:round(mp*100,2),ece:round(ece,5),buckets:bucketRows};
}
export function minuteBucket(minute){
  const m=finite(minute);if(m==null)return 'UNKNOWN';if(m<15)return '00-14';if(m<30)return '15-29';if(m<45)return '30-44';if(m<60)return '45-59';if(m<75)return '60-74';return '75+';
}
export function stratifiedCalibration(rows,{probPath='p_goal_10m',outcomePath='outcome.goal_10m',groupBy='league'}={}){
  const groups=new Map();
  for(const r of rows||[]){
    let key;if(groupBy==='minute_bucket')key=minuteBucket(r.minute);else if(groupBy==='confidence_band')key=r.confidence_band||'UNKNOWN';else if(groupBy==='market')key=r.market||r.best_market?.market||'UNKNOWN';else key=r[groupBy]??'UNKNOWN';
    if(!groups.has(String(key)))groups.set(String(key),[]);groups.get(String(key)).push(r);
  }
  return [...groups.entries()].map(([key,items])=>({group:key,...calibrationMetrics(items,{probPath,outcomePath})})).sort((a,b)=>b.n-a.n);
}
export function opportunityMetrics(rows,{eligiblePath='eligible',hitPath='hit'}={}){
  const total=(rows||[]).length,eligible=(rows||[]).filter(r=>Boolean(getPath(r,eligiblePath))),settled=eligible.map(r=>toOutcome(getPath(r,hitPath))).filter(v=>v!=null);
  return {observations:total,opportunities:eligible.length,opportunity_rate_pct:total?round(eligible.length/total*100,2):null,settled_opportunities:settled.length,
    hit_rate_pct:settled.length?round(mean(settled)*100,2):null};
}
export function settlementReturn(result,odds){
  const o=finite(odds);if(o==null||o<=1)return null;
  const r=String(result||'').toUpperCase();if(r==='WIN')return o-1;if(r==='HALF_WIN')return (o-1)/2;if(r==='PUSH')return 0;if(r==='HALF_LOSS')return -.5;if(r==='LOSS')return -1;return null;
}
export function marketValidation(rows=[]){
  const clean=[];
  for(const r of rows){const expected=finite(r.expected_return??r.edge?.expected_return),realized=finite(r.realized_return)??settlementReturn(r.settlement_result,r.odds);if(realized==null)continue;clean.push({expected,realized})}
  if(!clean.length)return {n:0,mean_expected_return:null,mean_realized_return:null,total_realized_units:null,expected_realized_gap:null,positive_edge_n:0,positive_edge_realized:null};
  const exp=clean.map(x=>x.expected).filter(v=>v!=null),real=clean.map(x=>x.realized),pos=clean.filter(x=>x.expected!=null&&x.expected>0);
  return {n:clean.length,mean_expected_return:round(mean(exp),4),mean_realized_return:round(mean(real),4),total_realized_units:round(real.reduce((s,v)=>s+v,0),3),
    expected_realized_gap:exp.length===clean.length?round(mean(exp)-mean(real),4):null,positive_edge_n:pos.length,positive_edge_realized:pos.length?round(mean(pos.map(x=>x.realized)),4):null};
}
export function validationDashboard(rows=[]){
  return {
    generated_at:Date.now(),goal_5m:calibrationMetrics(rows,{probPath:'p_goal_5m',outcomePath:'outcome.goal_5m'}),
    goal_10m:calibrationMetrics(rows,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m'}),
    goal_15m:calibrationMetrics(rows,{probPath:'p_goal_15m',outcomePath:'outcome.goal_15m'}),
    by_minute_10m:stratifiedCalibration(rows,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m',groupBy:'minute_bucket'}),
    by_confidence_10m:stratifiedCalibration(rows,{probPath:'p_goal_10m',outcomePath:'outcome.goal_10m',groupBy:'confidence_band'})
  };
}
