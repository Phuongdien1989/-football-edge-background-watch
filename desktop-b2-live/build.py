#!/usr/bin/env python3
"""Deterministic, additive Desktop B2 build from verified phone production HTML.
No network; baseline HTML is provided as a file and checked by SHA256.
"""
import hashlib, os, pathlib
ROOT=pathlib.Path(__file__).resolve().parent
BASE_SHA='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28'
src=pathlib.Path(os.getenv('B2_BASELINE',ROOT/'baseline.html'))
dst=pathlib.Path(os.getenv('B2_DIST',ROOT/'dist'))
dst.mkdir(parents=True,exist_ok=True)
raw=src.read_bytes()
if hashlib.sha256(raw).hexdigest()!=BASE_SHA:raise SystemExit('FAIL: production frontend baseline hash mismatch; refusing build/deploy')
html=raw.decode('utf-8')
bridge='''  // B2 only: keyed projection of native fixture state. No fetch or persistence.
  if(!window.FE_B2_NATIVE)Object.defineProperty(window,'FE_B2_NATIVE',{value:Object.freeze({
    fixtures:()=>feUICopy((state.fixtures||[]).map(f=>({
      id:f?.fixture?.id??null,home:f?.teams?.home?.name??null,away:f?.teams?.away?.name??null,
      league:f?.league?.name??null,short:f?.fixture?.status?.short??null,
      elapsed:f?.fixture?.status?.elapsed??null,kickoff:f?.fixture?.timestamp??null,
      goalsHome:f?.goals?.home??null,goalsAway:f?.goals?.away??null,
      updatedAt:null // no trusted received_at available for these fixtures
    }))),
    selectedFixtureId:()=>state.selected?.fixture?.id??null,
    selectFixtureById:id=>{const idx=(state.fixtures||[]).findIndex(f=>String(f?.fixture?.id)===String(id));if(idx<0)return false;selectFixture(idx);return true},
    packetReady:()=>Boolean(state.lastPacket),scanning:()=>Boolean(state.scanning)
  }),writable:false,configurable:false});
'''
marker='  // FE_ADDON_BRIDGE_END'
assert html.count(marker)==1,'native bridge anchor drift'
html=html.replace(marker,bridge+'\n'+marker)
scroll="$('analysisCard').scrollIntoView({behavior:'smooth',block:'start'})"
assert html.count(scroll)==1,'native scroll scope anchor drift'
html=html.replace(scroll,"if(!(window.innerWidth>=1200 && document.body.classList.contains('fe-b2-enabled'))) "+scroll)
assert html.count('</head>')==1 and html.count('</body>')==1
html=html.replace('</head>','<link rel="stylesheet" href="/desktop-b2/desktop.css">\n</head>')
html=html.replace('</body>','<script src="/desktop-b2/desktop.js" defer></script>\n</body>')
(dst/'index.html').write_text(html,encoding='utf8')
(dst/'baseline.html').write_bytes(raw)
# Assets from isolated B2 branch only; no demo data, no offline interception.
assets=ROOT/'source'
for asset in ['desktop.css','desktop.js']:
 p=assets/asset
 if not p.is_file():raise SystemExit(f'Missing approved B2 asset: {asset}')
 content=p.read_bytes()
 (dst/'desktop-b2').mkdir(exist_ok=True)
 (dst/'desktop-b2'/asset).write_bytes(content)
# Stub read-only manifest (no Push service worker registration by B2).
manifest='{"name":"Football Edge Desktop B2 Test","short_name":"Football Edge B2","start_url":"/","display":"browser","theme_color":"#f5f8fc","background_color":"#f5f8fc"}'
(dst/'manifest.webmanifest').write_text(manifest)
print('FE_B2_BUILD_PASS',{'baseline_sha256':BASE_SHA,'integrated_bytes':len(html.encode()),'assets':['desktop.css','desktop.js']})
