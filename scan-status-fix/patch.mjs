import assert from 'node:assert/strict';
export function patchStatus(files){
 const p='worker_notify_v130.js',q='worker_notify_v138_peak_window.js';let s=files[p],t=files[q];
 const once=(text,before,after)=>{assert.equal(text.split(before).length,2,'PATCH_SCOPE');return text.replace(before,after);};
 s=once(s,'  async devices(){',`  async notifyStatusView(){
    const persisted=await this.ctx.storage.get('notify:status');
    const latest=this._notifyLatestCompletedStatus;
    // Never manufacture a heartbeat from a GET or from provider traffic.
    // A later persisted pause/control transition wins over the local cycle.
    return latest&&Number(latest.at)>Number(persisted?.at||0)?latest:persisted;
  }

  async devices(){`);
 s=once(s,"      return reply(d,r.status);\n    }\n    return super.fetch(request);", "      const latest=await this.notifyStatusView();\n      return reply({...d,scan:{...(d.scan||{}),...(latest||{})}},r.status);\n    }\n    return super.fetch(request);");
 s=once(s,"    const priorStatus=await this.ctx.storage.get('notify:status');", "    this._notifyLatestCompletedStatus=status;\n    const priorStatus=await this.ctx.storage.get('notify:status');");
 s=once(s,'status.at-Number(priorStatus.at)>=120000','status.at-Number(priorStatus.at)>=60000');
 s=once(s,"    if(statusDue||urgentChanged)await this.ctx.storage.put('notify:status',status);", "    const recovered=Boolean(priorStatus?.errors?.length)&&status.errors.length===0;\n    if(statusDue||urgentChanged||recovered)await this.ctx.storage.put('notify:status',status);");
 t=once(t,"const budget=await this.notifyBudgetView(),status=await this.ctx.storage.get('notify:status');", "const budget=await this.notifyBudgetView(),status=await this.notifyStatusView();");
 return {...files,[p]:s,[q]:t};
}
