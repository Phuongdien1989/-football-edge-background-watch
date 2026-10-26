// No provider-specific rule is inferred from a market label or generic rules.
export function resolveHCBasis(quote,{verifiedRules=[]}={}){
 const unknown=reason=>({verified:false,basis:null,reason,reference:null});
 if(!quote)return unknown('NO_QUOTE');
 if(!['LIVE','PRE'].includes(quote.mode)||typeof quote.sourceId!=='string'||!Number.isFinite(quote.quoteAt)||quote.quoteAt<=0||quote.period!=='FT')return unknown('INCOMPLETE_QUOTE_PROVENANCE');
 const matches=verifiedRules.filter(r=>r.sourceId===quote.sourceId&&r.marketId===quote.marketId&&r.period===quote.period&&r.mode===quote.mode&&r.validFrom<=quote.quoteAt&&(r.validUntil==null||quote.quoteAt<r.validUntil)&&['FULL_MATCH','REMAINING_MATCH'].includes(r.basis)&&typeof r.reference==='string'&&r.reference.startsWith('https://')&&typeof r.verifiedAt==='number');
 if(!matches.length)return unknown('NO_VERIFIED_SOURCE_RULE');
 if(new Set(matches.map(r=>r.basis)).size!==1)return unknown('CONFLICTING_VERIFIED_RULES');
 return {verified:true,basis:matches[0].basis,reason:null,reference:matches[0].reference};
}
