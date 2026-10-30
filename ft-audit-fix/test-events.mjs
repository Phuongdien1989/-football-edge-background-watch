import assert from 'node:assert/strict';
import {observeFT,observeFTStats} from './ft-events.mjs';
const t=1000000,f=(h=1,a=0,phase='2H')=>({goals:{home:h,away:a},fixture:{status:{short:phase,elapsed:70}}});
function item(){return {history:[{captured_at:t-1000}],hcHistory:[1],h1History:[2],cooldown:88,alerts:{x:{armed:false}},ui:{captured_at:t-1000,fixture:f(),snapshot:{fresh_at:t-1000},engines:{FT:{score:85},H1:{score:72}},goal_estimates:{x:{prob:80}}},red:0};}
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
for(const [name,next,red,reason]of [
 ['goal',f(2),0,'GOAL'],['VAR',f(0),0,'SCORE_CORRECTION'],['allocation',f(0,1),0,'SCORE_CORRECTION'],
 ['red',f(),1,'RED_CARD'],['phase',f(1,0,'HT'),0,'PHASE_CHANGE'],['end',f(1,0,'FT'),0,'PHASE_CHANGE']]){
 test(name+' without stats',()=>{const x=item(),before=JSON.stringify([x.hcHistory,x.h1History,x.cooldown,x.alerts,x.ui.engines.H1]);const r=observeFT(x,next,red,t);assert(r.reasons.includes(reason));assert.equal(x.history.length,0);assert.equal(x.ui.engines.FT.score,null);assert.equal(x.ui.goal_estimates.x.prob,null);assert.equal(x.ui.snapshot.fresh_at,t-1000);assert.equal(JSON.stringify([x.hcHistory,x.h1History,x.cooldown,x.alerts,x.ui.engines.H1]),before);});
}
test('red correction',()=>{const x=item();x.red=1;assert(observeFT(x,f(),0,t).reasons.includes('RED_CORRECTION'));});
test('repeat does not extend cooldown',()=>{const x=item();observeFT(x,f(2),null,t);const until=x.ftCooldownUntil;assert(!observeFT(x,f(2),null,t+1000).changed);assert.equal(x.ftCooldownUntil,until);});
test('no fabricated zero score',()=>{const x=item(),old=JSON.stringify(x);observeFT(x,{goals:{home:null,away:0},fixture:{status:{short:'2H'}}},null,t);assert.equal(JSON.stringify(x),old);});
test('missing red is unknown',()=>{const x=item();x.red=1;assert(!observeFT(x,f(),null,t).changed);assert.equal(x.ftObservation.red,1);});
test('out of order cannot reverse score',()=>{const x=item();observeFT(x,f(2),0,t);assert.equal(observeFT(x,f(),0,t-1).reason,'OUT_OF_ORDER');assert.equal(x.ftObservation.goals.home,2);});
test('restart preserves event clock',()=>{const x=item();observeFT(x,f(2),0,t);const y=JSON.parse(JSON.stringify(x));assert(!observeFT(y,f(2),0,t+1000).changed);assert.equal(y.ftCooldownUntil,t+300000);});
test('unchanged stats clock independent from receipt',()=>{const x=item();observeFTStats(x,{shots:4},t);observeFTStats(x,{shots:4},t+60000);assert.equal(x.ftStatsClock.changedAt,t);assert.equal(x.ftStatsClock.receivedAt,t+60000);assert.equal(x.ftStatsClock.sourceAt,null);});
test('changed stats',()=>{const x=item();observeFTStats(x,{shots:4},t);observeFTStats(x,{shots:5},t+1);assert.equal(x.ftStatsClock.changedAt,t+1);});
test('future source time not trusted',()=>{const x=item();observeFTStats(x,{},t,t+1);assert.equal(x.ftStatsClock.sourceAt,null);});
test('honest source timestamp',()=>{const x=item();observeFTStats(x,{},t,t-1);assert.equal(x.ftStatsClock.sourceAt,t-1);});
console.log('FT_EVENT_TESTS_PASS '+n);
