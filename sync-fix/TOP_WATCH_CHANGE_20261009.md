# TOP WATCH V1 — candidate, not completion evidence

User approved relative attention TOP on 2026-10-09. Base: exact completed pre-hide notification-sync release.

Rollback frontend: 9b5bb5f1-fb53-4a54-9825-b0850ea28074, source SHA256 09aaffa8791f64144072dacefa41ec7046ed313063d3c83aa28e68ee6cf3c8e1.
Backend stays 491076a2-78d9-48f0-9050-ffc0f479c531. No backend engine/push threshold changes, R2, research-card hiding, new styles or layout.

Data flow: canonical backend snapshots -> existing sync guard/engine workspace -> one feMasterRankRows ranking -> existing TOP boards + Smart Follow registration. Backend continues scanning with unchanged signal conditions. TOP membership does not trigger a signal or bypass Entry Policy.

TOP accepts usable current LIVE data in existing phase windows, including WATCH/CANDIDATE/partial and low-ranked observations. It excludes no-stats, stale >60s, ended/wrong phase, cooldown, hard veto, conflict and certified adaptive rejection. Existing READY/STRONG semantics stay separate in confirmed metadata. A displayed TOP observation gets CHO label without state mutation. Engine score ranks relative to peers within the same engine (percentile); raw H1/FT score is never compared directly to HC GAP. Existing state quality ordering remains ahead of relative strength.

Freshness and phase are checked on every ranking read; no automatic signal promotion. Smart Follow consumes the same TOP and preserves manual follows. Registration still uses existing configured background settings and budgets.

Verification gates: exact reversibility to frozen source; all inline JS parse; byte-identical engine/state/QSIG/threshold functions; 25 deterministic TOP cases; actual WebKit at 375/390/1280 with score60 vs58 CHO and Smart Follow; actual deployed hash/assets; actual production sync and API LIVE scan/TOP. Failed post-deploy checks automatically restore and hash-verify exact pre-hide frontend. Physical iPhone notification click is not independently verified.
