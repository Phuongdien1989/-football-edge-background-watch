from pathlib import Path
def edit(p,old,new):
 f=Path(p);s=f.read_text()
 if s.count(old)!=1:raise SystemExit(f'PATCH_ANCHOR_INVALID:{p}:{s.count(old)}')
 f.write_text(s.replace(old,new,1))
p='staging_kit/batch041-budget-controller.js'
edit(p,'this.state=null;this.initialized=false;', 'this.selectionMode=false;this.state=null;this.initialized=false;')
edit(p,"  async acquire({kind=", "  setSelectionMode(v){this.selectionMode=Boolean(v)}\n  async acquire({kind=")
edit(p,"if(this.state.total_requests>=Number(this.limits.max_requests_total))return stop('TOTAL_REQUEST_CAP');","if(this.state.total_requests>=Number(this.limits.max_requests_total))return stop('TOTAL_REQUEST_CAP');\n        if(this.selectionMode&&(Number(this.state.selection_attempts||0)>=20||this.state.total_requests>=Number(this.limits.max_requests_total)-20))return {error:'SELECTION_RESERVE_GUARD'};")
edit(p,'this.state.total_requests+=1;this.state.in_flight=', 'this.state.total_requests+=1;if(this.selectionMode)this.state.selection_attempts=Number(this.state.selection_attempts||0)+1;this.state.in_flight=')
p='staging_kit/batch04-collector-worker.js'
edit(p,"import {buildCapturedPayload} from '../prediction_v2/capture-contract.js';","import {buildCapturedPayload} from '../prediction_v2/capture-contract.js';\nimport {evaluateFixture,deriveMatchPhase} from './fixture-eligibility-selector.js';")
edit(p,'pinnedFixtureId=null}={}){\n  if(!budget)', 'pinnedFixtureId=null,eligibleMode=false}={}){\n  if(!budget)')
edit(p,"  const quota=await fetchProviderQuota({env,db,captureSink,budget,fetchImpl});\n  if(!quota.verified){await budget.halt(quota.reason);return {status:'STOP',reason:quota.reason,records:[quota.record],pinned_fixture_id:pinnedFixtureId,budget:budget.snapshot()}}","  if(eligibleMode&&pinnedFixtureId==null)budget.setSelectionMode(true);\n  const quota=await fetchProviderQuota({env,db,captureSink,budget,fetchImpl});\n  if(!quota.verified){await budget.halt(quota.reason);return {status:'STOP',reason:quota.reason,records:[quota.record],pinned_fixture_id:pinnedFixtureId,budget:budget.snapshot()}}")
f=Path(p);s=f.read_text()
old='  const selected=pinnedFixtureId==null?(ids[0]??null):Number(pinnedFixtureId);'
if s.count(old)!=1:raise SystemExit('SELECTOR_ANCHOR_NOT_UNIQUE')
injection="""  if(eligibleMode&&pinnedFixtureId==null){
    for(const f of live.filter(x=>deriveMatchPhase(x))){
      const fid=Number(f.fixture.id),probes={};
      for(const [endpoint,role] of [['/fixtures/statistics','LIVE_STATS'],['/fixtures/events','EVENTS'],['/odds/live','LIVE_MARKET']]){
        if(Number(budget.snapshot().selection_attempts||0)>=20||Number(budget.snapshot().total_requests)>=20)break;
        const r=await providerGet({env,db,captureSink,budget,endpoint,params:{fixture:fid},fixtureId:fid,metadata:{role,identity:{fixture_id:fid},selection_probe:true},fetchImpl,retries:0});records.push(r);probes[endpoint]=r;
      }
      if(!probes['/fixtures/statistics']||!probes['/fixtures/events']){if(Number(budget.snapshot().selection_attempts||0)>=20)break;continue}
      const result=await evaluateFixture({fixture:f,discovery,stats:probes['/fixtures/statistics'],events:probes['/fixtures/events'],market:probes['/odds/live'],cutoff:new Date(budget.clock.now()).toISOString()});
      if(result.football_eligible){budget.setSelectionMode(false);return {status:'OK',selection_only:true,records,pinned_fixture_id:fid,fixture:f,eligibility:result,match_phase:result.match_phase,discovery_fixture_ids:ids,selection_policy:'FIRST_PAYLOAD_ELIGIBLE_NO_LOW_ACTIVITY_FILTER',budget:budget.snapshot()}}
    }
    budget.setSelectionMode(false);await budget.halt('NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET');return {status:'STOP',reason:'NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET',records,pinned_fixture_id:null,budget:budget.snapshot()};
  }
"""
f.write_text(s.replace(old,injection+old,1))
edit(p,'  const fixture=live.find(x=>Number(x.fixture.id)===selected);',"  const fixture=live.find(x=>Number(x.fixture.id)===selected);\n  if(eligibleMode&&!deriveMatchPhase(fixture))return {status:'STOP',reason:'PINNED_FIXTURE_NOT_LIVE',records,pinned_fixture_id:selected,budget:budget.snapshot()};")
p='prediction_v2/observation-contract.js'
edit(p,'status:state?.status??null,match_clock:',"status:state?.status??null,...(state?.match_phase?{match_phase:state.match_phase}:{}),match_clock:")
p='prediction_v2/shadow-evidence.js'
edit(p,'status:s?.status??packet?.state?.status??null},',"status:s?.status??packet?.state?.status??null,...(s?.match_phase?{match_phase:s.match_phase}:{})},")
p='staging_kit/batch05a-smoke-orchestrator.mjs'
edit(p,"import {capturePinnedSmokeTick} from './batch04-collector-worker.js';","import {capturePinnedSmokeTick} from './batch04-collector-worker.js';\nimport {deriveMatchPhase} from './fixture-eligibility-selector.js';")
edit(p,"ackMode='LOCAL'}={}){","ackMode='LOCAL',eligiblePilot=false}={}){")
edit(p,'pinnedFixtureId:pinned});if(pinned==null','pinnedFixtureId:pinned,eligibleMode:eligiblePilot});if(pinned==null')
edit(p,"      if(tick.status!=='OK'){stopReason","      if(eligiblePilot&&tick.selection_only){session.selection_eligibility=tick.eligibility;await sessionStore.save(session);if(owner)await owner.renew();i--;continue}\n      if(tick.status!=='OK'){stopReason")
edit(p,'const item={id:pinned,latest:{minute:',"const item={id:pinned,latest:{match_phase:eligiblePilot?deriveMatchPhase(tick.fixture):null,minute:")
edit(p,'pinned_fixture_id:pinned,detailed_fixture_count:pinned==null?0:1,budget:snap,',"pinned_fixture_id:pinned,detailed_fixture_count:pinned==null?0:1,budget:snap,eligible_pilot:eligiblePilot,selection_eligibility:session?.selection_eligibility??null,match_phase:session?.selection_eligibility?.match_phase??null,")
print('STAGING ELIGIBLE OVERLAY APPLIED')
