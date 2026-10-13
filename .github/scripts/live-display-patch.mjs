export const marker='FE_LIVE_DISPLAY_FRESHNESS_V1';
export const guardSource=String.raw`function feLiveDisplayCurrent(raw,now=Date.now()){
    if(!raw)return false;
    const item=feSyncGuard(raw),s=item.latest||{},at=Number(s.fresh_at||s.captured_at||0);
    const phase=String(s.status||s.fixture?.fixture?.status?.short||'');
    return at>0&&now>=at&&now-at<=60000&&['1H','HT','2H','ET','BT','P','INT','SUSP','LIVE'].includes(phase)
      &&item.state!=='ENDED'&&item.state!=='STALE'&&item.eval?.state!=='ENDED';
  }
  function feLiveDisplaySelection(){
    const tracked=[...watchState.items,...h1WatchState.items,...handicapWatchState.pool];
    const expired=new Set(tracked.filter(x=>!feLiveDisplayCurrent(x)).map(x=>Number(x.id)));
    const current=new Set(tracked.filter(x=>feLiveDisplayCurrent(x)).map(x=>Number(x.id)));
    const hidden=id=>expired.has(Number(id))&&!current.has(Number(id));
    return {selected:hidden(state.selected?.fixture?.id)?null:state.selected,
      fixtures:state.fixtures.filter(f=>!hidden(f.fixture?.id)),fixtureFilter:state.fixtureFilter,scanning:state.scanning};
  }`;
export function patchLiveDisplay(html){
  if(html.includes(marker))throw Error('FRONTEND_ALREADY_PATCHED');
  const edits=[
    ['  function feSyncGuard(item){','  // '+marker+' — display expiry only; retained histories keep refreshing.\n  '+guardSource+'\n  function feSyncGuard(item){'],
    ['const old=list.find(x=>Number(x.id)===row.fixture_id),phase=row.fixture.fixture.status.short;',"const old=list.find(x=>Number(x.id)===row.fixture_id),phase=row.fixture.fixture.status.short;\n        if(!old&&window.FEStateCore.disposition(row).key!=='CURRENT')continue;"],
    ['state:{selected:state.selected,fixtures:state.fixtures,fixtureFilter:state.fixtureFilter,scanning:state.scanning},','state:feLiveDisplaySelection(),'],
    ['items:watchState.items.map(feUIItem)','items:watchState.items.filter(x=>feLiveDisplayCurrent(x)).map(feUIItem)'],
    ['items:h1WatchState.items.map(feUIItem)','items:h1WatchState.items.filter(x=>feLiveDisplayCurrent(x)).map(feUIItem)'],
    ['pool:handicapWatchState.pool.map(feUIItem)','pool:handicapWatchState.pool.filter(x=>feLiveDisplayCurrent(x)).map(feUIItem)'],
    ['items=(watchState.items||[]).map(feSyncGuard)','items=(watchState.items||[]).filter(x=>feLiveDisplayCurrent(x)).map(feSyncGuard)'],
    ['items=(h1WatchState.items||[]).map(feSyncGuard)','items=(h1WatchState.items||[]).filter(x=>feLiveDisplayCurrent(x)).map(feSyncGuard)'],
    ['top=hcTopItems().map(feSyncGuard)','top=hcTopItems().filter(x=>feLiveDisplayCurrent(x)).map(feSyncGuard)']
  ];
  for(const [before,after]of edits){if(html.split(before).length!==2)throw Error('FRONTEND_PATCH_ANCHOR_MISMATCH:'+before.slice(0,70));html=html.replace(before,after);}
  return html;
}
