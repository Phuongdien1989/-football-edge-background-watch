// Presentation only. Reads the already-assessed HT PMF and exact quote.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const pct=x=>finite(x)?(x*100).toFixed(1)+'%':'—';
const esc=x=>String(x??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function htProbabilityViewModel(row){
 const pmf=row?.model?.pmf;
 if(row?.dataOK!==true||row?.modelOK!==true||row.model?.period!=='H1_REMAINING'||row.model?.independent!==true||row.model.at!==row.at||!Array.isArray(pmf)||!pmf.length||pmf.some(p=>!finite(p)||p<0)||Math.abs(pmf.reduce((s,p)=>s+p,0)-1)>1e-8)return {available:false,reason:'Chờ dữ liệu HT hợp lệ để hiển thị xác suất.'};
 const noMoreGoals=Math.min(1,Math.max(0,pmf[0])),atLeastOneMoreGoal=1-noMoreGoals,q=row.quote;
 let contract=null;
 if(row.marketOK===true&&q&&finite(row.recommendation?.line)&&finite(row.recommendation?.odds)&&row.recommendation.odds>1){const keys=['win','halfWin','push','halfLose','lose'];if(keys.every(k=>finite(q[k])&&q[k]>=0)&&Math.abs(keys.reduce((s,k)=>s+q[k],0)-1)<1e-8){
  const binary=q.halfWin===0&&q.push===0&&q.halfLose===0;
  contract={line:row.recommendation.line,odds:row.recommendation.odds,binary,states:keys.map(k=>({key:k,p:q[k]})),breakEven:binary?1/row.recommendation.odds:null,
   marketNoVig:binary&&finite(row.binary?.over)?row.binary.over:null};
 }}
 return {available:true,at:row.at,minute:row.minute,atLeastOneMoreGoal,noMoreGoals,contract,experimental:true};
}
function bar(label,p,kind='model'){return '<div class="htp-prob-row"><span>'+esc(label)+'</span><div class="htp-prob-track"><i class="htp-prob-'+kind+'" style="width:'+Math.max(0,Math.min(100,p*100))+'%"></i></div><b>'+pct(p)+'</b></div>';}
export function renderHTProbability(row){
 const v=htProbabilityViewModel(row);if(!v.available)return '<section class="htp-probability" data-ht-probability="WAIT"><h4>Probability & Value · HT</h4><p>'+esc(v.reason)+'</p></section>';
 const c=v.contract;
 return '<section class="htp-probability" data-ht-probability="AVAILABLE"><header><h4>Probability & Value · HT</h4><small>Ước tính mô hình</small></header>'+bar('Có thêm ≥1 bàn trước hết H1',v.atLeastOneMoreGoal)+bar('Không có thêm bàn',v.noMoreGoals,'neutral')+
  (c?bar('Thắng đủ · Tài H1 '+c.line,c.states.find(s=>s.key==='win').p):'')+
  '<p>Phần còn lại của hiệp 1 · quan sát phút '+esc(v.minute)+'′. Khả năng có bàn không thay đổi chỉ vì giá thị trường thay đổi.</p>'+
  (c?'<p>Line đang xét: Tài H1 '+esc(c.line)+' @ '+esc(c.odds.toFixed(2))+'. Mở chi tiết để xem đủ 5 trạng thái thanh toán.</p>':'<p>Chờ line–giá phù hợp để hiển thị xác suất thanh toán kèo.</p>')+
  '<small>Thử nghiệm · chưa kiểm chứng độ chính xác thực tế. % mô hình không phải tỷ lệ thắng lịch sử hoặc điểm sức ép.</small></section>';
}
export function renderHTContractProbability(row){
 const v=htProbabilityViewModel(row),c=v.contract;if(!v.available||!c)return '';
 const labels={win:'Thắng đủ',halfWin:'Thắng nửa',push:'Hòa tiền',halfLose:'Thua nửa',lose:'Thua đủ'};
 return '<section class="htp-probability" data-ht-settlement="'+(c.binary?'BINARY':'ASIAN_PARTIAL')+'"><h4>Thanh toán · Tài H1 '+esc(c.line)+' @ '+esc(c.odds.toFixed(2))+'</h4>'+c.states.map(s=>bar(labels[s.key],s.p)).join('')+
 (c.binary?bar('Hòa vốn tại giá đang có',c.breakEven,'price')+(c.marketNoVig!==null?bar('Thị trường · loại biên 2 phía',c.marketNoVig,'price'):''):'<p>Kèo nguyên/phần tư có hoàn tiền hoặc thắng thua nửa; không quy thành một % thắng nhị phân hoặc dùng 1/odds.</p>')+
 '<p>Xác suất có thêm bàn khác xác suất thắng đúng line đang xét. Fair Odds và EV được giữ theo đúng phân phối thanh toán này.</p></section>';
}
