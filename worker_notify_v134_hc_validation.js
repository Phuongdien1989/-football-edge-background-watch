import base,{BackgroundWatcher as ScanControlWatcher} from './worker_notify_v133_scan_control.js';
import {hcEndStateGuard,classifyHcEnd} from './hc-validation-guard.js';

// V1.34: HC validation integrity hardening.
// Shadow validation only: LIVE GAP scoring, thresholds, notification decisions,
// calibration, scan cadence, pause/resume and push transports remain unchanged.

export class BackgroundWatcher extends ScanControlWatcher{
  async resolveGapValidation(key,v){
    const item=await this.ctx.storage.get('notify:match:'+v.fixture_id);
    const guard=hcEndStateGuard(item,Date.now());
    const start=Number(v?.gap_signed),threshold=Number.isFinite(Number(v?.threshold))?Number(v.threshold):70;

    if(!Number.isFinite(start))return this.deferValidation(key,v,'HC_START_GAP_INVALID');
    if(!guard.ready)return this.deferValidation(key,v,guard.reason);

    const out=classifyHcEnd(start,guard.end,threshold);
    if(!out.state)return this.deferValidation(key,v,out.reason||'HC_END_GAP_INVALID');

    return this.finishValidation(key,v,out.state,{
      gap_end:out.gap_end,
      gap_start:out.gap_start,
      gap_delta:out.gap_delta,
      state_age_ms:guard.age,
      end_data_tier:guard.data_tier,
      validation_integrity:'HC_END_STATE_GUARDED_V1'
    });
  }
}

export default base;
