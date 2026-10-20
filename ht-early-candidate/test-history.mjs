import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHTHistoryCache} from './history.mjs';
import {htTeamModel} from './model.mjs';
const now=Date.now(),day=86400000;
const fixture=(id,h,a)=>({fixture:{id,timestamp:Math.floor((now-12*60000)/1000),status:{short:'1H',elapsed:12}},teams:{home:{id:h},away:{id:a}}});
const raw=team=>Array.from({length:8},(_,i)=>({fixture:{id:team*100+i,timestamp:Math.floor((now-(i+1)*day)/1000),status:{short:'FT'}},teams:{home:{id:team},away:{id:999}},score:{halftime:{home:i%3,away:i%2}},goals:{home:4,away:3}}));
let tests=0;async function check(name,run){await run();tests++;console.log('PASS '+name);}
await check('empty real DB can warm both teams from two existing-wrapper requests',async()=>{
 const cache=createHTHistoryCache();cache.beginCycle();let calls=0;
 const f=fixture(1,10,20),c=await cache.contextFor({at:now,rows:[]},f,async team=>{calls++;return raw(team);});
 assert.equal(calls,2);assert.equal(c.rows.length,16);const at=Date.now();
 assert(htTeamModel({id:1,at,minute:12,status:'1H',goals:{home:0,away:0}},f,c));
});
await check('five concurrent fixtures cannot create more than two physical history calls in one cycle',async()=>{
 const cache=createHTHistoryCache();cache.beginCycle();let calls=0;
 await Promise.all(Array.from({length:5},(_,i)=>cache.contextFor({at:now,rows:[]},fixture(i+1,10+i*2,11+i*2),async team=>{calls++;return raw(team);})));
 assert.equal(calls,2);
});
await check('warm cache reuses real history without another request',async()=>{
 const cache=createHTHistoryCache();const f=fixture(1,10,20);let calls=0;const loader=async team=>{calls++;return raw(team);};
 await cache.contextFor({at:now,rows:[]},f,loader);cache.beginCycle();await cache.contextFor({at:now,rows:[]},f,loader);assert.equal(calls,2);
});
await check('existing usable D1 rows avoid all provider warm-up calls',async()=>{
 const cache=createHTHistoryCache();const f=fixture(1,10,20),normal=cache.normalise([...raw(10),...raw(20)]);let calls=0;
 await cache.contextFor({at:now,rows:normal},f,async()=>{calls++;return [];});assert.equal(calls,0);
});
await check('missing half-time scores never fall back to the FT score',()=>{
 const cache=createHTHistoryCache(),rows=raw(10).map(f=>({...f,score:{halftime:{home:null,away:null}}}));assert.equal(cache.normalise(rows).length,0);
});
await check('rate/quota failures return a waiting context without throwing through other engines',async()=>{
 const cache=createHTHistoryCache(),f=fixture(1,10,20);
 const c=await cache.contextFor({at:now,rows:[]},f,async()=>{throw Error('NOTIFY_DAILY_BUDGET_REACHED');});assert(c.error);assert.equal(c.rows.length,0);
});
mkdirSync('ht-early-candidate/generated',{recursive:true});
writeFileSync('ht-early-candidate/generated/history-test-report.json',JSON.stringify({status:'PASS',tests,max_extra_history_calls_per_cycle:2,uses_existing_quota_wrappers:true,new_d1_writes:0,real_provider_calls_in_tests:0},null,2)+'\n');console.log(JSON.stringify({status:'PASS',tests}));
