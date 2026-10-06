#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED_P2053="ab02d1eb428048bd00a69f56c3e5a16bed3c107feb66110c3ab08a9e84a05069"
# Runtime watchdog is UI-flow safety only; engine scoring remains unchanged.\nMARKER="FE P2.0.5.4 H1 SCREEN WATCHDOG 2026-10-07"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED_P2053:
    raise SystemExit(f"Refuse patch: expected exact P2053 {EXPECTED_P2053}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

old="""      const bundles=await mapLimit(pref,4,getGroupBundle,(done,n,f)=>{els.loadingText.textContent=`H1 ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});
      const screened=await watchSelectUsableBundles(bundles,pref,'H1',H1_WATCH_MAX_ITEMS,h1WatchBundleScore,'H1 STATS'),ranked=screened.selected,hs=screened.summary;"""

new="""      /* FE P2.0.5.4 H1 SCREEN WATCHDOG 2026-10-07
         H1 screening must never leave the blocking overlay spinning indefinitely.
         Current getGroupBundle can require two API phases; cap each fixture at 40s.
         A timed-out fixture becomes an ordinary screening error and the outer finally
         still closes the overlay. Scoring / thresholds / TOP logic are unchanged. */
      const H1_SCREEN_FIXTURE_TIMEOUT_MS=40000;
      const h1TimedGroupBundle=async(f)=>{
        let timer=null;
        try{
          return await Promise.race([
            getGroupBundle(f),
            new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('H1_SCREEN_TIMEOUT_40S')),H1_SCREEN_FIXTURE_TIMEOUT_MS)})
          ]);
        }finally{if(timer)clearTimeout(timer)}
      };
      els.loadingText.textContent=`H1 0/${pref.length} • đang lấy dữ liệu API • tối đa 40s/fixture`;
      const bundles=await mapLimit(pref,4,h1TimedGroupBundle,(done,n,f)=>{els.loadingText.textContent=`H1 ${done}/${n} • ${f?.teams?.home?.name||''} vs ${f?.teams?.away?.name||''}`});
      if(!bundles.some(b=>!b?.error))throw new Error('H1 không lấy được dữ liệu trong 40 giây. Kiểm tra API/quota/mạng rồi thử lại.');
      const screened=await watchSelectUsableBundles(bundles,pref,'H1',H1_WATCH_MAX_ITEMS,h1WatchBundleScore,'H1 STATS'),ranked=screened.selected,hs=screened.summary;"""

if old not in s:
    raise SystemExit("H1 screening target not found")
s=s.replace(old,new,1)
s=s.replace("</head>",f"<!-- {MARKER} -->\n</head>",1)
p.write_text(s,encoding="utf-8")
print(hashlib.sha256(s.encode()).hexdigest())
