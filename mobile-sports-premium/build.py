from pathlib import Path
import hashlib,re,sys
root=Path(__file__).resolve().parent
base=Path(sys.argv[1] if len(sys.argv)>1 else root/'baseline.html')
raw=base.read_bytes()
expected='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28'
actual=hashlib.sha256(raw).hexdigest()
assert actual==expected,f'Mobile production baseline drift! {actual}'
s=raw.decode('utf-8')
# Preview-specific cleanup: the original app itself remains present; block automatic PWA and registration only on this origin.
auto="window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));"
assert s.count(auto)==1,'Autoregistration anchor drift'
s=s.replace(auto,"/* PREVIEW ISOLATED: main service worker autoregistration disabled */")
reg="const reg=await navigator.serviceWorker.register(FE_PUSH_P02.sw,{scope:FE_PUSH_P02.scope});"
assert s.count(reg)==1,'Push registration anchor drift'
s=s.replace(reg,"throw new Error('PREVIEW: Push registration disabled; use installed production app for Push');")
# Preview-only guard: opening/reopening the site must not silently sync to production.
# Explicit native buttons remain available in connected mode; only passive startup/
# visibility handlers and QSIG registration on a timer are disabled.
passive=[
 "setTimeout(()=>{if(bgEnabled())bgSyncNow({silent:true})},900);",
 "if(document.visibilityState==='visible'&&Date.now()-Number(BG_STATE.lastSyncAt||0)>15000)bgSyncNow({silent:true})",
 "setInterval(()=>{feEvidenceRegisterPending().catch(e=>log('QSIG evidence registration error',e.message))},60000);",
 "setTimeout(()=>{feEvidenceRegisterPending().catch(e=>log('QSIG evidence registration error',e.message))},5000);",
]
for expression in passive:
    assert s.count(expression)==1, 'Passive sync anchor drift: '+expression[:90]
    s=s.replace(expression, '/* SPORTS PREMIUM PREVIEW: passive network/sync disabled */')
assert 'bgSyncNow({silent:false})' in s, 'Explicit sync should remain available'
# One scoped native presentation bridge, no engine render/API and no duplicated DOM listener.
sp_anchor='  // FE_ADDON_BRIDGE_END'
assert s.count(sp_anchor)==1,'Native addon anchor drift'
sp_bridge="""  // SPORTS_PREMIUM_PREVIEW_NATIVE_SELECTION_BRIDGE — UI-only, no network.
  if(!window.FE_SP_NATIVE)Object.defineProperty(window,'FE_SP_NATIVE',{value:Object.freeze({
    selectById:id=>{const index=state.fixtures.findIndex(f=>Number(f?.fixture?.id)===Number(id));if(index<0)return false;selectFixture(index);return true;},
    selectedId:()=>state.selected?.fixture?.id??null
  }),writable:false,configurable:false});
"""
s=s.replace(sp_anchor,sp_bridge+sp_anchor)
css=(root/'source/premium.css').read_text();js=(root/'source/premium.js').read_text()
assert '<style' not in css.lower() and '</script' not in js.lower()
assert s.count('</head>')==1 and s.count('</body>')==1
s=s.replace('</head>','<style id="FE_SP_PREMIUM_CSS">\n'+css+'\n</style>\n</head>')
s=s.replace('</body>','<script id="FE_SP_PREMIUM_JS">\n'+js+'\n</script>\n</body>')
s=s.replace('<title>','<title>PREVIEW • Sports Premium | ',1)
dest=root/'site';dest.mkdir(exist_ok=True)
(dest/'index.html').write_text(s)
(dest/'baseline.sha256').write_text(expected+'  baseline.html\n')
print('FE_SP_BUILD_PASS',{'base_sha256':expected,'preview_sha256':hashlib.sha256(s.encode()).hexdigest(),'size':len(s.encode()),'no_serviceworker_registration':"navigator.serviceWorker.register('./sw.js')" not in s,'production_mutated':False})
