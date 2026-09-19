# Football Edge V1.23.2 — Evidence Database

- App release V1.23.2 syncs QSIG + Validation evidence to D1.
- Worker release V1.2.2 adds persistence/read/export for `qsig_results` and `validation_results`.
- D1 schema remains V1.23.1; no SQL migration is required because both tables already exist.
- `worker.js` V1.2.1 remains the stable base; `worker_v122.js` is an additive wrapper and is now the Wrangler main module.
- `/api/db/stats` now reports QSIG and Validation counts.
- Core H1/FT/HC, QSIG qualification, TOP ranking and Entry Policy are unchanged.
