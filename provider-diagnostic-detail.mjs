// Read-only error evidence. Never fetches, writes, or changes provider decisions.
export function providerDiagnosticDetail(observation,secret=''){
 if(!observation||observation.code==='OK'||typeof observation.detail!=='string')return null;
 let detail=observation.detail;
 if(secret)detail=detail.split(secret).join('[REDACTED]');
 detail=detail.replace(/https?:\/\/[^\s"\\]+/gi,'[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]');
 return detail.slice(0,350);
}
