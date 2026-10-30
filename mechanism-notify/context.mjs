// Bounded indexed D1 reads. No provider requests, writes, timer or migration.
export function createFTContextCache(){
 const cache=new Map();
 async function team(db,id,kickoff,now){
  const key=id+':'+kickoff,old=cache.get(key);if(old&&now>=old.at&&now-old.at<(old.error?60000:1800000))return old;
  let entry;
  try{
   const sql=`SELECT fixture_id,kickoff,status,home_team_id,away_team_id,score_home,score_away,fulltime_home,fulltime_away FROM fixture_history WHERE home_team_id=? AND kickoff<? AND status='FT' UNION ALL SELECT fixture_id,kickoff,status,home_team_id,away_team_id,score_home,score_away,fulltime_home,fulltime_away FROM fixture_history WHERE away_team_id=? AND kickoff<? AND status='FT' ORDER BY kickoff DESC LIMIT 8`;
   const r=await db.prepare(sql).bind(id,kickoff,id,kickoff).all();if(r.success===false||!Array.isArray(r.results))throw Error('FT_HISTORY_READ_FAILED');
   const rows=r.results.map(r=>({fixture_id:r.fixture_id,date:new Date(r.kickoff*1000).toISOString(),status:r.status,home_id:r.home_team_id,away_id:r.away_team_id,goals:{home:r.fulltime_home??r.score_home,away:r.fulltime_away??r.score_away}}));
   entry={at:now,rows};
  }catch{entry={at:now,rows:[],error:'FT_D1_HISTORY_UNAVAILABLE'};}
  cache.delete(key);cache.set(key,entry);while(cache.size>240)cache.delete(cache.keys().next().value);return entry;
 }
 return {async read(db,f,now){
  const kickoff=f?.fixture?.timestamp,home=f?.teams?.home?.id,away=f?.teams?.away?.id;
  if(!db?.prepare||!Number.isSafeInteger(kickoff)||!Number.isSafeInteger(home)||!Number.isSafeInteger(away))return null;
  const [h,a]=await Promise.all([team(db,home,kickoff,now),team(db,away,kickoff,now)]);
  return {observed_at:now,meta:{fixture_id:f.fixture.id,teams:f.teams,fixture:f.fixture},normalized:{home_recent:h.rows,away_recent:a.rows},provenance:{source:'D1_FIXTURE_HISTORY',homeError:h.error??null,awayError:a.error??null}};
 }};
}
