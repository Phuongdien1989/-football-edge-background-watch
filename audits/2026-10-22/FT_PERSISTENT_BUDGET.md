# FT persistent collection budget — staged, 2026-10-22

Parent: f4679caf39aba0e45f3b000a444361d5699b9178. No deployment or production schema/data changes.

## What is implemented
A new opt-in collector composes the existing observation serializer and ledger with an atomic database reservation. A singleton budget row holds an explicit time window, record allowance and byte allowance. The collector cannot create, reset, extend or increase it. Missing/expired budget denies collection. Clock rollback relative to the last reservation denies collection.

Reservation occurs before any ledger operation. Crashes, duplicate records, write failures and ambiguous timeouts retain the allocation; no automatic refunds. This conservatively bounds accepted collection attempts and reserved payload bytes across collector instances and restarts sharing the same database. It is NOT a cap on total D1 queries, billed rows, database size, or all app activity.

## Evidence
12 tests run the actual SQL on local SQLite through a D1-shaped adapter, with fresh connections per operation.
- 12 separate concurrent processes competing for 3 allocations: exactly 3 succeed; 300 bytes reserved.
- Recreating the collector cannot refill the budget.
- Database failure prevents ledger writes; ledger failure does not refund the reservation.
- Disabled/invalid inputs perform no SQL.
- New observation: 4 SQL calls (reservation + existing 3 ledger calls).
- Exact retry: 2 SQL calls (reservation + dedup read). It still consumes one reservation.
- Rejected budget: 1 SQL call; repeated rejections can continue consuming reads.
These are statement counts, not Cloudflare billing measurements. Reservation updates add writes; exact retries now also write budget state.

## Still required before production
No Worker hook or deployable bundle change is included. Budget schema and provisioning have NOT been applied anywhere remotely. Window renewal policy, persistent suppression/rate limiting of denied attempts, measured billed rows including indexes, and remote disposable-D1 integration remain open. No automatic day rollover or deletion is supplied; a fixed trial window intentionally expires. Both observation and outcome collection must share the approved allocation before full activation (this collector currently accepts observations only).

Do not use this as proof of end-to-end collection, forecast accuracy, or daily Free quota compliance. Existing model/threshold/ranking/HT/scanner/frontend remain untouched.

## References used
- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/

Rollback for this unactivated stage is reverting its commit; production rollback remains unaffected by this work.
