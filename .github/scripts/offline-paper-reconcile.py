import json,math,sys
from collections import defaultdict,Counter
from pathlib import Path
entries=json.loads(Path(sys.argv[1]).read_text())
sources=json.loads(Path(sys.argv[2]).read_text())
num=lambda x:isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
by_fixture=defaultdict(list)
for s in sources:
 if s['raw_fixture_id']==s['fixture_id'] and s['raw_status']==s['status']:by_fixture[s['fixture_id']].append(s)
def settle(total,line,sel,price):
 assert num(total) and num(line) and num(price) and price>1 and line>=0 and sel in ('OVER','UNDER')
 assert abs(line*4-round(line*4))<1e-8
 legs=[line] if line*2==round(line*2) else [math.floor(line*2)/2,math.ceil(line*2)/2]
 wins=[(total-l if sel=='OVER' else l-total) for l in legs]
 pl=sum(price-1 if d>0 else -1 if d<0 else 0 for d in wins)/len(wins)
 o='WIN' if all(x>0 for x in wins) else 'LOSE' if all(x<0 for x in wins) else 'PUSH' if all(x==0 for x in wins) else 'HALF_WIN' if pl>0 else 'HALF_LOSE'
 return o,pl
assert settle(3,2.75,'OVER',2)==('HALF_WIN',.5)
assert settle(2,2.25,'OVER',2)==('HALF_LOSE',-.5)
assert settle(0,0,'OVER',2)==('PUSH',0)
for e in entries:
 e.update(reconcile='UNVERIFIABLE',reason='NO_ELIGIBLE_RAW_PERIOD_SCORE')
 isft=e['engine']=='FT';h='fulltime_home' if isft else 'halftime_home';a='fulltime_away' if isft else 'halftime_away'
 ss=[s for s in by_fixture[e['fixture_id']] if (s['status']=='FT' if isft else s['status'] in ('HT','2H','FT')) and all(num(s[k]) and s[k]>=0 and int(s[k])==s[k] for k in (h,a)) and s['captured_at']>=e['captured_at']]
 if not ss:continue
 pairs={(s[h],s[a]) for s in ss}
 if len(pairs)!=1:e['reason']='CONFLICTING_STORED_PERIOD_SCORES';continue
 fh,fa=next(iter(pairs));total=fh+fa
 if not all(num(e[k]) for k in ('line','price','score_home','score_away')) or e['line']<0 or abs(e['line']*4-round(e['line']*4))>1e-8 or e['price']<=1 or e['odds_format']!='DEC' or e['selection'] not in ('OVER','UNDER') or e['market_type']!=('OU_FT' if isft else 'OU_H1'):e['reason']='UNSUPPORTED_MARKET_OR_ENTRY';continue
 if total<e['score_home']+e['score_away']:e['reason']='FINAL_BELOW_ENTRY_TOTAL';continue
 outcome,pl=settle(total,e['line'],e['selection'],e['price'])
 e.update(reconcile='PAPER_FROM_STORED_RAW_SCORES',reason=None,recomputed_outcome=outcome,recomputed_unit_pl=pl,final_home=fh,final_away=fa,source_records=len(ss),source_last_at=max(s['captured_at'] for s in ss))
 if e['resolution']=='RESOLVED':e['stored_mismatch']=e['outcome']!=outcome or not num(e['unit_pl']) or abs(e['unit_pl']-pl)>1e-7

def stats(rows):
 settled=[r for r in rows if r['reconcile']=='PAPER_FROM_STORED_RAW_SCORES'];pl=sum(r['recomputed_unit_pl'] for r in settled)
 return dict(records=len(rows),fixtures=len({r['fixture_id'] for r in rows}),reconciled=len(settled),reconciled_fixtures=len({r['fixture_id'] for r in settled}),newly_computable_open=sum(r['resolution']=='OPEN' for r in settled),positive=sum(r['recomputed_unit_pl']>0 for r in settled),negative=sum(r['recomputed_unit_pl']<0 for r in settled),push=sum(r['recomputed_unit_pl']==0 for r in settled),paper_unit_pl=round(pl,6),paper_roi_pct=round(100*pl/len(settled),3) if settled else None,stored_mismatches=sum(r.get('stored_mismatch',False) for r in settled),unverifiable_reasons=dict(Counter(r['reason'] for r in rows if r['reason'])))
out={}
first_details=[]
for engine in ('FT','H1'):
 allrows=[r for r in entries if r['engine']==engine];first={};terms={}
 for r in allrows:
  first.setdefault(r['fixture_id'],r)
  terms.setdefault(tuple(r[k] for k in ('fixture_id','engine','policy_status','market_type','selection','line','price','minute','score_home','score_away')),r)
 firstrows=list(first.values());first_details.extend(firstrows)
 out[engine]={'all_snapshots':stats(allrows),'same_terms_minute_score_collapsed':stats(list(terms.values())),'first_per_fixture':stats(firstrows),'first_by_policy':{p:stats([r for r in firstrows if r['policy_status']==p]) for p in sorted({r['policy_status'] for r in firstrows})},'first_by_utc_day':{d:stats([r for r in firstrows if __import__('datetime').datetime.fromtimestamp(r['captured_at']/1000,__import__('datetime').timezone.utc).date().isoformat()==d]) for d in sorted({__import__('datetime').datetime.fromtimestamp(r['captured_at']/1000,__import__('datetime').timezone.utc).date().isoformat() for r in firstrows})}}
report={'mode':'OFFLINE_PAPER_RECONCILIATION','productionWrites':0,'providerCalls':0,'arithmetic_tests':'PASS','raw_source_records':len(sources),'summaries':out,'limitations':['Raw scores already stored by app, not independently rechecked with provider.','Assumes whole-period OU settlement as existing app specifies; not verified bookmaker tickets.','One first snapshot per fixture/engine selected before checking result availability; unresolved remain excluded and reported.','WAIT_CONFIRM/CAUTION samples are observational paper candidates, not approved bets.','Repeated snapshots and H1/FT on same fixture are correlated.','No production outcomes, engine rules, frontend or thresholds modified.']}
Path('football-edge-offline-paper-summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
Path('football-edge-offline-paper-first-rows.json').write_text(json.dumps(first_details,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
