// FT V2 Experimental decision review. Pure, read-only, NO independent data collection.
// A recommendation here is a review of an UNCALIBRATED model, NOT a betting claim.
import {number,goalsToFullWin,priceOver,validatePMF} from './core.mjs';
export const POLICY='FT_V2_EXPERIMENTAL_DECISION_REVIEW_V1';
export function reviewFTDecision(assessment){
 const r=assessment||{},s=r.snapshot||{},m=s.market||{},q=r.quote;
 const reasons=[],warnings=[];
 const total=(Number.isInteger(s.goals?.home)&&Number.isInteger(s.goals?.away))?s.goals.home+s.goals.away:null;
 const needed=total===null||number(m.line)===null?null:goalsToFullWin(total,m.line);
 const odds=number(m.over),binaryLine=number(m.line)!==null&&Math.abs(m.line%1-.5)<1e-8;
 const breakEven=binaryLine&&odds>1?1/odds:null;
 const independent=r.modelOK&&validatePMF(s.model?.pmf)&&total!==null&&number(m.line)!==null?priceOver(s.model.pmf,total,m.line,2):null;
 const evidence=r.data?.label||'NO_WINDOW';
 const sample=s.model?.sample||{};
 if(s.model?.scoreTimeConditioned)warnings.push('Đã cập nhật theo tỷ số và phút quan sát; sức ép, xG và thẻ đỏ chưa có hệ số hiệu chỉnh.');
 if(number(s.metrics?.red)>0)warnings.push('Có thẻ đỏ: mô hình chưa định lượng tác động, cần xem lại giả định.');
 if(s.model?.validated!==true)warnings.push('Mô hình nghiên cứu chưa hiệu chỉnh theo kết quả LIVE');
 if(sample.home!=null&&sample.away!=null)warnings.push('Mẫu lịch sử: '+sample.home+' / '+sample.away+' trận; không coi hai mẫu là bằng chứng độc lập');
 if(evidence==='CHANCES ADDED')reasons.push('Cơ hội ghi bàn mới xuất hiện trong cửa sổ thống kê; chưa tự động đổi xác suất');
 else if(evidence==='NO NEW QUALITY SIGNAL')warnings.push('Không có chỉ dấu cơ hội chất lượng mới trong cửa sổ gần đây');
 else warnings.push('Chưa đủ cửa sổ thống kê để kết luận cường độ LIVE');
 const p=q&&number(q.win)!==null?number(q.win):null;
 const ev=q&&number(q.ev)!==null?number(q.ev):null;
 const edge=ev===null?null:ev;
 let action='DATA_WAIT',title='CHỜ DỮ LIỆU';
 if(r.blocked){reasons.push('Dữ liệu trận không đủ mới hoặc đang cooldown/lỗi thống kê');}
 else if(!r.marketFresh||needed===null){action='WAIT_PRICE';title='CHỜ GIÁ KHỚP TRẬN';reasons.push('Phải xác minh FT tổng cả trận, đúng tỷ số, line và thời điểm');}
 else if(needed===0){action='CONTRACT_MISMATCH';title='XÁC MINH HỢP ĐỒNG';reasons.push('Tài đã vượt line theo tỷ số; không suy diễn giá nhà cái là cơ hội miễn phí');}
 else if(!r.modelOK||p===null||ev===null){action='MODEL_WAIT';title='CHỜ XÁC SUẤT ĐỘC LẬP';if(s.model?.waitReason==='ADDED_TIME_NOT_MODELED')reasons.push('Đang bù giờ; chưa có mô hình thời gian còn lại được xác minh.');}
 else if(ev<=0){action='WAIT_PRICE';title='KHÔNG VÀO Ở GIÁ NÀY';reasons.push('Giá không tạo lợi thế kỳ vọng dương theo mô hình hiện có');}
 else{
  action='TRIAL_OVER';title='CÂN NHẮC TÀI THỬ NGHIỆM';
  reasons.push('Giá hiện tại vượt giá công bằng theo mô hình, đã tính quy tắc thắng/thua/hoàn tiền của line');
  if(ev<0.02)warnings.push('EV ước tính thấp hơn 2%; một sai số nhỏ có thể đảo chiều quyết định');
  else if(ev<0.05)warnings.push('EV ước tính trong vùng 2–5%; cần quan sát độ nhạy dự báo');
  else warnings.push('EV ước tính trên 5%; không đồng nghĩa có lợi thế thực tế');
 }
 // Sensitivity is an explicit assumed ±5 percentage point range,
 // NOT a calibrated confidence interval or a change to model forecasts.
 const low=p===null?null:Math.max(0,p-.05),high=p===null?null:Math.min(1,p+.05);
 const lowEV=!binaryLine||low===null||odds===null?null:low*odds-1;
 const highEV=!binaryLine||high===null||odds===null?null:high*odds-1;
 if(action==='TRIAL_OVER'&&lowEV!==null&&lowEV<=0)warnings.push('EV đổi dấu khi xác suất giảm giả định 5 điểm %');
 return {policy:POLICY,experimental:true,action,title,needed,odds,
  winProbability:p,breakEven,estimatedEV:r.blocked?null:edge,fairOdds:r.blocked?null:q?.fairOdds??independent?.fairOdds??null,
  valuation:valuationView(r,independent),
  evidence,reason:reasons,warnings,
  sensitivity:{assumedDeltaProbabilityPoints:5,lowWinProbability:low,highWinProbability:high,lowEV,highEV,calibrated:false},
  modelVersion:s.model?.version??null,validated:s.model?.validated===true,
  marketAligned:r.marketFresh===true,dataFresh:r.fresh===true};
}


