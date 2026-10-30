import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {patchHCContracts} from '../hc-contracts/patch.mjs';
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
  const foBundleTimes=new WeakMap(),foBundles=new Map();
  const foRemember=b=>{const at=Date.now(),id=Number(b?.meta?.fixture_id);foBundleTimes.set(b,at);if(id){foBundles.delete(id);foBundles.set(id,feUICopy({observed_at:at,meta:b.meta,normalized:{home_recent:b.normalized?.home_recent,away_recent:b.normalized?.away_recent,market:b.normalized?.market}}));while(foBundles.size>50)foBundles.delete(foBundles.keys().next().value);}};
  Object.defineProperty(window,'FEOverviewInputBridge',{value:Object.freeze({read:()=>{
    const b=state.lastBundle;if(!b)return [];
    return feUICopy([...foBundles.values()]);
  },readControls:()=>feUICopy([...watchState.items,...h1WatchState.items,...handicapWatchState.pool].map(x=>({id:x.id,cooldownUntil:x.cooldownUntil??0,resetAt:x.resetAt??0})))}),writable:false,configurable:false});
  // FE_OVERVIEW_INPUT_BRIDGE_END
`;
html=html.replace(anchor,anchor+bridge);
// Timestamp at actual bundle assignment; reading an old bundle never refreshes it.
const assignment='state.lastBundle=bundle;';
if(html.split(assignment).length!==3)throw Error('BUNDLE_ASSIGNMENT_ANCHOR_DRIFT');
const observed='state.lastBundle=bundle;foRemember(bundle);';
html=html.replaceAll(assignment,observed);
const target='<details class="card fo-native" id="ftOverviewCard"><summary class="fo-native-head"><span class="fo-native-icon">◈</span><span><strong>FT OVERVIEW</strong><small>Nhận định toàn trận • Data × Market</small></span><span class="fo-native-toggle">OPEN</span></summary><div data-ft-overview data-fo-integrated aria-label="FT Overview thử nghiệm"></div></details>';
const marker=html.match(/<(?:section|div)[^>]*id=["']h1WatchCard["'][^>]*>/)?.[0];
if(!marker)throw Error('FT_CARD_ANCHOR_MISSING');
html=html.replace(marker,target+'\n'+marker);
html=html.replace('</head>','<link rel="stylesheet" href="./ft-overview/style.css">\n</head>');
html=html.replace('</body>','<script type="module" src="./ft-overview/ui.mjs"></script>\n</body>');
mkdirSync('ft-overview/build/ft-overview',{recursive:true});
writeFileSync('ft-overview/build/index.html',patchHCContracts(html).html);
for(const p of ['core.mjs','adapter.mjs','charts.mjs','demo.mjs','ui.mjs','style.css','experimental-decision.mjs','live-probability.mjs'])copyFileSync('ft-overview/'+p,'ft-overview/build/ft-overview/'+p);
// Verify exact reconstruction of the baseline after removing only additions.
let reconstructed=html.replace(bridge,'').replaceAll(observed,assignment).replace(target+'\n','').replace('<link rel="stylesheet" href="./ft-overview/style.css">\n','').replace('<script type="module" src="./ft-overview/ui.mjs"></script>\n','');
if(reconstructed!==readFileSync(baselinePath,'utf8'))throw Error('UNEXPECTED_BASELINE_MUTATION');
console.log(JSON.stringify({baseline_sha256:sha,reconstruction:'PASS',new_assets:8,backend_changes:0,production_deploy:false}));

