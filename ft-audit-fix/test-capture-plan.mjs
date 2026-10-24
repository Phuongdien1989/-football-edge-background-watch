import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {planFTCaptureBatch} from './capture-plan.mjs';
const f=(id,priority=false)=>({fixture_id:id,priority});
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('zero budget records no fixture, enumerates deferred',()=>{const x=planFTCaptureBatch([f(1),f(2)],{maxPairs:0});assert.deepEqual(x.selected,[]);assert.deepEqual(x.deferred,[1,2]);});
test('three slots cap twelve candidate pairs without invented data',()=>{const x=planFTCaptureBatch(Array.from({length:12},(_,i)=>f(i+1)),{maxPairs:3});assert.equal(x.selected_count,3);assert.equal(x.deferred_count,9);});
test('priority never consumes all slots if budget allows coverage',()=>{const x=planFTCaptureBatch(Array.from({length:12},(_,i)=>f(i+1,i<=5)),{maxPairs:3,cursor:0});assert.equal(x.priority_selected.length,1);assert.equal(x.selected_count,3);});
test('fair coverage eventually touches all fixtures over six cycles',()=>{const c=Array.from({length:12},(_,i)=>f(i+1,i===0)),seen=new Set();let cursor=0;for(let i=0;i<9;i++){const p=planFTCaptureBatch(c,{maxPairs:3,cursor});p.selected.forEach(x=>seen.add(x));cursor=p.nextCursor;}assert.equal(seen.size,12);});
test('priority-only single slot rotates signals instead of permanent TOP 1',()=>{const c=[f(3,true),f(2,true),f(1,true)],ids=[];for(let cursor=0;cursor<3;cursor++)ids.push(planFTCaptureBatch(c,{maxPairs:1,cursor}).selected[0]);assert.deepEqual(ids,[1,2,3]);});
test('selection is stable for fixture ordering and duplicate IDs',()=>{const a=planFTCaptureBatch([f(3),f(1),f(3),f(2)],{maxPairs:2,cursor:1});const b=planFTCaptureBatch([f(2),f(3),f(1)],{maxPairs:2,cursor:1});assert.deepEqual(a.selected,b.selected);assert.equal(a.source_count,3);});
test('unselected fixture is explicit deferral, not negative pick',()=>{const x=planFTCaptureBatch([f(42),f(43)],{maxPairs:1});assert.deepEqual(x.deferred,[43]);assert.match(x.reasons[0],/NOT_REPLAYABLE/);});
test('invalid ids/negative budget are not coerced',()=>{assert.throws(()=>planFTCaptureBatch([f(0)],{maxPairs:2}));assert.throws(()=>planFTCaptureBatch([f(1)],{maxPairs:-1}));});
mkdirSync('ft-audit-output',{recursive:true});writeFileSync('ft-audit-output/ft-3c-plan-tests.json',JSON.stringify({status:'PASS',checks,scope:'PURE_STAGED',production:false},null,2));