// Football view and price view are separate. LIVE changes are descriptive until
// independently calibrated; absence of quality evidence is NOT evidence of Under.
export function valuationView(r,independent=null){
 const s=r.snapshot||{},m=s.market||{},model=s.model||{},pmf=model.pmf;
 const modelMean=r.modelOK&&validatePMF(pmf)?pmf.reduce((a,p,i)=>a+p*i,0):null;
 const total=Number.isInteger(s.goals?.home)&&Number.isInteger(s.goals?.away)?s.goals.home+s.goals.away:null;
 const fair=r.blocked?null:r.quote?.fairOdds??independent?.fairOdds??null;
 const binary=r.binary||null,label=r.data?.label;
 const matchState=r.blocked?'DATA_WAIT':label==='CHANCES ADDED'?'CHANCES_ADDED':label==='NO NEW QUALITY SIGNAL'?'NO_NEW_QUALITY_SIGNAL':'OBSERVING';
 const marketDirection=binary?(binary.over>.5?'OVER_PRICED_MORE_LIKELY':binary.over<.5?'UNDER_PRICED_MORE_LIKELY':'BALANCED'):'NOT_INFERRED';
 const comparison=r.blocked?'Dữ liệu chưa đủ mới để kết luận.':!binary?'Chưa đối chiếu xác suất thị trường: cần hai giá hợp lệ; line nguyên/¼ cần mô hình thanh toán riêng.':!r.quote?'Có giá thị trường; còn thiếu phân phối bàn độc lập.':r.delta>0?'Mô hình nền đánh giá Tài cao hơn thị trường.':r.delta<0?'Mô hình nền đánh giá Tài thấp hơn thị trường.':'Mô hình nền và thị trường đồng thuận về xác suất.';
 return {matchState,marketDirection,comparison,baselineGoals90:number(model.lambda90),remainingGoals:modelMean,expectedTotal:total!==null&&modelMean!==null?total+modelMean:null,
  marketOver:binary?.over??null,modelOver:r.quote?.win??null,fairOdds:fair,
  minimumOdds:fair,minimumRule:'STRICTLY_ABOVE_FAIR_AT_SAME_LINE',line:number(m.line),
  scoreTimeConditioned:model.scoreTimeConditioned===true,modelVersion:model.version??null,sourceAt:s.at,liveAdjusted:false,liveLabel:matchState==='CHANCES_ADDED'?'Có thêm cơ hội LIVE':matchState==='NO_NEW_QUALITY_SIGNAL'?'Chưa thêm chỉ dấu chất lượng':matchState==='DATA_WAIT'?'Chờ dữ liệu mới':'Đang tích lũy diễn biến',
  explanation:'Giá cao không làm giảm xác suất mô hình. Có khả năng có bàn và có giá vào tốt là hai đánh giá riêng.',
  missing:[!r.modelOK?'Phân phối bàn độc lập':null,!r.marketFresh?'Giá cùng tỷ số và thời điểm':null,r.blocked?'Dữ liệu LIVE hợp lệ':null].filter(Boolean)};
}
// Browser-memory sessions: immutable original quote/deadline, not an instruction
// to keep entering for five minutes. Current data/price guards always prevail.
export function createFTSessions({duration=300000,maxFixtures=100}={}){
 const sessions=new Map();
 const contract=r=>{const s=r.snapshot||{},m=s.market||{};return JSON.stringify([m.bookmaker,m.period,m.basis,m.line]);};
 const event=r=>{const s=r.snapshot||{};return JSON.stringify([s.goals?.home,s.goals?.away,s.status,number(s.metrics?.red),number(s.eventAt)]);};
 function update(row,review,now){
  if(!row)return null;const id=row.id,sourceAt=number(row.snapshot?.at),key=contract(row),eventKey=event(row);let prior=sessions.get(id);
  if(prior&&prior.status==='INVALIDATED'&&!(sourceAt>prior.invalidatedAt))return structuredClone(prior);
  if(prior&&prior.status!=='INVALIDATED'&&(prior.eventKey!==eventKey||prior.contract!==key)){
   prior.status='INVALIDATED';prior.reason='Tỷ số, giai đoạn hoặc hợp đồng kèo thay đổi; cần xác nhận lại.';prior.invalidatedAt=sourceAt??now;return structuredClone(prior);
  }
  const expired=prior&&now>=prior.expiresAt;
  const canStart=review.action==='TRIAL_OVER'&&row.fresh&&!row.blocked&&row.marketFresh;
  if((!prior||(prior.status==='INVALIDATED'&&sourceAt>prior.invalidatedAt)||(expired&&sourceAt>prior.lastSourceAt))&&canStart){
   prior={fixtureId:id,startedAt:now,expiresAt:now+duration,sourceAt,lastSourceAt:sourceAt,contract:key,eventKey,status:'ACTIVE',original:{line:review.valuation.line,odds:review.odds,fairOdds:review.fairOdds,estimatedEV:review.estimatedEV,winProbability:review.winProbability,remainingGoals:review.valuation.remainingGoals,expectedTotal:review.valuation.expectedTotal,modelVersion:review.valuation.modelVersion,minute:row.snapshot.minute},reason:'Phiên tham chiếu 5 phút; chỉ cân nhắc khi dữ liệu và giá hiện tại vẫn hợp lệ.'};
   sessions.delete(id);sessions.set(id,prior);while(sessions.size>maxFixtures)sessions.delete(sessions.keys().next().value);
  }else if(prior&&prior.status!=='INVALIDATED'){
   prior.status=expired?'EXPIRED':canStart?'ACTIVE':'PAUSED';prior.lastSourceAt=Math.max(prior.lastSourceAt||0,sourceAt||0);
   prior.reason=expired?'Hết phiên; chờ quan sát mới để định giá lại.':canStart?'Giữ mốc ban đầu; không kéo dài hạn khi giá cập nhật.':'Tạm ngừng khuyến nghị: giá hoặc dữ liệu hiện tại chưa đạt.';
  }
  return prior?structuredClone(prior):null;
 }
 return Object.freeze({update,read:()=>structuredClone([...sessions.values()])});
}

