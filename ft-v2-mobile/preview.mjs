// Isolated local browser FT preview. DEMO is explicitly synthetic;
// ?mode=live reads only the EXISTING FT watch state when its read bridge is
// already present on the same page. It does not start scanner, fetch, or write.
import {mountFTPreview} from './ui.mjs';
import {demoFTPacket} from './demo-data.mjs';
import {readExistingFTWatch} from './legacy-bridge.mjs';
const root=document.getElementById('ftv2-root');
if(!root)throw Error('FT_PREVIEW_ROOT_NOT_FOUND');
const live=new URLSearchParams(location.search).get('mode')==='live';
const readPacket=live?()=>readExistingFTWatch(window.FEUIReadBridge):null;
const app=mountFTPreview(root,{
 packet:live?readPacket():demoFTPacket,
 demo:!live,
 readPacket
});
window.FT_V2_PREVIEW_READ_ONLY={
 mode:live?'EXISTING_FT_WATCH_READ_ONLY':'SYNTHETIC_DEMO',
 getState:app.getState,
 refresh:app.refresh
};
