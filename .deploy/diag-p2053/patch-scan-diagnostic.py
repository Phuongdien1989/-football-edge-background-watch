#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED_P2053="ab02d1eb428048bd00a69f56c3e5a16bed3c107feb66110c3ab08a9e84a05069"
MARKER="FE P2053 SCAN DIAGNOSTIC STAGING 2026-10-07"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED_P2053:
    raise SystemExit(f"Refuse diagnostic patch: expected exact P2053 {EXPECTED_P2053}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

old_overlay='''<div class="tiny" id="loadingText" style="margin-top:7px">Đang tải dữ liệu.</div>
</div>
</div>'''
new_overlay='''<div class="tiny" id="loadingText" style="margin-top:7px">Đang tải dữ liệu.</div>
<div id="feScanDiagPanel" style="margin-top:10px;width:min(78vw,520px);max-height:34vh;overflow:auto;text-align:left;background:#f8fbff;border:1px solid #cfe0ef;border-radius:12px;padding:9px 10px;font-size:11px;line-height:1.42;color:#27445d">
  <div style="font-weight:800;color:#0d5ba5">DIAGNOSTIC STAGING • KHÔNG ĐỔI SCORE/TOP</div>
  <div id="feScanDiagSummary" style="margin-top:4px">Chưa bắt đầu.</div>
  <div id="feScanDiagActive" style="margin-top:6px"></div>
  <div id="feScanDiagRecent" style="margin-top:6px;color:#587086"></div>
</div>
</div>
</div>'''
if old_overlay not in s:
    raise SystemExit("Overlay target not found")
s=s.replace(old_overlay,new_overlay,1)

old_loading="""  function loading(show,title='Đang xử lý...',text='Đang tải dữ liệu.'){els.overlay.classList.toggle('show',show);els.loadingTitle.textContent=title;els.loadingText.textContent=text}"""
new_loading="""  function loading(show,title='Đang xử lý...',text='Đang tải dữ liệu.'){els.overlay.classList.toggle('show',show);els.loadingTitle.textContent=title;els.loadingText.textContent=text}
  /* FE P2053 SCAN DIAGNOSTIC STAGING 2026-10-07
     Observability only. No scoring, threshold, QSIG, TOP, market-fit, push or engine-state formula changes. */
  const FE_SCAN_DIAG={mode:'IDLE',startedAt:0,seq:0,active:new Map(),recent:[],phases:[],timer:null};
  function feDiagSafe(v){try{return JSON.stringify(v)}catch{return String(v)}}
  function feDiagReset(mode){
    FE_SCAN_DIAG.mode=String(mode||'SCAN');FE_SCAN_DIAG.startedAt=Date.now();FE_SCAN_DIAG.seq=0;FE_SCAN_DIAG.active.clear();FE_SCAN_DIAG.recent=[];FE_SCAN_DIAG.phases=[];
    feDiagPhase('START',{mode:FE_SCAN_DIAG.mode});feDiagRender();
  }
  function feDiagPhase(name,meta={}){
    const row={at:Date.now(),name:String(name),meta};FE_SCAN_DIAG.phases.push(row);FE_SCAN_DIAG.phases=FE_SCAN_DIAG.phases.slice(-30);feDiagRender();return row
  }
  function feDiagBegin(path,params={}){
    const id=++FE_SCAN_DIAG.seq,row={id,path:String(path),params,at:Date.now()};FE_SCAN_DIAG.active.set(id,row);feDiagRender();return id
  }
  function feDiagEnd(id,outcome='OK',error=null){
    const row=FE_SCAN_DIAG.active.get(id);if(!row)return;
    FE_SCAN_DIAG.active.delete(id);FE_SCAN_DIAG.recent.unshift({...row,end:Date.now(),ms:Date.now()-row.at,outcome,error:error?String(error):null});
    FE_SCAN_DIAG.recent=FE_SCAN_DIAG.recent.slice(0,12);feDiagRender()
  }
  function feDiagRender(){
    const s=$('feScanDiagSummary'),a=$('feScanDiagActive'),r=$('feScanDiagRecent');if(!s||!a||!r)return;
    const elapsed=FE_SCAN_DIAG.startedAt?Math.round((Date.now()-FE_SCAN_DIAG.startedAt)/1000):0,active=[...FE_SCAN_DIAG.active.values()],lastPhase=FE_SCAN_DIAG.phases[FE_SCAN_DIAG.phases.length-1];
    s.innerHTML=`<b>${esc(FE_SCAN_DIAG.mode)}</b> • ${elapsed}s • active API ${active.length} • phase <b>${esc(lastPhase?.name||'IDLE')}</b>`;
    a.innerHTML=active.length?active.map(x=>`<div>⏳ <b>${esc(x.path)}</b> • ${Math.round((Date.now()-x.at)/1000)}s • ${esc(feDiagSafe(x.params).slice(0,120))}</div>`).join(''):'<div>✓ Không có API call đang chờ.</div>';
    r.innerHTML=FE_SCAN_DIAG.recent.length?'<b>Gần nhất:</b> '+FE_SCAN_DIAG.recent.slice(0,6).map(x=>`${esc(x.path)} ${x.ms}ms ${esc(x.outcome)}`).join(' • '):'Chưa có request hoàn tất.';
  }
  FE_SCAN_DIAG.timer=setInterval(feDiagRender,500);
  window.FE_SCAN_DIAG=FE_SCAN_DIAG;"""
if old_loading not in s:
    raise SystemExit("loading() target not found")
s=s.replace(old_loading,new_loading,1)

old_football="""  async function football(path,params={},optional=false){
    const base=els.fbase.value.trim().replace(/\\/$/,'');const u=new URL(base+path);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
    try{const r=await fetch(u,{headers:footballHeaders(),signal:controller.signal});recordApiNetwork(r.headers);const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{throw new Error(`Football API trả dữ liệu không phải JSON (HTTP ${r.status})`)}
      if(!r.ok)throw new Error(`Football API HTTP ${r.status}: ${JSON.stringify(data.errors||data).slice(0,220)}`);
      const apiErrors=footballApiErrors(data?.errors);
      if(apiErrors.length){
        const quota=footballQuotaLabel();
        const err=new Error(`Football API từ chối: ${apiErrors.join(' | ').slice(0,320)}${quota?` • ${quota}`:''}`);
        err.api_errors=data.errors;err.http_status=r.status;throw err
      }
      return data.response??[];
    }catch(e){const err=e?.name==='AbortError'?new Error(`Football API quá thời gian chờ ${Math.round(API_TIMEOUT_MS/1000)} giây`):e;log(`Lỗi ${path}: ${err.message}`);if(optional)return null;throw err}finally{clearTimeout(timeout)}
  }"""
new_football="""  async function football(path,params={},optional=false){
    const diagId=feDiagBegin(path,params),base=els.fbase.value.trim().replace(/\\/$/,'');const u=new URL(base+path);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')u.searchParams.set(k,String(v))});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);let diagOutcome='OK',diagError=null;
    try{const r=await fetch(u,{headers:footballHeaders(),signal:controller.signal});recordApiNetwork(r.headers);const txt=await r.text();let data;try{data=JSON.parse(txt)}catch{throw new Error(`Football API trả dữ liệu không phải JSON (HTTP ${r.status})`)}
      if(!r.ok)throw new Error(`Football API HTTP ${r.status}: ${JSON.stringify(data.errors||data).slice(0,220)}`);
      const apiErrors=footballApiErrors(data?.errors);
      if(apiErrors.length){
        const quota=footballQuotaLabel();
        const err=new Error(`Football API từ chối: ${apiErrors.join(' | ').slice(0,320)}${quota?` • ${quota}`:''}`);
        err.api_errors=data.errors;err.http_status=r.status;throw err
      }
      return data.response??[];
    }catch(e){const err=e?.name==='AbortError'?new Error(`Football API quá thời gian chờ ${Math.round(API_TIMEOUT_MS/1000)} giây`):e;diagOutcome=e?.name==='AbortError'?'TIMEOUT':'ERROR';diagError=err.message;log(`Lỗi ${path}: ${err.message}`);if(optional)return null;throw err}finally{clearTimeout(timeout);feDiagEnd(diagId,diagOutcome,diagError)}
  }"""
if old_football not in s:
    raise SystemExit("football() target not found")
s=s.replace(old_football,new_football,1)

old_bundle="""  async function getGroupBundle(f){
    const mode=autoModeForFixture(f),id=f.fixture.id,home=f.teams.home.id,away=f.teams.away.id,league=f.league.id,season=f.league.season;"""
new_bundle="""  async function getGroupBundle(f){
    const mode=autoModeForFixture(f),id=f.fixture.id,home=f.teams.home.id,away=f.teams.away.id,league=f.league.id,season=f.league.season;
    feDiagPhase('BUNDLE_START',{fixture:id,mode,home:f.teams?.home?.name,away:f.teams?.away?.name});"""
if old_bundle not in s:
    raise SystemExit("getGroupBundle start target not found")
s=s.replace(old_bundle,new_bundle,1)

old_bundle_return="""    return {meta:compactFixtureMeta(f,mode),coverage,data:n};
  }

  async function mapLimit"""
new_bundle_return="""    feDiagPhase('BUNDLE_DONE',{fixture:id,mode,dq:coverage?.score,stats:!!Object.keys(n.live_statistics||{}).length,events:(n.events||[]).length,live_odds:(n.live_odds||[]).length});
    return {meta:compactFixtureMeta(f,mode),coverage,data:n};
  }

  async function mapLimit"""
if old_bundle_return not in s:
    raise SystemExit("getGroupBundle return target not found")
s=s.replace(old_bundle_return,new_bundle_return,1)

old_retry="""  async function watchRetryBundleStats(entry){
    if(!entry?.b||!entry?.f||entry.health?.retryable!==true)return false;"""
new_retry="""  async function watchRetryBundleStats(entry){
    if(!entry?.b||!entry?.f||entry.health?.retryable!==true)return false;
    feDiagPhase('STATS_RETRY_START',{fixture:entry.b?.meta?.fixture_id,home:entry.f?.teams?.home?.name,away:entry.f?.teams?.away?.name});"""
if old_retry not in s:
    raise SystemExit("watchRetryBundleStats target not found")
s=s.replace(old_retry,new_retry,1)

for mode,needle in [
    ('FT',"  async function startLiveWatch(){\n    const feIsolationSnap=feCaptureOtherEngines('FT');"),
    ('H1',"async function startH1Watch(){\n    const feIsolationSnap=feCaptureOtherEngines('H1');"),
    ('HC',"async function startHandicapWatch(){\n    const feIsolationSnap=feCaptureOtherEngines('HC');")
]:
    if needle not in s:
        raise SystemExit(f"{mode} start target not found")
    repl=needle.replace("    const feIsolationSnap",f"    feDiagReset('{mode}');\n    const feIsolationSnap")
    s=s.replace(needle,repl,1)

old_ft_progress="""const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{els.loadingText.textContent=`${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});"""
new_ft_progress="""const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{feDiagPhase('FT_BUNDLE_PROGRESS',{done,total:n,fixture:f?.fixture?.id});els.loadingText.textContent=`${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});"""
if old_ft_progress not in s:
    raise SystemExit("FT progress target not found")
s=s.replace(old_ft_progress,new_ft_progress,1)

old_h1_progress="""const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{els.loadingText.textContent=`H1 ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});"""
new_h1_progress="""const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{feDiagPhase('H1_BUNDLE_PROGRESS',{done,total:n,fixture:f?.fixture?.id});els.loadingText.textContent=`H1 ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});"""
if old_h1_progress not in s:
    raise SystemExit("H1 progress target not found")
s=s.replace(old_h1_progress,new_h1_progress,1)

old_hc_ref="""      const liveRef=await getBetReference('live'),seeds=(await mapLimit(cand,5,async f=>{"""
new_hc_ref="""      feDiagPhase('HC_REFERENCE_START',{count:cand.length});
      const liveRef=await getBetReference('live');feDiagPhase('HC_REFERENCE_DONE',{count:liveRef?.count||0});
      const seeds=(await mapLimit(cand,5,async f=>{"""
if old_hc_ref not in s:
    raise SystemExit("HC reference target not found")
s=s.replace(old_hc_ref,new_hc_ref,1)

old_hc_seed="""        const s=await hcFetchSnapshot(temp,f,liveRef,true);return {f,s,temp,rank:hcSeedRank(s)}
      })).filter(Boolean);"""
new_hc_seed="""        feDiagPhase('HC_FIXTURE_START',{fixture:f.fixture.id,home:f.teams?.home?.name,away:f.teams?.away?.name});
        const s=await hcFetchSnapshot(temp,f,liveRef,true);feDiagPhase('HC_FIXTURE_DONE',{fixture:f.fixture.id});return {f,s,temp,rank:hcSeedRank(s)}
      },(done,n,f)=>{feDiagPhase('HC_PROGRESS',{done,total:n,fixture:f?.fixture?.id});if(els.loadingText)els.loadingText.textContent=`HC ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`})).filter(Boolean);"""
if old_hc_seed not in s:
    raise SystemExit("HC seed target not found")
s=s.replace(old_hc_seed,new_hc_seed,1)

if "</head>" not in s:
    raise SystemExit("Missing </head>")
s=s.replace("</head>",f"<!-- {MARKER} -->\n</head>",1)
p.write_text(s,encoding="utf-8")
print(hashlib.sha256(s.encode()).hexdigest())
