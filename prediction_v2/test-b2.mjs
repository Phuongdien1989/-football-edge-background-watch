import assert from 'node:assert/strict';
import {ApiBudgetManager,parseRateLimitHeaders} from './api-budget-manager.js';
import {chunkIds,planLiveCalls,planSlowContext,applyBudgetToPlan} from './bulk-acquisition-plan.js';
import {normalizeSeasonPlayers,addRelativePlayerImportance,buildPersonnelFeatures,buildScheduleFeatures,buildMatchContextFeatures} from './context-feature-layer.js';

const fakeHeaders={get(k){return ({'x-ratelimit-requests-limit':'75000','x-ratelimit-requests-remaining':'62000','x-ratelimit-limit':'450','x-ratelimit-remaining':'420'})[String(k).toLowerCase()]??null}};
assert.deepEqual(parseRateLimitHeaders(fakeHeaders),{dailyLimit:75000,dailyRemaining:62000,minuteLimit:450,minuteRemaining:420});
const b=new ApiBudgetManager();b.observeHeaders(fakeHeaders,Date.UTC(2026,9,6,6));assert.equal(b.decision({priority:'BACKGROUND',now:Date.UTC(2026,9,6,6)}).allow,true);
assert.equal(chunkIds(Array.from({length:45},(_,i)=>i+1)).length,3);
const calls=planLiveCalls({fixtures:Array.from({length:25},(_,i)=>({fixture:{id:i+1}})),candidates:[{id:1,state:'STRONG'},{id:2,state:'CANDIDATE'}]});
assert.ok(calls.some(x=>x.path==='/fixtures'&&x.params.ids));assert.ok(calls.some(x=>x.path==='/odds/live'));assert.ok(applyBudgetToPlan(calls,b).length>0);

const seasonResp=[
 {player:{id:10,name:'Star A',injured:false},statistics:[{team:{id:1},games:{appearences:10,lineups:10,minutes:900,rating:'7.50',position:'F'},goals:{total:8,assists:3},passes:{key:20,total:300,accuracy:'82%'},duels:{total:100,won:55},tackles:{total:10,interceptions:2},shots:{total:40,on:22},dribbles:{attempts:30,success:18},cards:{yellow:1,red:0}}]},
 {player:{id:11,name:'Core B',injured:false},statistics:[{team:{id:1},games:{appearences:10,lineups:9,minutes:800,rating:'7.00',position:'M'},goals:{total:2,assists:4},passes:{key:18,total:500,accuracy:'88%'},duels:{total:120,won:70},tackles:{total:30,interceptions:12},shots:{total:15,on:6},dribbles:{attempts:20,success:12},cards:{yellow:2,red:0}}]},
 {player:{id:12,name:'Reserve C',injured:false},statistics:[{team:{id:1},games:{appearences:7,lineups:1,minutes:220,rating:'6.30',position:'F'},goals:{total:0,assists:0},passes:{key:2,total:80,accuracy:'75%'},duels:{total:30,won:10},tackles:{total:2,interceptions:0},shots:{total:5,on:1},dribbles:{attempts:8,success:2},cards:{yellow:0,red:0}}]}
];
const norm=normalizeSeasonPlayers(seasonResp,1);assert.equal(norm.length,3);assert.equal(addRelativePlayerImportance(norm)[0].id,10);
const pf=buildPersonnelFeatures({teamId:1,seasonPlayers:seasonResp,lineups:[{team_id:1,formation:'4-3-3',startXI:[{id:11},{id:12}]}],injuries:[{team_id:1,player_id:10}],livePlayers:[{team_id:1,players:[{id:11,name:'Core B',rating:'7.2',minutes:60}]}]});
assert.equal(pf.missing_star_count>=1,true);assert.equal(pf.injured_core_count>=1,true);
const now=Date.UTC(2026,9,6,12),recent=[{date:'2026-10-04T12:00:00Z',home_id:1,away_id:2,goals:{home:2,away:0}},{date:'2026-10-01T12:00:00Z',home_id:3,away_id:1,goals:{home:1,away:1}}];
const sf=buildScheduleFeatures({teamId:1,recentFixtures:recent,now});assert.equal(sf.matches_last_7d,2);assert.equal(sf.recent_ppg,2);
assert.equal(buildMatchContextFeatures({homeId:1,awayId:2,homeSeasonPlayers:seasonResp,awaySeasonPlayers:[],lineups:[],injuries:[],livePlayers:[],homeRecent:recent,awayRecent:[]}).shadow_only,true);
assert.ok(planSlowContext({fixture:{fixture:{id:99},teams:{home:{id:1},away:{id:2}},league:{id:39,season:2026}},coverage:{injuries:true,standings:true,predictions:true,odds:true}}).some(x=>x.path==='/players'));
console.log('B2 tests PASS');
