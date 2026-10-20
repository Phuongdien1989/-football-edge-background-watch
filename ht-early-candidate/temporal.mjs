// Candidate only. Pure evaluator: no requests, timers, storage or scan control.
// Factory is also embedded verbatim in the Mobile candidate by build.mjs.
export function createHTTemporal() {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const stamp=s=>finite(s?.captured_at)?s.captured_at:null;
  const round=n=>Math.round(n*10)/10;
  const keys=['shots','sot','inbox','corners','xg','red'];
  const metric=(s,k)=>(k==='red'||s?.stats_presence?.[k]===true)&&finite(s?.metrics?.total?.[k])?s.metrics.total[k]:null;
  const delta=(a,b)=>Object.fromEntries(keys.map(k=>[k,metric(a,k)==null||metric(b,k)==null?null:Math.max(0,metric(a,k)-metric(b,k))]));
  const samePhase=(a,b)=>!a.status||!b.status||a.status===b.status;
  const changed=(a,b)=>['home','away'].some(k=>finite(a.goals?.[k])&&finite(b.goals?.[k])&&a.goals[k]!==b.goals[k])||(metric(a,'red')!=null&&metric(b,'red')!=null&&metric(a,'red')!==metric(b,'red'));
  function segment(item,cur) {
    const end=stamp(cur); if(end==null)return [];
    const start=finite(item?.resetAt)?item.resetAt:-Infinity;
    const map=new Map();
    for(const s of item?.history||[])if(stamp(s)!=null&&stamp(s)>=start&&stamp(s)<end)map.set(stamp(s),s);
    map.set(end,cur);
    const rows=[...map.values()].sort((a,b)=>stamp(a)-stamp(b));
    let cut=0;
    for(let i=1;i<rows.length;i++) {
      // Same 70-second continuity limit already used by Mobile refreshH1Watch.
      if(stamp(rows[i])-stamp(rows[i-1])>70000||!samePhase(rows[i],rows[i-1])||changed(rows[i],rows[i-1]))cut=i;
    }
    return rows.slice(cut);
  }
  function findBaseline(item,cur,minutes) {
    if(!finite(minutes)||minutes<=0)return null;
    const rows=segment(item,cur).filter(s=>stamp(s)<stamp(cur));
    const target=stamp(cur)-minutes*60000;
    return rows.reduce((best,s)=>!best||Math.abs(stamp(s)-target)<Math.abs(stamp(best)-target)?s:best,null);
  }
  function windowFor(item,cur,minutes) {
    const base=findBaseline(item,cur,minutes);
    if(!base)return {mature:false,window_min:0,delta:Object.fromEntries(keys.map(k=>[k,null])),base:null};
    const duration=(stamp(cur)-stamp(base))/60000;
    // Reuse the existing display coverage boundaries; score and display now agree.
    return {mature:duration>=minutes*.8&&duration<=minutes*1.3,window_min:round(duration),duration_min:duration,delta:delta(cur,base),base};
  }
  function historyAge(item,cur) {
    const rows=segment(item,cur);
    return rows.length<2?0:round((stamp(cur)-stamp(rows[0]))/60000);
  }
  function displayWindow(item,cur,minutes) {
    const age=historyAge(item,cur),w=windowFor(item,cur,minutes);
    if(age<2||!w.base)return {status:'baseline',target:minutes,age,window_min:0,delta:null};
    if(w.duration_min>minutes*1.3)return {status:'gap',target:minutes,age,window_min:w.window_min,delta:null};
    return {status:w.mature?'complete':'partial',target:minutes,age,window_min:w.window_min,delta:w.delta};
  }
  function momentum(item,s) {
    const w3=windowFor(item,s,3),w6=windowFor(item,s,6),d=w3.delta;
    const empty={score:5,mature:false,window_min:w3.window_min,delta:d,accel:null,accelValid:false,accelKind:'INSUFFICIENT_HISTORY'};
    if(!w3.mature)return empty;
    const scale=3/w3.duration_min; let x=0;
    x+=clamp((d.shots??0)*scale/3*4,0,4);x+=clamp((d.sot??0)*scale/1.15*6,0,6);
    x+=clamp((d.inbox??0)*scale/2.1*3,0,3);x+=clamp((d.corners??0)*scale/1.3*2,0,2);
    if(s.stats_presence?.xg===true)x+=clamp((d.xg??0)*scale/.20*3,0,3);
    let accel=null,accelKind='INSUFFICIENT_HISTORY';
    if(w6.mature&&w3.base&&w6.base) {
      const prevMinutes=(stamp(w3.base)-stamp(w6.base))/60000;
      const prev=delta(w3.base,w6.base);
      // Compare the same available metrics in both disjoint periods.
      const required=['shots','sot'];
      if(prevMinutes>=3*.8&&prevMinutes<=3*1.3&&required.every(k=>d[k]!=null&&prev[k]!=null)) {
        const useXg=d.xg!=null&&prev.xg!=null;
        const rate=(v,m)=>(v.sot*2+v.shots*.35+(useXg?v.xg*5:0))/m;
        const recentRate=rate(d,w3.duration_min),prevRate=rate(prev,prevMinutes);
        if(prevRate>0){accel=Math.round((recentRate-prevRate)/prevRate*100)/100;accelKind='COMPARABLE';}
        else accelKind=recentRate>0?'FROM_QUIET':'BOTH_QUIET';
      }
    }
    if(accel!=null&&accel>.35)x+=2;else if(accel!=null&&accel<-.4)x-=2;
    return {score:clamp(Math.round(x),0,18),mature:true,window_min:w3.window_min,delta:d,accel,accelValid:accel!=null,accelKind};
  }
  function qualityScore(item,s,now=Date.now()) {
    const dq=finite(s.dq)?s.dq:finite(item.initialDQ)?item.initialDQ:null;
    const integ=finite(s.integrity)?s.integrity:finite(item.initialIntegrity)?item.initialIntegrity:null;
    let x=dq==null?0:clamp(Math.round(dq/25),0,4);
    if(integ!=null&&integ>=85)x++;
    const p=s.stats_presence;
    if(p?.core===false)x=Math.min(x,p.pressure?2:1);else if(p&&p.coverage<3)x=Math.min(x,3);
    // Missing/future timestamps cannot silently become a fresh observation.
    if(!finite(s.fresh_at)||s.fresh_at>now||(now-s.fresh_at)/1000>55)x=Math.min(x,1);
    return clamp(x,0,5);
  }
  function trend(e) {
    const d5=e?.recent5?.delta||{},d10=e?.recent10?.delta||{};
    const active5=(d5.sot??0)>=1||(d5.inbox??0)>=2||(d5.xg??0)>=.12||(d5.shots??0)>=3;
    const active10=(d10.sot??0)>=1||(d10.inbox??0)>=2||(d10.xg??0)>=.15||(d10.shots??0)>=4;
    if(e?.accelValid&&e.accel>=.35&&active5)return 'ACCELERATING';
    if(e?.recent5?.status==='complete'&&e?.recent10?.status==='complete'&&active5&&active10)return 'SUSTAINED';
    return active5?'ACTIVE':'QUIET';
  }
  return {findBaseline,windowFor,historyAge,displayWindow,momentum,qualityScore,trend};
}
