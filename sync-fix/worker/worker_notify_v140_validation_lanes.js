import base,{BackgroundWatcher as AccuracyWatcher} from './worker_notify_v139_accuracy.js';

// Validation has its own alarm invocation so LIVE/Smart Follow subrequests
// cannot exhaust Cloudflare's invocation limit before measurement runs.
// All API requests retain the same durable daily counters and strict parser.
export class BackgroundWatcher extends AccuracyWatcher{
  async resolveDueValidations(){if(this._scanAlarmLane)return;return super.resolveDueValidations()}
  async accuracyTick(){if(this._scanAlarmLane)return;return super.accuracyTick()}
  async accuracySummary(){return {...await super.accuracySummary(),validation_execution:'SEPARATE_ALARM_V1',validation_lane:await this.ctx.storage.get('accuracy:lane-status')||null}}
  async alarm(){
    const control=await this.scanControl();
    if(control?.enabled===false){await this.ctx.storage.delete('accuracy:alarm-lane');return super.alarm()}
    const lane=await this.ctx.storage.get('accuracy:alarm-lane');
    if(lane?.kind==='VALIDATION'){
      try{
        await super.resolveDueValidations();
        await super.accuracyTick();
        await this.ctx.storage.put('accuracy:lane-status',{at:Date.now(),kind:'VALIDATION',ok:true});
      }catch(e){
        await this.ctx.storage.put('accuracy:lane-status',{at:Date.now(),kind:'VALIDATION',ok:false,error:String(e.message).slice(0,140)});
        console.log('Separate validation alarm failed',String(e.message).slice(0,140));
      }finally{
        await this.ctx.storage.delete('accuracy:alarm-lane');
        if((await this.scanControl())?.enabled!==false&&lane.normal_due)await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,lane.normal_due));
      }
      return;
    }
    this._scanAlarmLane=true;
    try{await super.alarm()}finally{this._scanAlarmLane=false}
    if((await this.scanControl())?.enabled===false)return;
    const normalDue=await this.ctx.storage.getAlarm();
    // Preserve the inherited HOT/NORMAL next due time; only insert a separate
    // short validation invocation between normal scan alarms.
    if(normalDue){
      await this.ctx.storage.put('accuracy:alarm-lane',{kind:'VALIDATION',normal_due:normalDue});
      await this.ctx.storage.setAlarm(Date.now()+1000);
    }
  }
}
export default base;
