const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function trendChart(points,key) {
  // A contract (line/bookmaker/rules) change creates a gap, never a fake trend.
  const p=(points||[]).slice(-24),w=340,h=132,pad=28;
  if(!p.some(x=>!x.gap&&x.key===key&&x.model!==null&&x.market!==null))return '<div class="fo-empty">Chưa có cặp dữ liệu cùng line để vẽ hai đường.</div>';
  const first=p[0].at,last=p.at(-1).at,span=Math.max(1,last-first),x=t=>pad+(t-first)/span*(w-pad-12),y=v=>h-24-v*(h-38);
  let grid='';for(const v of [0,.25,.5,.75,1])grid+=`<line x1="${pad}" y1="${y(v)}" x2="${w-10}" y2="${y(v)}" stroke="#dbe7f3"/><text x="1" y="${y(v)+3}" font-size="9">${v*100}</text>`;
  let paths='';for(const [k,color] of [['model','#087bff'],['market','#9a45df']]){
    let segment=[];const flush=()=>{if(segment.length)paths+=`<polyline fill="none" stroke="${color}" stroke-width="2.5" points="${segment.map(q=>`${x(q.at)},${y(q[k])}`).join(' ')}"/>${segment.map(q=>`<circle cx="${x(q.at)}" cy="${y(q[k])}" r="3" fill="${color}"/>`).join('')}`;segment=[];};
    for(const q of p){if(q.gap||q.key!==key||q[k]===null){flush();continue;}segment.push(q);}flush();
  }
  const labels=p.filter((_,i)=>i===0||i===p.length-1).map(q=>`<text x="${x(q.at)}" y="${h-5}" text-anchor="middle" font-size="10">${esc(q.minute)}′</text>`).join('');
  const events=p.filter((q,i)=>i>0&&q.goals&&p[i-1].goals&&(q.goals.home!==p[i-1].goals.home||q.goals.away!==p[i-1].goals.away)).map(q=>`<line x1="${x(q.at)}" x2="${x(q.at)}" y1="15" y2="${h-24}" stroke="#668099" stroke-dasharray="3 3"/><text x="${x(q.at)}" y="10" text-anchor="middle" font-size="9">${esc(q.goals.home)}–${esc(q.goals.away)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Xác suất cùng kèo theo thời gian, từ 0 đến 100 phần trăm">${grid}${paths}${events}${labels}</svg>`;
}
export function barsChart(pmf,goals,line) {
  if(!pmf)return '<div class="fo-empty">Chờ phân phối bàn độc lập.</div>';
  const vals=[pmf[0]||0,pmf[1]||0,pmf[2]||0,pmf.slice(3).reduce((a,b)=>a+b,0)],labels=['0','1','2','3+'];
  // Tail is mixed for high lines: it must not imply every 3+ outcome wins.
  return `<svg viewBox="0 0 340 130" role="img" aria-label="Phân phối số bàn còn lại">${vals.map((v,i)=>{
    const win=Number.isFinite(line)&&goals+i>line,tailMixed=i===3&&line>=goals+3;
    return `<rect x="${30+i*80}" y="${102-v*75}" width="48" height="${v*75}" rx="5" fill="${win&&!tailMixed?'#14b88b':'#b9cde3'}"/><text x="${54+i*80}" y="${95-v*75}" text-anchor="middle" font-size="12">${(v*100).toFixed(1)}%</text><text x="${54+i*80}" y="120" text-anchor="middle" font-size="11">${labels[i]}</text>`;
  }).join('')}</svg>`;
}
export function priceChart(fair,price) {
  if(!(fair>1&&price>1))return '<div class="fo-empty">Chưa đủ dữ liệu định giá.</div>';
  const lo=Math.max(1,Math.min(fair,price)-.2),hi=Math.max(fair,price)+.2,x=v=>25+(v-lo)/(hi-lo)*290;
  return `<svg viewBox="0 0 340 75" role="img" aria-label="So sánh giá model và giá hiện tại"><line x1="25" y1="32" x2="315" y2="32" stroke="#c4d6e9" stroke-width="5"/>${[[fair,'MODEL FAIR','#758dac'],[price,'HIỆN TẠI','#10a778']].map(([v,label,color])=>`<circle cx="${x(v)}" cy="32" r="6" fill="${color}"/><text x="${x(v)}" y="15" text-anchor="middle" font-size="13">${v.toFixed(2)}</text><text x="${x(v)}" y="58" text-anchor="middle" font-size="9">${label}</text>`).join('')}</svg>`;
}
