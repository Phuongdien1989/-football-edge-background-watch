"""Local test adapter only. Each invocation opens a new connection, like a restarted client."""
import json,sqlite3,sys
request=json.load(sys.stdin)
db=sqlite3.connect(request['path'],timeout=30)
db.row_factory=sqlite3.Row
try:
    cursor=db.execute(request['sql'],request.get('args',[]))
    row=cursor.fetchone()
    result=dict(row) if row else None
    changes=db.execute('SELECT changes()').fetchone()[0]
    db.commit()
    print(json.dumps({'row':result,'changes':changes}))
finally:
    db.close()
