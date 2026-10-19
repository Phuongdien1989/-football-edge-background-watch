import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baselinePath=process.argv[2];
if(!baselinePath)throw Error('Pass the pinned original Mobile HTML path');
let html=readFileSync(baselinePath,'utf8');
const sha=createHash('sha256').update(html).digest('hex');
if(sha!=='aa4f0f6318cd52c14ff62b195c5ea04c5267107455924da44c9aa78169fe7f28')throw Error('MOBILE_BASELINE_HASH_MISMATCH');
// Add only a detached whitelist read bridge inside the existing closure.
// Cache observation time when the actual lastBundle object changes, never on render.
const anchor='  // FE_UI_READ_BRIDGE_END';
if(html.split(anchor).length!==2)throw Error('BRIDGE_ANCHOR_NOT_UNIQUE');
const bridge=`
  // FE_OVERVIEW_INPUT_BRIDGE_START
  const foBundleTimes=new WeakMap();
  Object.defineProperty(window,'FEOverviewInputBridge',{value:Object.freeze({read:()=>{
    const b=state.lastBundle;if(!b)return [];
    return feUICopy([{observed_at:foBundleTimes.get(b)??null,meta:b.meta,normalized:{home_recent:b.normalized?.home_recent,away_recent:b.normalized?.away_recent,market:b.normalized?.market}}]);
  }}),writable:false,configurable:false});
  // FE_OVERVIEW_INPUT_BRIDGE_END
`;
html=html.replace(anchor,anchor+bridge);
// Timestamp at actual bundle assignment; reading an old bundle never refreshes it.
const assignment='state.lastBundle=bundle;';
if(html.split(assignment).length!==3)throw Error('BUNDLE_ASSIGNMENT_ANCHOR_DRIFT');
const observed='state.lastBundle=bundle;foBundleTimes.set(bundle,Date.now());';
html=html.replaceAll(assignment,observed);
const target='<section id="ftOverviewCard" data-ft-overview aria-label="FT Overview thử nghiệm"></section>';
const marker=html.match(/<(?:section|div)[^>]*id=["']liveWatchCard["'][^>]*>/)?.[0];
if(!marker)throw Error('FT_CARD_ANCHOR_MISSING');
html=html.replace(marker,target+'\n'+marker);
html=html.replace('</head>','<link rel="stylesheet" href="./ft-overview/style.css">\n</head>');
html=html.replace('</body>','<script type="module" src="./ft-overview/ui.mjs"></script>\n</body>');
mkdirSync('ft-overview/build/ft-overview',{recursive:true});
writeFileSync('ft-overview/build/index.html',html);
for(const p of ['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css'])copyFileSync('ft-overview/'+p,'ft-overview/build/ft-overview/'+p);
// Verify exact reconstruction of the baseline after removing only additions.
let reconstructed=html.replace(bridge,'').replaceAll(observed,assignment).replace(target+'\n','').replace('<link rel="stylesheet" href="./ft-overview/style.css">\n','').replace('<script type="module" src="./ft-overview/ui.mjs"></script>\n','');
if(reconstructed!==readFileSync(baselinePath,'utf8'))throw Error('UNEXPECTED_BASELINE_MUTATION');
console.log(JSON.stringify({baseline_sha256:sha,reconstruction:'PASS',new_assets:6,backend_changes:0,production_deploy:false}));
