import base,{BackgroundWatcher as ScanControlWatcher} from './worker_notify_v127.js';

// P0.6: normalize every notification deep-link to the current frontend host.
// Scoring, thresholds, calibration, scan control and push transport remain inherited unchanged.
const FRONTEND_APP='https://shiny-silence-d892.ngophuonghuy.workers.dev';

function frontendUrl(raw){
  try{
    const u=new URL(String(raw||''),FRONTEND_APP);
    const path=(u.pathname||'/')+(u.search||'')+(u.hash||'');
    return new URL(path,FRONTEND_APP).href;
  }catch{return FRONTEND_APP+'/?source=push'}
}

export class BackgroundWatcher extends ScanControlWatcher{
  async send(device,payload){
    const p={...(payload||{}),url:frontendUrl(payload?.url)};
    return super.send(device,p);
  }
}

export default base;
