import packet from './replay-data.mjs';
import {mount} from './ui.mjs';
const root=document.querySelector('[data-ft-overview]'),select=document.querySelector('#replay-match');
const ui=mount(root,{archive:true,inputSource:()=>packet.inputs,controlSource:()=>packet.controls});
for(const s of packet.inputs){const option=document.createElement('option');option.value=s.id;option.textContent=s.home+' – '+s.away+' · '+s.status+' '+s.minute+'′';select.append(option);}
select.disabled=!packet.inputs.length;select.addEventListener('change',()=>ui.select(select.value));if(packet.inputs.length)ui.select(packet.inputs[0].id);
document.querySelector('#replay-summary').textContent='Đọc lúc '+new Date(packet.captured_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})+' (VN) · '+packet.inputs.length+' snapshot hợp lệ · '+packet.report.top.length+' trận đủ điều kiện theo dõi tại lúc đọc. Ghi D1: '+packet.report.d1.rows_written+'; gọi nhà cung cấp: 0.';
document.querySelector('#replay-audit').textContent=JSON.stringify(packet.report,null,2);
window.FTOverviewArchive=ui;
