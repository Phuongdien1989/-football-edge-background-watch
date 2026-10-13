// Read-only notification snapshots for the existing FE_NOTIFY_SYNC_CORE frontend.
// No API calls, engine evaluation, threshold changes or scan-control mutations.
const clone=v=>JSON.parse(JSON.stringify(v));
export function uiStatePacket(items,{device=null,now=Date.now(),limit=50}={}){
 const snapshots=[],pending=[];
 for(const item of items.slice(0,limit)){
  const u=item?.ui;
  if(!u||u.fixture?.fixture?.id!==Number(item.id)||!Number.isSafeInteger(u.revision)||u.revision<=0){
   pending.push({fixture_id:Number(item.id),reason:item.last?.reason||'SNAPSHOT_NOT_PUBLISHED'});continue;
  }
  const sourceHealth=item.last?.sourceHealth||{};
  const row={
   schema:'FE_NOTIFY_UI_SNAPSHOT_V1',fixture_id:Number(item.id),captured_at:u.captured_at,
   revision:u.revision,version:u.version,fixture:u.fixture,
   active_live:['1H','2H','LIVE'].includes(u.fixture.fixture.status?.short),
   source_health:sourceHealth,publication_error:item.last?.reason||null,
   snapshot:u.snapshot,engines:u.engines,
   goal_estimate:device?(u.goal_estimates?.[device]||null):null,
   runtime:{
    FT:{history:item.history||[],cooldownUntil:item.cooldown||0},
    H1:{history:item.h1History||[],resetAt:item.h1ResetAt||0,cooldownUntil:item.h1CooldownUntil||0,snapshot:u.h1_snapshot},
    HC:{history:(item.hcHistory||[]).slice(0,-1),cooldownUntil:item.cooldown||0,snapshot:u.hc_snapshot}
   }
  };
  if(sourceHealth.stats!=='OK'&&row.publication_error==null)row.publication_error='STATS_UNAVAILABLE';
  snapshots.push(clone(row));
 }
 return {ok:true,schema:'FE_NOTIFY_UI_STATE_V1',server_at:now,snapshots,pending};
}
