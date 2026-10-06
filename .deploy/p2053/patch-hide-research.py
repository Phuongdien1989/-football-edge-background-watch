#!/usr/bin/env python3
from pathlib import Path
import hashlib, sys

EXPECTED_P2052="a82bf87e1db875fb975b94ac9b6df9e785818de37b7bb55fec6f290efca9c844"
MARKER="FE P2.0.5.3 HIDE RESEARCH CARDS 2026-10-07"
p=Path(sys.argv[1] if len(sys.argv)>1 else "index.html")
s=p.read_text(encoding="utf-8")
sha=hashlib.sha256(s.encode()).hexdigest()
if sha!=EXPECTED_P2052:
    raise SystemExit(f"Refuse patch: expected exact P2052 {EXPECTED_P2052}, got {sha}")
if MARKER in s:
    raise SystemExit("Already patched")

style=r'''
<!-- FE P2.0.5.3 HIDE RESEARCH CARDS 2026-10-07 -->
<style id="fe-p2053-hide-research-cards">
.fmd-card,.mt-intel{
  display:none!important;
  visibility:hidden!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  overflow:hidden!important;
}
</style>
'''
runtime=r'''
<script id="fe-p2053-hide-research-runtime">
(()=>{
  const hide=()=>{
    document.querySelectorAll('.fmd-card,.mt-intel').forEach(el=>{
      el.hidden=true;
      el.style.setProperty('display','none','important');
      el.style.setProperty('visibility','hidden','important');
      el.setAttribute('data-fe-p2053-hidden','1');
    });
  };
  hide();
  new MutationObserver(hide).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',hide);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')hide()});
})();
</script>
'''

if '</head>' not in s: raise SystemExit("Missing </head>")
if '</body>' not in s: raise SystemExit("Missing </body>")
s=s.replace('</head>',style+'</head>',1)
s=s.replace('</body>',runtime+'</body>',1)
p.write_text(s,encoding="utf-8")
print(hashlib.sha256(s.encode()).hexdigest())
