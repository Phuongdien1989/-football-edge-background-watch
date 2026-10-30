// Pure view of existing signals. Keep source ranking, actions and data meaning.
import {matchIdentity,outlook,factTiles,probabilityRail,directions,priceDecision,escape as esc,odd,finite} from '../ui-common/signal-visual.mjs';
const titles={overview:'Overview',ht:'HT Goals',ft:'FT Goals',hc:'Handicap',valuation:'FT Overview'};
const signalOf=(x,tab)=>tab==='overview'?x.signals[x.masterPrimary]||Object.values(x.signals)[0]:x.signals[tab];
export function renderSignalMechanism({tab,rows=[],chosen=null,fixture=null,packet,route,displayAction}){
 if(!titles[tab])throw Error('UNKNOWN_MECHANISM_'+tab);
 const ordered=rows.slice(0,5),picked=chosen||(!fixture?ordered[0]:null),focus=picked?signalOf(picked,tab):null,now=Date.now();
 let h='<div class="fe-lsp fe-lsp-mechanism fe-mc-workspace" data-mechanism="'+esc(tab)+'"><div class="fe-lsp-header"><div><h2>'+titles[tab]+'</h2><div class="fe-lsp-desc">Kết luận nguồn hiện hành · giữ thứ tự TOP</div></div><span class="fe-lsp-chip">'+rows.length+' trận</span></div><div class="fe-lsp-layout"><section class="fe-lsp-panel fe-mc-list-panel"><h3>TOP 1–5 · Danh sách tín hiệu</h3><div class="fe-lsp-list">';
 if(!ordered.length)h+='<div class="fe-lsp-empty">Chưa có tín hiệu trong nguồn hiện hành. Không tự tạo thứ hạng hoặc dữ liệu trận.</div>';
 for(const [i,x]of ordered.entries()){const s=signalOf(x,tab),o=s?.observation||{},rank=tab==='overview'?x.masterRank:s?.rank,assigned=Number.isInteger(rank)&&rank>0&&rank<=5;
 h+='<a class="fe-lsp-item" href="'+esc(route(tab,x.id))+'" data-active="'+(x.id===picked?.id)+'"><span class="fe-lsp-rank">'+esc(assigned?rank:i+1)+'</span><span class="fe-lsp-match"><strong>'+esc(o.home)+' – '+esc(o.away)+'</strong><small>'+esc(o.league)+' · '+esc(o.minute)+'′ · '+esc(o.goals?.home)+'–'+esc(o.goals?.away)+'</small></span><span class="fe-lsp-ev">'+esc(assigned?'TOP '+rank:'Mục '+(i+1))+'</span></a>';
 }
 h+='</div></section><section class="fe-lsp-panel fe-mc-focus-panel">';
 if(!focus)h+='<div class="fe-lsp-empty">'+(fixture?'Trận này không còn trong dữ liệu nguồn hiện hành.':'Chờ trận cập nhật từ scanner hiện hành.')+'</div>';
 else{const o=focus.observation||{},fresh=focus.freshness==='CURRENT',label=displayAction(focus,now,'BRIDGE'),value=focus.engine==='valuation',model=fresh&&focus.modelOK&&!focus.blocked,market=fresh&&focus.marketFresh&&!focus.blocked;
 h+='<div class="fe-mc" data-mechanism-card="'+esc(tab)+'">'+matchIdentity({...o,badge:titles[tab]+' · Thử nghiệm',now});
 h+=outlook(fresh?label:'CHỜ DỮ LIỆU MỚI',focus.engine==='hc'?'GAP là chỉ số ưu thế · không phải xác suất':'Giữ kết luận từ cơ chế hiện có',fresh?focus.history:[]);
 h+=factTiles([['SOT',fresh?o.metrics?.sot??'—':'—','target'],['xG nguồn',fresh?odd(o.metrics?.xg):'—','trend'],[focus.engine==='hc'?'LIVE GAP':'Engine score',fresh?(focus.engine==='hc'?focus.gap:focus.score)??'—':'—','data']]);
 // Legacy score/GAP is not a probability. FT Overview has Fair/EV but no exact
 // independent probability exposed by this display bridge, so do not invent it.
 h+=probabilityRail(value?'Xác suất thắng đúng line FT':'Xác suất độc lập',null);
 h+=directions(fresh?focus.state||'Đang theo dõi':'Chờ nguồn mới',value&&market?'Tài FT '+focus.line+' · '+odd(focus.odds):'Xem hợp đồng / giá gốc');
 h+=priceDecision({title:label,pick:value&&finite(focus.line)?'Tài FT '+focus.line:null,odds:market?focus.odds:null,fair:model?focus.fairOdds:null,ev:model&&market?focus.ev:null,positive:value&&String(label).startsWith('Cân nhắc'),note:value?'Fair và EV từ mô hình hiện hành':'Giữ nguyên quyết định nguồn; không tạo thêm kèo'});
 if(tab==='overview')h+='<section class="fe-mc-engine-grid">'+Object.entries(picked.signals).map(([k,s])=>'<a href="'+esc(route(k,picked.id))+'"><small>'+esc(titles[k]||k)+'</small><b>'+esc(displayAction(s,now,'BRIDGE'))+'</b></a>').join('')+'</section>';
 h+='<details class="fe-mc-details"><summary>Chi tiết phân tích <span>›</span></summary><p>'+esc(focus.reason||'Nguồn chưa cung cấp lý do')+'</p><p>Ghi nhận: '+esc(o.at?new Date(o.at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'—')+' · '+esc(focus.freshness)+' · '+esc(focus.source)+'</p><p>Thứ tự nguồn được giữ nguyên. Danh sách TOP không tự xếp lại theo điểm số.</p></details></div>';
 }
 h+='<div class="fe-lsp-original"><button type="button" data-ftabs-tools aria-label="Mở công cụ và khuyến nghị gốc">Công cụ / khuyến nghị gốc ↗</button></div></section></div></div>';
 return h;
}
