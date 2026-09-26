// Pure HC validation guard. No scoring/threshold changes.
// A 15-minute HC outcome is valid only when the END snapshot has the same minimum
// data readiness used by LIVE GAP signal generation. This prevents partial/reset
// states from being recorded as a real neutralization.

const num=(v,d=null)=>{const x=Number(v);return Number.isFinite(x)?x:d};

export function hcEndStateGuard(item,now=Date.now()){
  const last=item?.last||null;
  const end=num(last?.gap);
  const age=last?.at?now-Number(last.at):Infinity;
  if(end==null)return {ready:false,reason:'HC_END_GAP_MISSING',end:null,age};
  if(age>150000)return {ready:false,reason:'HC_STATE_NOT_FRESH',end,age};
  if(last?.sourceHealth?.stats&&last.sourceHealth.stats!=='OK')return {ready:false,reason:'HC_END_STATS_NOT_OK',end,age};

  const history=Array.isArray(item?.hcHistory)?item.hcHistory:[];
  if(!history.length)return {ready:false,reason:'HC_END_HISTORY_MISSING',end,age};
  const cur=history[history.length-1];
  const curAt=num(cur?.captured_at);
  if(curAt==null||Math.abs(Number(last.at)-curAt)>90000)return {ready:false,reason:'HC_END_HISTORY_STALE',end,age};
  if(cur?.metrics?.dataTier!=='FULL')return {ready:false,reason:'HC_END_DATA_TIER_'+String(cur?.metrics?.dataTier||'UNKNOWN'),end,age};

  // hcWindow() considers a 3m/5m window usable from 1.5 minutes of history.
  // Requiring the same minimum prevents a reset/new-half snapshot from being
  // treated as a resolved HC state before momentum has rebuilt.
  const hasUsableWindow=history.slice(0,-1).some(r=>{
    const at=num(r?.captured_at);return at!=null&&curAt-at>=90000;
  });
  if(!hasUsableWindow)return {ready:false,reason:'HC_END_WINDOW_NOT_READY',end,age};

  return {ready:true,reason:'OK',end,age,data_tier:'FULL'};
}

export function classifyHcEnd(start,end,threshold=70){
  const s=num(start),e=num(end),t=num(threshold,70);
  if(s==null||e==null)return {state:null,reason:'HC_GAP_INVALID'};
  const same=Math.sign(s)===Math.sign(e),abs=Math.abs(e);
  let state;
  if(abs<20)state='NEUTRALIZED';
  else if(!same)state='FLIPPED';
  else if(abs>=t)state='SAME_ABOVE_THRESHOLD';
  else state='SAME_BELOW_THRESHOLD';
  return {state,gap_end:e,gap_start:s,gap_delta:e-s};
}
