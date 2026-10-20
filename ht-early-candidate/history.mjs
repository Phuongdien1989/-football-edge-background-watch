// Shared bounded HT history warm-up. Uses callers' existing quota/cache API wrappers.
export function createHTHistoryCache() {
 const cache=new Map(),pending=new Map();let remaining=2;
 const stamp=()=>Date.now();
 const valid=x=>Number.isInteger(x)&&x>=0;
 const kickoff=f=>Number(f?.fixture?.timestamp)*1000;
 function normalise(rows) {
  return (Array.isArray(rows)?rows:[]).filter(f=>f.fixture?.status?.short==='FT'&&Number.isSafeInteger(f.fixture?.id)&&Number.isSafeInteger(f.teams?.home?.id)&&Number.isSafeInteger(f.teams?.away?.id)&&valid(f.score?.halftime?.home)&&valid(f.score?.halftime?.away))
   .map(f=>({fixture_id:f.fixture.id,kickoff:f.fixture.timestamp,status:'FT',home_team_id:f.teams.home.id,away_team_id:f.teams.away.id,halftime_home:f.score.halftime.home,halftime_away:f.score.halftime.away}));
 }
 function has(rows,team,f) {return (rows||[]).some(r=>r.status==='FT'&&r.fixture_id!==f.fixture.id&&(r.home_team_id===team||r.away_team_id===team)&&valid(r.halftime_home)&&valid(r.halftime_away)&&Number(r.kickoff)*(Number(r.kickoff)<1e12?1000:1)<kickoff(f));}
 async function get(team,loader) {
  const old=cache.get(team),now=stamp();
  if(old&&now>=old.at&&now-old.at<(old.error?60000:3600000))return old;
  if(pending.has(team))return pending.get(team);
  if(remaining<=0)return null;
  remaining--;const p=(async()=>{let result;
   try{const raw=await loader(team);if(!Array.isArray(raw))throw Error('HT_HISTORY_RESPONSE_INVALID');result={at:stamp(),rows:normalise(raw)};}
   catch(e){result={at:stamp(),rows:[],error:String(e.message||e).slice(0,100)};}
   cache.set(team,result);return result;
  })();pending.set(team,p);try{return await p;}finally{pending.delete(team);}
 }
 async function contextFor(base,f,loader) {
  const ids=[f?.teams?.home?.id,f?.teams?.away?.id];
  if(!ids.every(Number.isSafeInteger))return base||{at:stamp(),rows:[],error:'HT_TEAM_IDS_MISSING'};
  const entries=await Promise.all(ids.map(id=>has(base?.rows,id,f)?null:get(id,loader)));
  const good=entries.filter(x=>x&&!x.error),rows=[...(base?.rows||[]),...good.flatMap(x=>x.rows)];
  return {at:Math.max(base?.at||0,...good.map(x=>x.at)),rows,source:good.length?'D1_PLUS_QUOTA_COUNTED_TEAM_CACHE':base?.source,
   error:ids.every(id=>has(rows,id,f))?null:base?.error||entries.find(x=>x?.error)?.error||'HT_HISTORY_WARMING'};
 }
 return {beginCycle(){remaining=Math.max(0,2-pending.size);for(const [id,v]of cache)if(stamp()-v.at>3600000)cache.delete(id);},contextFor,normalise};
}
