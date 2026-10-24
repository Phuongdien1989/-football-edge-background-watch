"""Test staged immutable FT observation+decision pair D1-style SQLite schema (no Cloudflare)."""
import json
import sqlite3
from pathlib import Path

con=sqlite3.connect(':memory:')
con.executescript(Path('ft-audit-fix/ft-pair-ledger.sql').read_text())
con.executescript(Path('ft-audit-fix/persistent-budget.sql').read_text())
con.execute('INSERT INTO ft_replay_budget_v1(id,window_start,window_end,max_records,max_bytes) VALUES (1,1,99999999999999,3,100000)')
insert='INSERT INTO ft_replay_pairs_v1 (observation_id,fixture_id,observed_at,decision_at,content_hash,observation_json,decision_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(observation_id) DO NOTHING'
checks=0
def test(label,fn):
 global checks
 fn();checks+=1;print('PASS',label)
def fresh():
 obs={'schema':'FT_OBSERVATION_V1_DRAFT','id':'o','fixture_id':42,'decision_at':1000}
 dec={'schema':'FT_DECISION_V1_DRAFT','observation_id':'o','fixture_id':42,'decision_at':1100}
 return ('o',42,1000,1100,'a'*64,json.dumps(obs),json.dumps(dec))
def single():
 con.execute(insert,fresh())
 con.commit()
 assert con.execute('SELECT count(*) FROM ft_replay_pairs_v1').fetchone()[0]==1
 got=con.execute('SELECT observation_json,decision_json FROM ft_replay_pairs_v1').fetchone()
 assert json.loads(got[0])['id']==json.loads(got[1])['observation_id']
test('single pair is one row with linked observation and decision',single)
def retry():
 old=con.total_changes
 con.execute(insert,fresh())
 assert con.total_changes==old
 assert con.execute('SELECT count(*) FROM ft_replay_pairs_v1').fetchone()[0]==1
test('idempotent insert does not overwrite immutable pair',retry)
def failure():
 before=con.execute('SELECT COUNT(*) FROM ft_replay_pairs_v1').fetchone()[0]
 bad=list(fresh());bad[0]='o2';bad[1]=-1
 try:con.execute(insert,bad)
 except sqlite3.IntegrityError:pass
 else:raise AssertionError('missing fixture constraint')
 assert con.execute('SELECT count(*) FROM ft_replay_pairs_v1').fetchone()[0]==before
test('failed insert never leaves half an observation/decision',failure)
def time():
 bad=list(fresh());bad[0]='o3';bad[3]=500
 try:con.execute(insert,bad)
 except sqlite3.IntegrityError:pass
 else:raise AssertionError('missing temporal constraint')
test('decision cannot be committed before observation',time)
def budget_loss():
 con.execute('UPDATE ft_replay_budget_v1 SET used_records=used_records+1 WHERE id=1 AND used_records<max_records')
 assert con.execute('SELECT used_records FROM ft_replay_budget_v1').fetchone()[0]==1
 assert con.execute('SELECT count(*) FROM ft_replay_pairs_v1').fetchone()[0]==1
test('reservation can be consumed without creating partial pair',budget_loss)
def monotonic():
 con.execute('INSERT INTO ft_replay_pairs_v1 VALUES(?,?,?,?,?,?,?)',('other',42,1000,1001,'b'*64,'{}','{}'))
 assert con.execute('SELECT COUNT(*) FROM ft_replay_pairs_v1').fetchone()[0]==2
test('multiple fixture observations can coexist immutably',monotonic)
Path('ft-audit-output').mkdir(exist_ok=True)
result={'status':'PASS','checks':checks,'scope':'LOCAL_SQLITE','cloudflare_runtime_certified':False}
Path('ft-audit-output/ft-3d-pair-sqlite-tests.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
