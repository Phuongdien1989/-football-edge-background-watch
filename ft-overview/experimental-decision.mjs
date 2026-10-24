// FT V2 Experimental decision review. Pure, read-only, NO independent data collection.
// A recommendation here is a review of an UNCALIBRATED model, NOT a betting claim.
import {number,goalsToFullWin} from './core.mjs';
export const POLICY='FT_V2_EXPERIMENTAL_DECISION_REVIEW_V1';
export function reviewFTDecision(assessment){
 const r=assessment||{},s=r.snapshot||{},m=s.market||{},q=r.quote;
 const reasons=[],warnings=[];
 const total=(Number.isInteger(s.goals?.home)&&Number.isInteger(s.goals?.away))?s.goals.home+s.goals.away:null;
 const needed=total===null||number(m.line)===null?null:goalsToFullWin(total,m.line);
 const odds=number(m.over),breakEven=odds>1?1/odds:null;
 const evidence=r.data?.label||'NO_WINDOW';
 const sample=s.model?.sample||{};
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
 else if(!r.modelOK||p===null||ev===null){action='MODEL_WAIT';title='CHỜ XÁC SUẤT ĐỘC LẬP';}
 else if(ev<=0){action='WAIT_PRICE';title='KHÔNG VÀO Ở GIÁ NÀY';reasons.push('Giá không tạo lợi thế kỳ vọng dương theo mô hình hiện có');}
 else{
  action='TRIAL_OVER';title='CÂN NHẮC TÀI THỬ NGHIỆM';
  reasons.push('Xác suất mô hình vượt ngưỡng hòa vốn ở giá hiện tại');
  if(ev<0.02)warnings.push('EV ước tính thấp hơn 2%; một sai số nhỏ có thể đảo chiều quyết định');
  else if(ev<0.05)warnings.push('EV ước tính trong vùng 2–5%; cần quan sát độ nhạy dự báo');
  else warnings.push('EV ước tính trên 5%; không đồng nghĩa có lợi thế thực tế');
 }
 // Sensitivity is an explicit assumed ±5 percentage point range,
 // NOT a calibrated confidence interval or a change to model forecasts.
 const low=p===null?null:Math.max(0,p-.05),high=p===null?null:Math.min(1,p+.05);
 const lowEV=low===null||odds===null?null:low*odds-1;
 const highEV=high===null||odds===null?null:high*odds-1;
 if(action==='TRIAL_OVER'&&lowEV<=0)warnings.push('EV đổi dấu khi xác suất giảm giả định 5 điểm %');
 return {policy:POLICY,experimental:true,action,title,needed,odds,
  winProbability:p,breakEven,estimatedEV:edge,fairOdds:q?.fairOdds??null,
  evidence,reason:reasons,warnings,
  sensitivity:{assumedDeltaProbabilityPoints:5,lowWinProbability:low,highWinProbability:high,lowEV,highEV,calibrated:false},
  modelVersion:s.model?.version??null,validated:s.model?.validated===true,
  marketAligned:r.marketFresh===true,dataFresh:r.fresh===true};
}
