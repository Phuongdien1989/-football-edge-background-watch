export function providerRateScope(detail=''){
 if(/\bip\b|ip.address|address.*limit/i.test(detail))return 'IP';
 if(/per.second|each.second|second.*limit/i.test(detail))return 'SECOND';
 if(/per.minute|each.minute|minute.*limit/i.test(detail))return 'MINUTE';
 return 'UNSPECIFIED';
}
export function providerObservation(response,data,secret='',now=Date.now()){
 const number=name=>{const raw=response.headers.get(name);return raw!==null&&Number.isFinite(Number(raw))?Number(raw):null;};
 const limits={daily_limit:number('x-ratelimit-requests-limit'),daily_remaining:number('x-ratelimit-requests-remaining'),minute_limit:number('x-ratelimit-limit'),minute_remaining:number('x-ratelimit-remaining')};
 let detail=JSON.stringify(data?.errors||{});
 if(secret)detail=detail.split(secret).join('[REDACTED]');
 detail=detail.replace(/https?:\/\/[^\s"\\]+/gi,'[URL]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]').slice(0,350);
 const hasErrors=Boolean(data?.errors&&Object.keys(data.errors).length);
 let code='OK';
 if(response.status===401||response.status===403||/invalid.*(key|token)|access denied|subscription.*(expired|inactive)/i.test(detail))code='API_AUTH_OR_SUBSCRIPTION_ERROR';
 else if((hasErrors||!response.ok)&&(limits.daily_remaining===0||/daily.*(limit|quota)|requests.*(day|today)|quota.*(exceed|reach)/i.test(detail)))code='API_PROVIDER_DAILY_QUOTA_REACHED';
 else if(response.status===429||limits.minute_remaining===0&&hasErrors||/ratelimit|rate.?limit|too many requests|per.minute|per.second/i.test(detail))code='API_PROVIDER_RATE_LIMIT';
 else if(response.status>=500)code='API_PROVIDER_SERVER_ERROR';
 else if(!response.ok||hasErrors)code='API_PROVIDER_ERROR';
 else if(!Array.isArray(data?.response))code='EVIDENCE_PROVIDER_INVALID_RESPONSE';
 const retry=response.headers.get('retry-after');
 const retryAfterMs=retry===null?0:/^\d+(\.\d+)?$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-now)||0;
 const cacheStatus=String(response.headers.get('cf-cache-status')||'').toUpperCase();
 const responseDate=Date.parse(response.headers.get('date')||'');
 const cache={age_seconds:number('age'),status:/^[A-Z_-]{1,32}$/.test(cacheStatus)?cacheStatus:null,response_date:Number.isFinite(responseDate)?new Date(responseDate).toISOString():null};
 return {at:now,http:response.status,code,limits,cache,retry_after_ms:retryAfterMs,detail:code==='OK'?null:detail};
}
