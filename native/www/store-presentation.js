(()=>{
  'use strict';

  // Football Edge App Store Edition presentation layer.
  // IMPORTANT: this file changes Store-facing wording only. It does NOT alter
  // engine enums, scores, thresholds, calibration, DQ, ranking or live-state logic.
  const C=window.Capacitor;
  const isNative=!!(C&&typeof C.isNativePlatform==='function'&&C.isNativePlatform());
  const storeMeta=document.querySelector('meta[name="football-edge-store-edition"]');
  const isStore=isNative&&String(storeMeta?.content||'').trim()==='1';
  if(!isStore)return;

  document.documentElement.dataset.feStoreEdition='1';
  document.body?.classList.add('fe-store-edition');

  const exact=new Map([
    ['ENTRY SUITABLE','STRONG SIGNAL'],
    ['SUITABLE','STRONG SIGNAL'],
    ['WAIT_PRICE','MARKET CONFIRMATION PENDING'],
    ['WAIT PRICE','MARKET CONFIRMATION PENDING'],
    ['WAIT_CONFIRM','CONFIRMATION PENDING'],
    ['WAIT CONFIRM','CONFIRMATION PENDING'],
    ['PASS','INSUFFICIENT EVIDENCE'],
    ['MARKET ODDS','MARKET CONTEXT'],
    ['ODDS MARKET','MARKET CONTEXT'],
    ['BET TRACKER','SIGNAL HISTORY'],
    ['P&L','SIGNAL ACCURACY']
  ]);

  const patterns=[
    [/\bENTRY\s+SUITABLE\b/gi,'STRONG SIGNAL'],
    [/\bWAIT[_\s-]*PRICE\b/gi,'MARKET CONFIRMATION PENDING'],
    [/\bWAIT[_\s-]*CONFIRM\b/gi,'CONFIRMATION PENDING'],
    [/\bMARKET\s+ODDS\b/gi,'MARKET CONTEXT'],
    [/\bBET\s+TRACKER\b/gi,'SIGNAL HISTORY']
  ];

  function translateString(input){
    const raw=String(input??'');
    const trimmed=raw.trim();
    if(!trimmed)return raw;
    const direct=exact.get(trimmed.toUpperCase());
    if(direct){
      const lead=raw.match(/^\s*/)?.[0]||'';
      const tail=raw.match(/\s*$/)?.[0]||'';
      return lead+direct+tail;
    }
    let out=raw;
    for(const [re,repl] of patterns)out=out.replace(re,repl);
    return out;
  }

  function patchTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||parent.closest('script,style,noscript,textarea,input'))return;
    const next=translateString(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  }

  function patchElement(el){
    if(!el||el.nodeType!==Node.ELEMENT_NODE)return;
    if(el.matches('script,style,noscript,textarea,input'))return;
    for(const attr of ['title','aria-label','data-label']){
      if(el.hasAttribute(attr)){
        const old=el.getAttribute(attr),next=translateString(old);
        if(next!==old)el.setAttribute(attr,next);
      }
    }
    for(const n of el.childNodes)if(n.nodeType===Node.TEXT_NODE)patchTextNode(n);
  }

  function patchTree(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){patchTextNode(root);return}
    patchElement(root);
    root.querySelectorAll?.('*').forEach(patchElement);
  }

  patchTree();

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      if(m.type==='characterData')patchTextNode(m.target);
      for(const n of m.addedNodes){
        if(n.nodeType===Node.TEXT_NODE)patchTextNode(n);
        else if(n.nodeType===Node.ELEMENT_NODE)patchTree(n);
      }
    }
  });
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  window.FE_STORE_EDITION=Object.freeze({
    version:'S2.0',
    active:true,
    mode:'compile-time-store-edition',
    presentationOnly:true,
    engineUntouched:true
  });
})();
