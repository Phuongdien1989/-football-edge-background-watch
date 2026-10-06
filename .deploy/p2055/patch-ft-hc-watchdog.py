#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED_P2054="1795f265f5af3c8266806d964c60f12e4fb0c86a25e477ca4ecc031e1f302b08"
MARKER="FE P2.0.5.5 FT+HC SCREEN WATCHDOG 2026-10-07"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED_P2054:
    raise SystemExit(f"Refuse patch: expected exact P2054 {EXPECTED_P2054}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

old_ft="""    try{const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{els.loadingText.textContent=`${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});const screened=await watchSelectUsableBundles(bundles,pref,'FT',WATCH_MAX_ITEMS,watchBundleScore,'FT STATS');const ranked=screened.selected,hs=screened.summary;"""
new_ft="""    try{
      /* FE P2.0.5.5 FT SCREEN WATCHDOG 2026-10-07
         Acquisition safety only: scoring / thresholds / TOP logic are unchanged. */
      const FT_SCREEN_FIXTURE_TIMEOUT_MS=40000;
      const ftTimedGroupBundle=async(f)=>{
        let timer=null;
        try{return await Promise.race([
          getGroupBundle(f),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('FT_SCREEN_TIMEOUT_40S')),FT_SCREEN_FIXTURE_TIMEOUT_MS)})
        ])}finally{if(timer)clearTimeout(timer)}
      };
      els.loadingText.textContent=`FT 0/${pref.length} • đang lấy dữ liệu API • tối đa 40s/fixture`;
      const bundles=await mapLimit(pref,4,ftTimedGroupBundle,(done,n,f)=>{els.loadingText.textContent=`FT ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});
      if(!bundles.some(b=>!b?.error))throw new Error('FT không lấy được dữ liệu trong 40 giây. Kiểm tra API/quota/mạng rồi thử lại.');
      const screened=await watchSelectUsableBundles(bundles,pref,'FT',WATCH_MAX_ITEMS,watchBundleScore,'FT STATS');const ranked=screened.selected,hs=screened.summary;"""
if old_ft not in s:
    raise SystemExit("FT screening target not found")
s=s.replace(old_ft,new_ft,1)

old_hc="""    try{
      const liveRef=await getBetReference('live'),seeds=(await mapLimit(cand,5,async f=>{
        const temp={id:f.fixture.id,home:f.teams?.home?.name||'',away:f.teams?.away?.name||'',lastMarketRows:[],lastMarketAt:0,marketHistory:[],history:[]};
        const s=await hcFetchSnapshot(temp,f,liveRef,true);return {f,s,temp,rank:hcSeedRank(s)}
      })).filter(Boolean);
      const picked=seeds.sort((a,b)=>b.rank-a.rank).slice(0,HANDICAP_POOL_MAX),preRows=await mapLimit(picked,5,x=>hcLoadPreBaseline(x.f));"""
new_hc="""    try{
      /* FE P2.0.5.5 HANDICAP SCREEN WATCHDOG 2026-10-07
         Acquisition safety only: Team State / GAP / CORE / market-fit formulas are unchanged. */
      const HC_SCREEN_FIXTURE_TIMEOUT_MS=40000,HC_SCREEN_REF_TIMEOUT_MS=20000,HC_SCREEN_PRE_TIMEOUT_MS=20000;
      const hcScreenTimeout=async(factory,ms,code)=>{
        let timer=null;
        try{return await Promise.race([
          Promise.resolve().then(factory),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(code)),ms)})
        ])}finally{if(timer)clearTimeout(timer)}
      };
      els.loadingText.textContent=`HANDICAP 0/${cand.length} • LIVE stats + events + odds • tối đa 40s/fixture`;
      const liveRef=await hcScreenTimeout(()=>getBetReference('live'),HC_SCREEN_REF_TIMEOUT_MS,'HC_REFERENCE_TIMEOUT_20S');
      const seedRows=await mapLimit(cand,5,async f=>hcScreenTimeout(async()=>{
        const temp={id:f.fixture.id,home:f.teams?.home?.name||'',away:f.teams?.away?.name||'',lastMarketRows:[],lastMarketAt:0,marketHistory:[],history:[]};
        const s=await hcFetchSnapshot(temp,f,liveRef,true);return {f,s,temp,rank:hcSeedRank(s)}
      },HC_SCREEN_FIXTURE_TIMEOUT_MS,'HC_SCREEN_TIMEOUT_40S'),(done,n,f)=>{els.loadingText.textContent=`HANDICAP ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});
      const seeds=seedRows.filter(x=>x&&!x.error&&x.f&&x.s);
      if(!seeds.length)throw new Error('HANDICAP không lấy được LIVE data trong 40 giây. Kiểm tra API/quota/mạng rồi thử lại.');
      const picked=seeds.sort((a,b)=>b.rank-a.rank).slice(0,HANDICAP_POOL_MAX);
      els.loadingText.textContent=`HANDICAP PRE 0/${picked.length} • baseline • tối đa 20s/fixture`;
      const preRows=await mapLimit(picked,5,x=>hcScreenTimeout(()=>hcLoadPreBaseline(x.f),HC_SCREEN_PRE_TIMEOUT_MS,'HC_PRE_TIMEOUT_20S'),(done,n,x)=>{els.loadingText.textContent=`HANDICAP PRE ${done}/${n} • ${x?.f?.teams?.home?.name||''} vs ${x?.f?.teams?.away?.name||''}`});"""
if old_hc not in s:
    raise SystemExit("HANDICAP screening target not found")
s=s.replace(old_hc,new_hc,1)

old_pre="""          home_id:f.teams?.home?.id,away_id:f.teams?.away?.id,preBaseline:preRows[idx]||{adv:0,source:'N/A'},history:hcReadHistory(f.fixture.id).concat([s]).slice(-140),latest:s,"""
new_pre="""          home_id:f.teams?.home?.id,away_id:f.teams?.away?.id,preBaseline:preRows[idx]?.error?{adv:0,source:'TIMEOUT'}:(preRows[idx]||{adv:0,source:'N/A'}),history:hcReadHistory(f.fixture.id).concat([s]).slice(-140),latest:s,"""
if old_pre not in s:
    raise SystemExit("HANDICAP pre-baseline target not found")
s=s.replace(old_pre,new_pre,1)

if "</head>" not in s:
    raise SystemExit("Missing </head>")
s=s.replace("</head>",f"<!-- {MARKER} -->\n</head>",1)
p.write_text(s,encoding="utf-8")
print(hashlib.sha256(s.encode()).hexdigest())
