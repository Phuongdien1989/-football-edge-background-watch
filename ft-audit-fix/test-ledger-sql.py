"""Execute candidate SQL against local SQLite, not production D1."""
import json, sqlite3
from pathlib import Path
fixture=json.loads(Path('ft-audit-output/ledger-sql-fixture.json').read_text())
db=sqlite3.connect(':memory:')
db.executescript(Path('ft-audit-fix/replay-ledger.sql').read_text())
keys=('record_id','kind','observation_id','fixture_id','recorded_at','content_hash','payload_json')
records=[tuple(r[k] for k in keys) for r in fixture['records']]
for r in records:
    db.execute(fixture['insert'],r)
assert db.execute('SELECT COUNT(*) FROM ft_replay_records_v1').fetchone()[0]==3
before=db.total_changes
for r in records:
    db.execute(fixture['insert'],r)
assert db.total_changes==before
scores=[json.loads(x[0])['score']['home'] for x in db.execute("SELECT payload_json FROM ft_replay_records_v1 WHERE kind='OUTCOME' ORDER BY recorded_at")]
assert scores==[2,1]
for index,value in [(1,'INVALID'),(3,0),(4,0)]:
    bad=list(records[0]);bad[0]='invalid'+str(index);bad[index]=value
    try:
        db.execute(fixture['insert'],bad)
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('constraint missing')
result=dict(status='PASS',checks=6,backend='local SQLite',production_writes=0)
Path('ft-audit-output/ledger-sql-tests.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
