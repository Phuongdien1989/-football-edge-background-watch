// Deterministic Vietnamese, grounded in forecast/evidence. No LLM/provider calls.
const pct=p=>(100*p).toFixed(1)+'%';
export function modulesFor(row,evidence=[]){
 const names=['Team Strength','Recent Form & Opponent Strength','Player Performance','Lineup & Chemistry','Injury & Suspension','Tactical Intelligence','Goal Prediction','Fair-Line Engine','Market Intelligence','HT Intelligence','FT & Game State','Momentum Intelligence'];
 return names.map((name,i)=>({name,status:!row.forecast?'CHƯA ĐỦ DỮ LIỆU':i===1?'ĐÃ FIT ĐỐI THỦ · CHƯA FIT FORM ĐỘNG':[0,6,10].includes(i)?'ĐỊNH LƯỢNG THỬ NGHIỆM':i===9?(row.forecast.distributions.HT?'ĐỊNH LƯỢNG THỬ NGHIỆM':'THIẾU LỊCH SỬ HT'):[7,8].includes(i)?(row.evaluations.some(e=>e.price)?'ĐÃ ĐỊNH GIÁ THỬ NGHIỆM':'CHỜ GIÁ / HỢP ĐỒNG'):'CHƯA ĐỊNH LƯỢNG',evidence:evidence.filter(e=>e.fixtureId===row.fixture.id&&e.module===name).map(e=>({id:e.id,text:e.text})).slice(0,5)}));
}
export function explain(row){
 const f=row.forecast;if(!f)return [{kind:'UNKNOWN',text:'Chưa có artifact mô hình phù hợp với giải và thời điểm. Không dùng odds để dựng xác suất.',refs:[]}];
 const w=f.summary.FT.wdl,sides=Object.entries(w).sort((a,b)=>b[1]-a[1]),name={HOME:row.fixture.home.name,DRAW:'Hòa',AWAY:row.fixture.away.name};
 return [{kind:'MODEL_ESTIMATE',text:`${name[sides[0][0]]} là kết quả có xác suất cao nhất trong mô hình: ${pct(sides[0][1])}. Đây không tự động là cửa có giá tốt nhất.`,refs:[f.id]},
 {kind:'MODEL_ESTIMATE',text:`Bàn dự kiến ${f.means.FT.home.toFixed(2)} – ${f.means.FT.away.toFixed(2)}; tổng ${(f.means.FT.home+f.means.FT.away).toFixed(2)}. Mô hình chưa định lượng thế trận pressing hay chất lượng cơ hội.`,refs:[f.id]},
 {kind:'FACT',text:`Lịch sử dùng cho mô hình: chủ ${f.sample.home}, khách ${f.sample.away}; ${f.sample.league} trận cấp giải. Artifact được fit trước thời điểm quan sát.`,refs:[f.artifactHash]},
 {kind:'UNKNOWN',text:'Chưa hiệu chỉnh xác suất theo kết quả ngoài mẫu. Cầu thủ, chấn thương và chiến thuật không tự cộng/trừ xác suất.',refs:[f.id]}];
}
export function investmentStatus(row,now){if(now>=row.fixture.kickoff)return 'CLOSED_PRE';if(!row.forecast)return 'MODEL_WAIT';if(!row.evaluations.length)return 'WAIT_PRICE';if(row.top)return 'OPEN_TRIAL';if(row.evaluations.some(e=>e.status==='WAIT_MODEL_REVIEW'))return 'WAIT_MODEL_REVIEW';if(row.evaluations.some(e=>e.status==='WAIT_PRICE'))return 'WAIT_PRICE';if(row.evaluations.some(e=>e.status==='WAIT_RULE'))return 'WAIT_RULE';if(row.evaluations.every(e=>e.status==='NO_ENTRY'))return 'NO_ENTRY';return 'MODEL_WAIT';}
