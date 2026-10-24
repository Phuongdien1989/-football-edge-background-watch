// Read-only FT V2 dashboard view model. Any supplied evidence is user-selected offline JSON.
import {makeFTV2CohortReport} from './cohort-report.mjs';
export const DASHBOARD_VERSION='FT_V2_VALIDATION_DASHBOARD_V1';
export function buildValidationDashboard(packet={}){
 const {pairs=[],outcomes=[],forecasts=[]}=packet;
 if(![pairs,outcomes,forecasts].every(Array.isArray))throw Error('INVALID_EVIDENCE_PACKET');
 const report=makeFTV2CohortReport({pairs,outcomes,forecasts});
 const exclusions={};
 for(const e of report.excluded)exclusions[e.reason]=(exclusions[e.reason]||0)+1;
 const rows=report.groups.map(g=>({
  dimension:g.dimension,label:g.label,sample:g.n,
  observedWinRate:g.win_rate,estimatedEV:g.mean_ev,brier:g.mean_brier,
  validForInference:false
 }));
 return {
  schema:DASHBOARD_VERSION,mode:'OFFLINE_EVIDENCE_ONLY',
  metrics:{pairs:pairs.length,outcomes:outcomes.length,forecasts:forecasts.length,
   matched:report.sample,unmatched:report.excluded.length},
  status:report.status,groups:rows,exclusionReasons:exclusions,
  calibration:report.calibration,
  warnings:[
   'Không suy ra lợi nhuận hay năng lực dự báo từ mẫu nhỏ hoặc dữ liệu tổng hợp',
   'Không có quyền đọc production; dữ liệu chỉ từ tệp JSON được người dùng chọn',
   'Mô hình LIVE chưa được hiệu chỉnh; EV là ước tính theo xác suất đầu vào'
  ],
  releaseReady:false
 };
}
