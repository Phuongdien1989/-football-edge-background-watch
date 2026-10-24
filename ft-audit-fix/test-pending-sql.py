import sqlite3,json
from pathlib import Path
sql=json.loads(Path('ft-audit-output/pending-query.json').read_text())['sql']
db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
db.executescript(Path('ft-audit-fix/replay-ledger.sql').read_text())
db.executescript(Path('ft-audit-fix/pending-index.sql').read_text())
insert='INSERT INTO ft_replay_records_v1 VALUES(?,?,?,?,?,?,?)'
for n in range(30):
    oid=f'{n:03}'
    db.execute(insert,('OBS:'+oid,'OBSERVATION',oid,42,1000,'hash','{}'))
    if n<20: db.execute(insert,('OUT:'+oid,'OUTCOME',oid,42,2000,'hash','{}'))
db.execute(insert,('DEC:020','DECISION','020',42,1001,'hash','{}'))
first=db.execute(sql,('',5)).fetchall()
assert len(first)==5 and all(x['has_outcome'] for x in first)
cursor='';seen=[]
for _ in range(7):
    page=db.execute(sql,(cursor,5)).fetchall()
    if not page:cursor='';continue
    seen.extend(x['record_id'] for x in page);cursor=page[-1]['record_id']
assert len(seen)==30 and len(set(seen))==30 and cursor==''
page=db.execute(sql,('OBS:019',2)).fetchall()
assert page[0]['has_decision']==1 and page[0]['has_outcome']==0
assert page[1]['has_decision']==0
plan=[x[3] for x in db.execute('EXPLAIN QUERY PLAN '+sql,('',5))]
assert any('MATERIALIZE page' in x for x in plan)
assert sum('ft_replay_by_observation_kind' in x for x in plan)==2
assert any('record_id>?' in x for x in plan)
Path('ft-audit-output/pending-sql-tests.json').write_text(json.dumps(dict(status='PASS',checks=6,backend='local SQLite',plan=plan),indent=2))
print('PENDING_SQL_PASS 6')
