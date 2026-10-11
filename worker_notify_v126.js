import base,{BackgroundWatcher as ResilientWatcher} from './worker_notify_v125.js';

// P0.4: transient upstream resilience for strict provider calls.
// Stable scoring, thresholds, calibration and push logic remain inherited unchanged.
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const message=e=>String(e?.message||e||'UNKNOWN').slice(0,120);
const retryable=e=>typeof e?.retryable==='boolean'?e.retryable:/EVIDENCE_PROVIDER_ERROR|API HTTP 429|API HTTP 5\d\d|AbortError|aborted|timeout|network|fetch failed/i.test(message(e));

export class BackgroundWatcher extends ResilientWatcher{
  async api(path,params={},strict=false){
    const liveDiscovery=path==='/fixtures'&&String(params?.live||'').toLowerCase()==='all';
    const attempts=liveDiscovery&&strict?3:strict?2:1;
    let lastError=null;
    for(let attempt=1;attempt<=attempts;attempt++){
      try{return await super.api(path,params,strict)}
      catch(e){
        lastError=e;
        if(attempt>=attempts||!retryable(e))break;
        const delay=Math.max(attempt===1?450:1100,Number(e?.retryAfterMs||0));
        // Preserve bounded LIVE recovery without holding an entire snapshot
        // across a long provider cooldown or retrying an exhausted minute.
        if(delay>10000)break;
        await sleep(delay);
      }
    }
    if(liveDiscovery){
      // Never convert an upstream failure into a fake zero-live scan.
      throw new Error(`LIVE_DISCOVERY_UPSTREAM_ERROR:${message(lastError)}`);
    }
    throw lastError;
  }
}

export default base;
