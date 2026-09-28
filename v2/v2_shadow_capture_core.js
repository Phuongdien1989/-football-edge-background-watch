/*
  FOOTBALL V2 — SHADOW CAPTURE PLANNER v0.6
  Pure functions: no API calls, no database writes.
*/
export const SHADOW_VERSION='V2_SHADOW_CAPTURE_0.6';

export const SHADOW_POLICY=Object.freeze({
  base_interval_ms:120000,
  active_interval_ms:60000,
  event_min_gap_ms:15000,
  max_per_tick:12,
  max_elapsed:130,
  live_statuses:new Set(['1H','HT','2H','ET','BT','P','INT','LIVE'])
});

const num=(v,d=null)=>{const n=Number(v);return Number.isFinite(n)?n:d};

export function fixtureLite(f){
  return {
    fixture_id:num(f?.fixture?.id),
    status:String(f?.fixture?.status?.short||''),
    elapsed:num(f?.fixture?.status?.elapsed),
    home:num(f?.goals?.home,0),
    away:num(f?.goals?.away,0),
    league_id:num(f?.league?.id),
    season:num(f?.league?.season)
  };
}

export function liveEligible(f){
  const x=fixtureLite(f);
  if(x.fixture_id==null||x.league_id==null||x.season==null)return false;
  if(!SHADOW_POLICY.live_statuses.has(x.status))return false;
  if(x.status==='HT')return true;
  if(x.elapsed==null)return ['INT','P'].includes(x.status);
  return x.elapsed>=1&&x.elapsed<=SHADOW_POLICY.max_elapsed;
}

export function detectCaptureReason(f,prev,nowMs){
  const cur=fixtureLite(f);
  const p=prev||null;

  if(!p)return {due:true,reason:'BASE_INITIAL',interval_ms:SHADOW_POLICY.base_interval_ms};

  const lastAt=num(p.captured_at_ms,0);
  const since=Math.max(0,nowMs-lastAt);
  const prevHome=num(p.home,0),prevAway=num(p.away,0);

  if(cur.home>prevHome||cur.away>prevAway){
    return {
      due:since>=SHADOW_POLICY.event_min_gap_ms,
      reason:'EVENT_GOAL',
      interval_ms:SHADOW_POLICY.event_min_gap_ms
    };
  }

  if(cur.status!==String(p.status||'')){
    return {
      due:since>=SHADOW_POLICY.event_min_gap_ms,
      reason:`PERIOD_${String(p.status||'NA')}_TO_${cur.status}`,
      interval_ms:SHADOW_POLICY.event_min_gap_ms
    };
  }

  const active=String(p.last_gate_status||'')==='PASS' &&
    (String(p.ui_interest||'')==='OPEN_CARD'||String(p.ui_interest||'')==='FOLLOW');
  const interval=active?SHADOW_POLICY.active_interval_ms:SHADOW_POLICY.base_interval_ms;

  return {
    due:since>=interval,
    reason:active?'ACTIVE_PERIODIC':'BASE_PERIODIC',
    interval_ms:interval
  };
}

export function planCaptures(fixtures,lastById={},nowMs=Date.now(),maxPerTick=SHADOW_POLICY.max_per_tick){
  const candidates=[];
  for(const f of fixtures||[]){
    if(!liveEligible(f))continue;
    const id=Number(f.fixture.id);
    const prev=lastById[id]||null;
    const d=detectCaptureReason(f,prev,nowMs);
    if(!d.due)continue;
    candidates.push({
      fixture:f,
      fixture_id:id,
      previous:prev,
      capture_reason:d.reason,
      capture_interval_sec:Math.max(15,Math.round(d.interval_ms/1000)),
      last_at:Number(prev?.captured_at_ms||0),
      priority:/^EVENT_|^PERIOD_/.test(d.reason)?2:(d.reason==='BASE_INITIAL'?1:0)
    });
  }
  candidates.sort((a,b)=>
    b.priority-a.priority ||
    a.last_at-b.last_at ||
    a.fixture_id-b.fixture_id
  );
  return candidates.slice(0,Math.max(1,Number(maxPerTick)||SHADOW_POLICY.max_per_tick));
}

export function compactLastState(packet,uiInterest=null){
  return {
    captured_at_ms:Number(packet.observed_at_ms||0),
    status:String(packet.fixture?.status_short||''),
    elapsed:num(packet.fixture?.elapsed),
    home:num(packet.fixture?.score_home,0),
    away:num(packet.fixture?.score_away,0),
    last_gate_status:String(packet.dq?.gate_status||''),
    ui_interest:uiInterest||null,
    fixture:packet.fixture||null,
    stats:packet.stats||null
  };
}
