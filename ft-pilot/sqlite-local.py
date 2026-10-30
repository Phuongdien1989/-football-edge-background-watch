"""SQLite emulator for OFFLINE tests only; each call opens a new connection.
No Cloudflare account or network. .meta.rows_written approximated by changes;
NOT Cloudflare D1 billed index rows, which must be measured in real pilot."""
import json,sqlite3,sys
req=json.load(sys.stdin)
con=sqlite3.connect(req['db'], timeout=5)
con.row_factory=sqlite3.Row
try:
    cur=con.execute(req['sql'],req.get('params',[]))
    rows=[dict(row) for row in cur.fetchall()] if cur.description else []
    changes=con.execute('SELECT changes()').fetchone()[0]
    con.commit()
    print(json.dumps({'results':rows,'meta':{'changes':changes,
       'rows_written':changes if req.get('method')=='run' else 0,
       'rows_read':len(rows)}}))
except Exception as e:
    print(json.dumps({'error':str(e)}))
    sys.exit(2)
finally:
    con.close()
