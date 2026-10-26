  // HC_EXACT_QUOTE_CONTRACT_V1: analytics retain real paired quotes, never synthetic odds.
  function hcContractLine(value){
    if(value===null||value===undefined||typeof value==='boolean')return null;
    const text=String(value).trim().replace(/,/g,'.');
    if(!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d+)?|\.\d+))?$/.test(text))return null;
    const rawLegs=text.split('/'),legs=rawLegs.map(Number);if(legs.length===2&&rawLegs[0].startsWith('-')&&!/^[+-]/.test(rawLegs[1]))legs[1]=-Math.abs(legs[1]);if(legs.length===2&&(Math.abs(legs[0]-legs[1])!==.5||legs[0]*legs[1]<0))return null;
    const n=legs.reduce((a,b)=>a+b,0)/legs.length;return Number.isFinite(n)&&Math.abs(n*4-Math.round(n*4))<1e-9?n:null;
  }
  function hcContractTime(value){if(value===null||value===undefined||value==='')return null;const n=typeof value==='number'?value:NaN;if(Number.isFinite(n))return n<1e12?n*1000:n;const t=Date.parse(value);return Number.isFinite(t)?t:null;}
  function hcMarketQuotes(rows,ctx={}){
    const pairs=new Map(),conflicts=new Set();
    for(const r of rows||[]){
      if(r.category!=='asian_handicap'||ctx.live===true&&r.source==='prematch'||r.integrity?.valid===false||['status','feed_status'].some(k=>r[k]?.blocked||r[k]?.stopped||r[k]?.finished))continue;
      if(ctx.fixtureId!=null&&r.fixture_id!=null&&Number(ctx.fixtureId)!==Number(r.fixture_id))continue;
      const book=r.bookmaker_name||(typeof r.bookmaker==='string'?r.bookmaker:r.bookmaker?.name)||null;
      const sourceId=(r.source==='prematch'?'pre:':'live:')+(book?'book:'+String(book).trim().toLowerCase():'feed:API_FOOTBALL_LIVE');
      const update=hcContractTime(r.update),received=hcContractTime(ctx.marketAt),at=update??received;
      if(r.update!=null&&update===null)continue;
      if(ctx.at!=null&&(at===null||at>ctx.at+5000||ctx.at-at>60000||ctx.minQuoteAt!=null&&at<ctx.minQuoteAt))continue;
      const vals=(r.values||[]).filter(v=>!v.suspended),side=v=>v.selection_outcome||v.selection_side;
      for(const hv of vals.filter(v=>side(v)==='home')){
        const line=hcContractLine(hv.raw_handicap??hv.handicap),ho=Number(hv.odd);
        if(line===null||!Number.isFinite(ho)||ho<=1)continue;
        const opposites=vals.filter(v=>side(v)==='away'&&hcContractLine(v.raw_handicap??v.handicap)===-line);
        if(!opposites.length)continue;
        const homePeers=vals.filter(v=>side(v)==='home'&&hcContractLine(v.raw_handicap??v.handicap)===line);
        const prices=new Set(homePeers.map(v=>String(v.odd))),awayPrices=new Set(opposites.map(v=>String(v.odd)));
        if(prices.size!==1||awayPrices.size!==1)continue;
        const av=opposites[0],ao=Number(av.odd);if(!Number.isFinite(ao)||ao<=1)continue;
        const supplied=r.settlement_basis??r.basis,verified=['FULL_MATCH','REMAINING_MATCH'].includes(supplied)&&r.settlement_verified===true;
        const basis=verified?supplied:'UNVERIFIED',key=JSON.stringify([sourceId,r.bet_id??null,line,basis]);
        const quote={book:book||'API_FOOTBALL_LIVE_FEED',sourceId,marketId:r.bet_id??null,line,homeOdd:ho,awayOdd:ao,
          main:hv.main===true||av.main===true,quoteAt:at,timestampBasis:update!==null?'PROVIDER_UPDATE':received!==null?'HUB_RECEIPT':'UNAVAILABLE',
          observedScore:ctx.score?{home:ctx.score.home,away:ctx.score.away}:null,
          providerScore:r.score?{...r.score}:null,period:'FT',basis,basisVerified:verified,tradeReady:false,
          sourceQuote:true};
        if(quote.providerScore&&ctx.score&&(quote.providerScore.home!==ctx.score.home||quote.providerScore.away!==ctx.score.away))continue;
        const old=pairs.get(key);
        if(old&&old.quoteAt===quote.quoteAt&&(old.homeOdd!==ho||old.awayOdd!==ao)){pairs.delete(key);conflicts.add(key);continue;}
        if(conflicts.has(key))continue;
        if(!old||(quote.quoteAt??0)>(old.quoteAt??0))pairs.set(key,quote);
      }
    }
    return [...pairs.values()].sort((a,b)=>Number(b.main)-Number(a.main)||(b.quoteAt??0)-(a.quoteAt??0)||a.sourceId.localeCompare(b.sourceId)||a.line-b.line);
  }
  function hcMarketFromRows(rows,homeName,awayName,ctx={}){
    const q=hcMarketQuotes(rows,ctx);if(!q.length)return {valid:false,line:null,homeOdd:null,awayOdd:null,text:'AH: chưa có cặp line–odds hợp lệ / đủ mới',bookmakerCount:0,consensus:false,lineDispersion:null,quotes:[],tradeReady:false};
    // Median line and breadth describe the market only. The selected pair is one
    // real quote at an existing line, with both odds from the SAME source.
    const sources=[...new Set(q.map(x=>x.sourceId))],representative=sources.map(id=>q.find(x=>x.sourceId===id));
    const median=ultraMedian(representative.map(x=>x.line));
    const ordered=[...q].sort((a,b)=>Math.abs(a.line-median)-Math.abs(b.line-median)||Number(b.main)-Number(a.main)||(b.quoteAt??0)-(a.quoteAt??0)||a.sourceId.localeCompare(b.sourceId));
    const x=ordered[0],line=x.line,breadth=Math.round(representative.filter(y=>y.line===line).length/representative.length*100);
    const min=Math.min(...representative.map(y=>y.line)),max=Math.max(...representative.map(y=>y.line));
    return {...x,valid:true,bookmaker:x.book,bookmakerCount:sources.length,consensus:false,lineDispersion:Math.round((max-min)*100)/100,breadth,quotes:q,
      consensusReference:{medianLine:median,sourceCount:sources.length,breadth,indicativeOnly:true},
      text:`${x.book} • HOME ${line>0?'+':''}${line} @${x.homeOdd} • AWAY ${-line>0?'+':''}${-line} @${x.awayOdd} • ${sources.length} nguồn • ${x.basisVerified?x.basis:'chưa xác minh cách thanh toán'}`};
  }
