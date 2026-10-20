// Bounded read-only model context. No provider requests, writes, schema changes or timers.
export async function readHTContext(db,now=Date.now(),cached=null) {
 if(cached&&cached.at<=now&&now-cached.at<(cached.error?60000:3600000))return cached;
 if(!db?.prepare)return {at:now,rows:[],error:'HT_HISTORY_DB_UNAVAILABLE'};
 try {
  const result=await db.prepare("SELECT fixture_id,kickoff,status,home_team_id,away_team_id,halftime_home,halftime_away FROM fixture_history ORDER BY kickoff DESC LIMIT 500").all();
  if(result.success===false||!Array.isArray(result.results))throw Error('HT_HISTORY_READ_FAILED');
  return {at:Math.max(now,Date.now()),rows:result.results,rowsRead:result.meta?.rows_read??null,source:'D1_FIXTURE_HISTORY'};
 }catch(e){return {at:now,rows:[],error:String(e.message||e).slice(0,100)};}
}
