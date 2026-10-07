#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED="a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844"
# B6 deploy workflow applies this only to the staging service; production is never targeted.
MARKER="FE PREDICTION V2 B6 SHADOW STAGING 2026-10-06"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED:
    raise SystemExit(f"Refuse patch: expected P2052 {EXPECTED}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

style=r'''
<style id="fe-pv2-b6-style">
.fmd-card,.mt-intel{display:none !important}
.fe-pv2-shadow{margin:10px 0;border:1px solid rgba(70,115,145,.22);border-radius:14px;background:rgba(246,251,255,.88);overflow:hidden}
.fe-pv2-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(70,115,145,.14)}
.fe-pv2-head b{font-size:11px}.fe-pv2-head small{font-size:8px;color:var(--muted)}
.fe-pv2-actions{display:flex;gap:6px;flex-wrap:wrap}.fe-pv2-actions button{padding:6px 8px;font-size:8px}
.fe-pv2-meta{padding:7px 12px;font-size:8px;color:var(--muted)}\n#fePv2ValidationPanel{border-top:1px dashed rgba(70,115,145,.18);line-height:1.55;background:rgba(255,255,255,.52)}
.fe-pv2-rows{display:grid;gap:6px;padding:0 8px 8px}
.fe-pv2-row{display:grid;grid-template-columns:48px 1fr 70px;gap:8px;align-items:center;padding:8px;border-radius:11px;background:#fff;border:1px solid rgba(70,115,145,.12)}
.fe-pv2-row.positive{border-color:rgba(39,155,99,.30)}.fe-pv2-row.negative{opacity:.86}
.fe-pv2-rank{text-align:center}.fe-pv2-rank b{font-size:13px;display:block}.fe-pv2-rank span{font-size:7px;color:var(--muted)}
.fe-pv2-main{min-width:0}.fe-pv2-main>b{display:block;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pv2-main span,.fe-pv2-main small,.fe-pv2-main em{display:block;font-size:7.5px;color:var(--muted);font-style:normal;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-pv2-edge{text-align:right}.fe-pv2-edge b{display:block;font-size:12px}.fe-pv2-edge span{font-size:6.5px;color:var(--muted)}.fe-pv2-edge.positive b{color:#168a55}
.fe-pv2-empty{padding:10px;font-size:8px;color:var(--muted)}
.fe-pv2-badge{display:inline-flex;padding:3px 7px;border-radius:999px;font-size:7px;font-weight:800;background:#eef5ff;color:#365a78}
</style>
'''
panel=r'''
<!-- FE PREDICTION V2 B6 SHADOW STAGING 2026-10-06 -->
<div class="fe-pv2-shadow" id="fePv2Shadow">
  <div class="fe-pv2-head">
    <div><b>PREDICTION V2 • SHADOW STAGING</b><br><small>BASE → LIVE → CONFIDENCE → REAL MARKET → EDGE → RANK. Không thay TOP production.</small></div>
    <div class="fe-pv2-actions"><span class="fe-pv2-badge" id="fePv2ShadowStatus">CHỜ DỮ LIỆU</span><button id="fePv2RunBtn" type="button">↻ RUN</button><button id="fePv2ValidationBtn" type="button">VALIDATION</button><button id="fePv2ExportBtn" type="button">EXPORT</button></div>
  </div>
  <div class="fe-pv2-meta" id="fePv2ShadowMeta">0 cơ hội • shadow only</div>
  <div class="fe-pv2-meta" id="fePv2ValidationPanel" hidden></div>
  <div class="fe-pv2-rows" id="fePv2ShadowRows"><div class="fe-pv2-empty">Chưa có H1/FT/HC candidate trong Master Opportunity.</div></div>
</div>
'''
bridge=r'''
<script id="fe-pv2-b6-bridge">
(()=>{
  const slowCache=new Map();
  const rowNow=id=>feMasterRankRows(feMasterMergeFixtures()).find(x=>Number(x.id)===Number(id))||null;
  const itemNow=row=>row?.ft||row?.h1||row?.hc||row?.latest||null;
  const fixtureNow=id=>{
    const row=rowNow(id),it=itemNow(row),f=it?.latest?.fixture||null;
    return f||ULTRA_HUB?.heartbeat?.map?.get?.(String(id))||state?.fixtures?.find?.(x=>Number(x?.fixture?.id)===Number(id))||null;
  };
  const cached=async(key,ttl,fn)=>{
    const c=slowCache.get(key),now=Date.now();if(c&&now-c.at<ttl)return c.data;
    const data=await fn();slowCache.set(key,{at:now,data});return data;
  };
  const seasonPlayers=async(team,season)=>{
    if(!team||!season)return [];
    return cached(`players:${team}:${season}`,12*60*60*1000,async()=>{
      const pages=await Promise.all([1,2].map(page=>footballCached('/players',{team,season,page},12*60*60*1000,true)));
      const flat=pages.flatMap(x=>Array.isArray(x)?x:[]),seen=new Set();
      return flat.filter(x=>{const id=x?.player?.id;if(id==null)return true;if(seen.has(id))return false;seen.add(id);return true});
    });
  };
  async function contextInput(id){
    const f=fixtureNow(id);if(!f)return {};
    const home=Number(f?.teams?.home?.id),away=Number(f?.teams?.away?.id),league=Number(f?.league?.id),season=Number(f?.league?.season);
    const entry=ULTRA_HUB?.entries?.get?.(String(id));
    const [standingRaw,homeStatsRaw,awayStatsRaw,homeRecentRaw,awayRecentRaw,injuryRaw,lineupRaw,homeSeasonPlayers,awaySeasonPlayers]=await Promise.all([
      league&&season?footballCached('/standings',{league,season},60*60*1000,true):null,
      league&&season&&home?footballCached('/teams/statistics',{league,season,team:home},6*60*60*1000,true):null,
      league&&season&&away?footballCached('/teams/statistics',{league,season,team:away},6*60*60*1000,true):null,
      home?footballCached('/fixtures',{team:home,last:8},20*60*1000,true):null,
      away?footballCached('/fixtures',{team:away,last:8},20*60*1000,true):null,
      footballCached('/injuries',{fixture:id},4*60*60*1000,true),
      entry?.fields?.lineups?.data||footballCached('/fixtures/lineups',{fixture:id},2*60*1000,true),
      seasonPlayers(home,season),seasonPlayers(away,season)
    ]);
    const standings=standingsCompact(standingRaw||[]);
    const livePlayers=playersMatchCompact(entry?.fields?.players?.data||[]);
    return {
      homeId:home,awayId:away,homeSeasonPlayers,awaySeasonPlayers,
      lineups:lineupsCompact(lineupRaw||[]),injuries:injuriesCompact(injuryRaw||[]),livePlayers,
      homeStanding:standings.find(x=>Number(x?.team_id)===home)||null,awayStanding:standings.find(x=>Number(x?.team_id)===away)||null,
      homeTeamStats:teamStatsCompact(homeStatsRaw),awayTeamStats:teamStatsCompact(awayStatsRaw),
      homeRecent:recentCompact(homeRecentRaw||[]),awayRecent:recentCompact(awayRecentRaw||[])
    };
  }
  function explicitReceived(v){return v?.received_at??v?.meta?.received_at??null}
  function marketRows(id){
    const row=rowNow(id),items=[row?.ft,row?.h1,row?.hc,row?.latest].filter(Boolean),entry=ULTRA_HUB?.entries?.get?.(String(id)),marketField=entry?.fields?.market;
    for(const it of items){
      const rows=it?.latest?.market_rows||it?.lastMarketRows;
      if(Array.isArray(rows)&&rows.length)return rows.map(x=>({...x,received_at:explicitReceived(x)??explicitReceived(marketField),__observed_at:marketField?.at||null}));
    }
    return [];
  }
  function eventRows(id){
    const entry=ULTRA_HUB?.entries?.get?.(String(id)),field=entry?.fields?.events,raw=field?.data||[],received=explicitReceived(field);
    return eventsCompact(raw||[]).map((x,i)=>({...x,received_at:explicitReceived(raw?.[i])??received,__observed_at:field?.at||null}));
  }
  function sourceRefs(id){
    const entry=ULTRA_HUB?.entries?.get?.(String(id)),row=rowNow(id),item=itemNow(row),refs=[];
    const add=(kind,key,required=true)=>{const f=entry?.fields?.[key],d=f?.data;refs.push({kind,provider:'API_FOOTBALL',sourceId:f?.sig?`${kind}:${f.sig}`:null,payloadHash:f?.sig||null,
      receivedAt:explicitReceived(f)??explicitReceived(d),providerUpdatedAt:d?.update??null,observedAt:f?.at||null,required})};
    add('FIXTURE','fixture',true);add('LIVE_STATISTICS','stats',true);add('EVENTS','events',false);add('PLAYERS','players',false);add('LINEUPS','lineups',false);
    refs.push({kind:'CONTEXT_AGGREGATE',provider:'API_FOOTBALL',sourceId:null,receivedAt:item?.latest?.context_received_at??null,providerUpdatedAt:null,
      observedAt:item?.latest?.captured_at??null,required:true,metadata:{provenance_note:'P2052 context cache has no provable received_at; strict replay must quarantine until raw-capture provenance is wired.'}});
    return refs;
  }
  function outcomeSnapshots(id){
    const row=rowNow(id),items=[row?.ft,row?.h1,row?.hc].filter(Boolean),out=[];
    for(const it of items)for(const h of (it?.history||[]))out.push({...h,received_at:h?.received_at??null});
    const cur=itemNow(row)?.latest;if(cur)out.push({...cur,received_at:cur?.received_at??null});
    return out;
  }
  function periodResult(id,period){
    const f=fixtureNow(id),p=String(period||'').toUpperCase(),st=String(f?.fixture?.status?.short||'').toUpperCase(),entry=ULTRA_HUB?.entries?.get?.(String(id)),received=explicitReceived(entry?.fields?.fixture),
      hh=Number(f?.score?.halftime?.home),ha=Number(f?.score?.halftime?.away),fh=Number(f?.goals?.home),fa=Number(f?.goals?.away),h1ok=Number.isFinite(hh)&&Number.isFinite(ha)&&['HT','2H','FT','AET','PEN'].includes(st),ftok=Number.isFinite(fh)&&Number.isFinite(fa)&&['FT','AET','PEN'].includes(st);
    if(p==='H1')return {period:'H1',home:hh,away:ha,status:st,received_at:received,confirmed:h1ok};
    if(p==='FT')return {period:'FT',home:fh,away:fa,status:st,received_at:received,confirmed:ftok};
    if(p==='H2'&&h1ok&&ftok&&fh>=hh&&fa>=ha)return {period:'H2',home:fh-hh,away:fa-ha,status:st,received_at:received,confirmed:true};
    return {period:p||null,home:null,away:null,status:st,received_at:received,confirmed:false};
  }
  function fixtureSnapshot(id){return fixtureNow(id)}
  async function dbSync(events){return bgRequest('/api/db/sync',{method:'POST',body:{events},timeout:15000})}
  async function dbValidation(limit=10000){return bgRequest('/api/db/validation?limit='+Math.max(1,Math.min(10000,Number(limit)||10000)),{timeout:15000})}
  window.FE_PV2_RUNTIME={
    staging:true,version:'B10-BATCH02-STRICT-OBSERVATION-2026-10-07',
    masterRows:()=>feMasterRankRows(feMasterMergeFixtures()),
    oldRank:id=>rowNow(id)?.__rank||null,
    contextInput,marketRows,eventRows,sourceRefs,outcomeSnapshots,periodResult,fixtureSnapshot,dbSync,dbValidation,
    backgroundReady:()=>!!bgBase(),
    apiUsage:()=>apiUsageSnapshot(),
    productionUntouched:true
  };
})();
</script>
<script type="module" src="/prediction_v2/staging-sidecar.js"></script>
'''

head='</head>'
if head not in s: raise SystemExit("head marker missing")
s=s.replace(head,style+head,1)
needle='<div class="master-op-board" id="masterOpportunityBoard">'
if needle not in s: raise SystemExit("master board marker missing")
s=s.replace(needle,panel+needle,1)
body='</body>'
if body not in s: raise SystemExit("body marker missing")
s=s.replace(body,bridge+body,1)
p.write_text(s,encoding="utf-8")
print("patched",hashlib.sha256(s.encode()).hexdigest())
