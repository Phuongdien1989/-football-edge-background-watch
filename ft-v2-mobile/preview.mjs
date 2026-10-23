// Preview sandbox. No use of Window.FEUIReadBridge, production tabs or API.
// ?mode=live renders the explicitly empty real-data state rather than mock bets.
import {mountFTPreview} from './ui.mjs';
import {demoFTPacket} from './demo-data.mjs';
import {mapFTLiveRows} from './read-model.mjs';
const root=document.getElementById('ftv2-root');
if(!root)throw Error('FT_PREVIEW_ROOT_NOT_FOUND');
const live=new URLSearchParams(location.search).get('mode')==='live';
const packet=live?mapFTLiveRows([]):demoFTPacket;
const app=mountFTPreview(root,{packet,demo:!live});
window.FT_V2_PREVIEW_READ_ONLY={mode:live?'LIVE_EMPTY':'SYNTHETIC_DEMO',getState:app.getState};
