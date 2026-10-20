import {renderHTPricing} from './ui.mjs';
const now=Date.now(),day=86400000,context={at:now-1,rows:[]},items=[];
for(let i=1;i<=5;i++) {
 const home=100+i*2,away=home+1,id=900000+i,minute=10+i*2,goals={home:0,away:i===2?1:0};
 if(i!==3)for(let k=1;k<=8;k++)for(const team of [home,away])context.rows.push({fixture_id:10000+team*10+k,kickoff:Math.floor((now-(k+1)*day)/1000),status:'FT',home_team_id:team,away_team_id:800+k,halftime_home:k%3,halftime_away:k%2});
 const latest={captured_at:now,fresh_at:now,minute,status:'1H',goals,metrics:{total:{shots:5,sot:2}},stats_presence:{shots:true,sot:true},fixture:{fixture:{id,timestamp:Math.floor((now-minute*60000)/1000)},teams:{home:{id:home},away:{id:away}}},
 market_at:i===5?null:now,market_rows:[{category:'h1_total',bookmaker:'DEMO BOOK',status:{blocked:i===4},values:[{value:'Over',handicap:goals.away+.5,odd:2},{value:'Under',handicap:goals.away+.5,odd:1.8}]}]};
 items.push({id,home:'DEMO Home '+i,away:'DEMO Away '+i,latest});
}
renderHTPricing(document.getElementById('demo'),items,context,now);
