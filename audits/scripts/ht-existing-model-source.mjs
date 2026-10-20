import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const s=readFileSync('ft-overview/frozen-original-mobile.html','utf8');
const names=[...s.matchAll(/  (?:async )?function ([A-Za-z0-9_]+)\(/g)].map(m=>({name:m[1],at:m.index}));
const selected=names.filter(x=>/^gp|^recent|fixture.*Compact/i.test(x.name));
const blocks=selected.map(x=>{const next=names.find(y=>y.at>x.at);return {name:x.name,source:s.slice(x.at,next?.at??s.length).slice(0,16000)};});
mkdirSync('ht-early-candidate/generated',{recursive:true});
writeFileSync('ht-early-candidate/generated/existing-model-source.json',JSON.stringify(blocks,null,2));
console.log('HT_MODEL_AUDIT '+JSON.stringify(blocks));
