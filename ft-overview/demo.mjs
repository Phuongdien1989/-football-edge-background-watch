// Explicit fictional illustration, never mixed into the live bridge/store.
export function demoSnapshots(now) {
  const offsets=[0,1,2,3,4];
  return offsets.map(i=>{
    const at=now-i*1000,goal={home:1,away:0},line=i===3?2.25:2.5,over=[2.40,2.15,2.10,2.05,1.95][i];
    return {id:990001+i,revision:at,at,minute:60+i,status:'2H',goals:goal,home:['ĐỘI A','ĐỘI C','ĐỘI E','ĐỘI G','ĐỘI I'][i],away:['ĐỘI B','ĐỘI D','ĐỘI F','ĐỘI H','ĐỘI K'][i],league:'VÍ DỤ GIẢ ĐỊNH',metrics:{shots:18,sot:7,inbox:11,xg:1.8},
      history:[{at:at-300000,goals:goal,metrics:{shots:15,sot:5,inbox:8,xg:1.4}}],
      market:{period:'FT',basis:'FULL_MATCH',bookmaker:'DEMO',line,over,under:1.60,at,score:goal},
      model:{version:'ILLUSTRATION_NOT_TRAINED',kind:'DEMO',independent:true,validated:false,at,pmf:[.20,.35,.30,.15],assumptions:['FICTIONAL_ILLUSTRATION'],sample:null}};
  });
}
