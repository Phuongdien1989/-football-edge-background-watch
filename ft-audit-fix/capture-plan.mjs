// Staged FT replay capture planner. Pure: it never chooses whether legacy FT scans.
// IMPORTANT: a deferred snapshot cannot be recreated with later data. Persist manifest
// of skipped fixture IDs for coverage accounting; do not call it a recovered observation.
const num=x=>Number.isSafeInteger(x)&&x>=0;
export function planFTCaptureBatch(candidates,{maxPairs=0,cursor=0,prioritySeats=1}={}){
 if(!num(maxPairs)||!num(cursor)||!num(prioritySeats))throw Error('INVALID_CAPTURE_PLAN_LIMIT');
 if(!Array.isArray(candidates)||candidates.length>100)throw Error('INVALID_CANDIDATE_BATCH');
 const items=[],seen=new Set();
 for(const x of candidates){
  if(!Number.isSafeInteger(x?.fixture_id)||x.fixture_id<=0)throw Error('INVALID_FIXTURE_ID');
  if(seen.has(x.fixture_id))continue;
  seen.add(x.fixture_id);
  items.push({fixture_id:x.fixture_id,priority:x.priority===true});
 }
 items.sort((a,b)=>a.fixture_id-b.fixture_id);
 const n=items.length,slots=Math.min(maxPairs,n),chosen=new Set();
 // Admission of priority signals is explicitly bounded: the remaining budget
 // always samples across ALL fixtures, including unranked/unrecommended ones.
 const priorityItems=items.filter(x=>x.priority);
 const priorityCount=Math.min(prioritySeats,slots,priorityItems.length);
 for(let k=0;k<priorityCount;k++)chosen.add(priorityItems[(cursor+k)%priorityItems.length].fixture_id);
 const coverageSlots=slots-chosen.size;
 // Round-robin cursor persists across ticks when the owner opts into storage.
 const start=n?cursor%n:0;
 let traversed=0;
 for(let k=0;traversed<coverageSlots&&k<n;k++){
  const item=items[(start+k)%n];
  if(!chosen.has(item.fixture_id)){chosen.add(item.fixture_id);traversed++;}
 }
 const selected=items.filter(x=>chosen.has(x.fixture_id)).map(x=>x.fixture_id);
 const deferred=items.filter(x=>!chosen.has(x.fixture_id)).map(x=>x.fixture_id);
 return {schema:'FT_CAPTURE_PLAN_V1_DRAFT',selected,deferred,source_count:n,
  max_pairs:maxPairs,selected_count:selected.length,deferred_count:deferred.length,
  nextCursor:n?(cursor+Math.max(1,coverageSlots))%n:0,
  priority_selected:selected.filter(id=>items.find(x=>x.fixture_id===id).priority),
  reasons:deferred.length?['SQL_CAPACITY_DEFERRED_NOT_REPLAYABLE_FROM_LATER_SNAPSHOT']:[]};
}
