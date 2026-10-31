# PRE-MATCH AI V1 — isolated prototype

This branch implements the approved Step3 design. It does not deploy, migrate
production D1, enable scanning, send Push or modify any HT/FT/HC entrypoint.
No production file imports this directory. There are no secrets or football
provider requests in the feature. `host.mjs` is opt-in and defaults OFF.

## Preview

```
node prematch-ai/test.mjs
node prematch-ai/build.mjs
```

Open `prematch-ai/generated/index.html` directly in a modern browser. This is a
self-contained offline HTML: no install, provider key or web service required.
Its CSP rejects network connections. It starts empty; the LAB button explicitly
loads fictional teams, a reproducible synthetic training set and fictional odds.
LAB is not model validation and must never be presented as real fixtures.

The optional local host preview uses an already preserved Mobile package:

```
node prematch-ai/build-host.mjs mechanism-mobile/site
python3 -m http.server 8765 --directory prematch-ai/generated
```

Open `/host/`. This copies the app; original54 assets remain untouched. CSP
isolates the copy from production. A separate preview button opens PRE and
returns to the unchanged LIVE DOM. Never deploy this generated host preview.

## Real data contract and offline fitting

Training input is JSON:

```
{
  "leagueId": 123,
  "cutoff": 1793400000000,
  "synthetic": false,
  "history": [
    {
      "id": 123456, "leagueId": 123, "homeId": 11, "awayId": 22,
      "kickoff": 1793000000000, "availableAt": 1793007200000,
      "status": "FT",
      "regulation": {"home": 2, "away": 1},
      "halftime": {"home": 1, "away": 0}
    }
  ]
}
```

These numbers show the schema only, not real match data. Use actual source
receipt times. AET/PEN require explicit90-minute score; never substitute the
score after extra time. Null/missing HT is allowed; null is never zero. Each
fixture is deduplicated. Conflicting revisions are excluded, not silently chosen.
The offline CLI, not the phone, fits the model:

```
node prematch-ai/cli.mjs train HISTORY.json ARTIFACT.json
node prematch-ai/cli.mjs analyze INPUT.json ANALYSIS.json
node prematch-ai/cli.mjs validate VALIDATION.json METRICS.json
```

Canonical input is `FE_PREMATCH_V1`, containing `artifacts`, `fixtures`, `quotes`
and optional `evidence`. Fixture IDs/team IDs/league ID are numeric, timestamps
are millisecond UTC, status must beNS, and `kind` is REAL or LAB. Each fixture
has `{id,kind,status,observedAt,kickoff,home:{id,name},away:{id,name},league:{id,name}}`.
An optional `neutralVenue:true` removes the fitted home advantage.

Quotes explicitly specify `{fixtureId,source,bookmaker,marketId,type,period,
selection,line,odds,basis,ruleStatus,ruleReference,receivedAt,sourceUpdatedAt,
availability,checkedAt,validUntil,suspended}`. Supported types: 1X2, AH, OU;
periods: FT, HT; basis: REGULATION. Odds must be decimal, numeric and >1.
AH line belongs to the selected team. Source/rule/availability are imported
assertions, not online verified by this preview. Unknown rule => WAIT_RULE.
Unconfirmed or expired price => WAIT_PRICE. Kickoff => CLOSED_PRE.

`adaptDeep` can ingest an already captured DEEP bundle with `observed_at`. It
intentionally does not turn 8 recent rows/provider predictions into an artifact
or guess a PRE market contract. Until a matching real artifact and explicit
quotes are supplied, the real card remains MODEL_WAIT. No real production data
has been exported or new history downloaded for this prototype.

## Implemented

- Offline ridge-Poisson attack/defence, learned home advantage, opponent effects.
- Ridge candidates .1/1/10 chosen via chronological holdout; availability must
  precede validation boundary. No hand-written football scoring weights.
- Separate genuine HT/H2 fits when halftime history exists. FT is the sum of
  phase rates. 1X2/OU/AH/HTFT share coherent score distributions.
- FT-only model if HT unavailable; league-prior LIMITED for unseen teams.
- Exact existing `settleAH` and total-goals settlement maths reused read-only.
- Five payout probabilities, fair odds and EV; quarter lines are not treated as
  binary win probabilities. Matching no-vig is restricted to1X2 and OU.5.
- League-only baseline sensitivity is explicitly model variation, NOT a
  calibrated confidence interval. Sign disagreement => WAIT_MODEL_REVIEW.
- Distinct-fixture TOP5,1 main+2 backups+2 watchlist, per-fixture main option.
- Vietnamese evidence-grounded narrative and12-module availability matrix.
- Worker computation, input/import limits, explicit local ledger save/export,
  hash verification and append-only records in `fe_prematch_ai_v1` IndexedDB.
- Offline multiclass Brier/LogLoss, exact settlement P&L, correction revisions,
  same-contract closing price ratio; missing closing quote remains null.
- One-shot local quote/kickoff expiry evaluation and visibility check, without
  polling, training, provider calls, Push or automatic writes.

## Deliberately not certified/implemented

- Real-world fitted production artifact, real match forecast quality, ROI or CLV.
- Dynamic temporal-form decay, cross-league transfer-strength, player/lineup/
  injury/tactical quantitative effects, Dixon–Coles or Elo challenger.
- Bayesian posterior confidence or probability calibration: all `calibrated`
  flags remain false. Synthetic LAB cannot validate the real model.
- Automatic market verification, web research, LLM service, new acquisition,
  centralized immutable server ledger or any production schema/deployment.
- Prior injection into LIVE engines or PRE Push.

Local hashes detect accidental changes; they are not digital signatures and the
browser owner can edit/delete IndexedDB. Central validation needs independently
verified as-of snapshots/outcomes and a separately approved staging ledger.
The validation report fixes FIRST_FORECAST_PER_FIXTURE to avoid retrospective
best-of revisions; cohort claims must state this policy. Closing price ratio is
not a market probability or proof of edge.

## Safety/ownership

Base checkpoint: cf4b2013a12367c1d097c89d03accb55aa5dcbf1. Only new
`prematch-ai/` files and its preview-only CI workflow are in scope. Existing
54-asset production package, models, thresholds, rollback and PR33 remain intact.
The preview CI has no environment/secrets/deployment step. Keep this PR DRAFT.
