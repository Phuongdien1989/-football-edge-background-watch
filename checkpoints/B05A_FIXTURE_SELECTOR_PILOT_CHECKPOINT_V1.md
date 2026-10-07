# FOOTBALL EDGE — FIXTURE ELIGIBILITY + NEXT PILOT CHECKPOINT V1

Status: READY_FOR_USER_APPROVAL
Created: 2026-10-07
Production/model: FROZEN / UNCHANGED
No provider calls authorized by this manifest until explicit approval.

## Evidence baseline
- Successful real smoke run: 37648059824
- Evidence artifact: 11496021709
- Artifact digest: sha256:682a4f9cfe1d4121bacd771c53ea8498515eafff294eeac1adad93978a1b7c23
- Fixture: 1627266
- Provider attempts: 40
- Raw captures: 40
- Locked observations: 8
- OLD exact outputs: 8
- Result: pipeline PASS; predictive comparison INSUFFICIENT_EVIDENCE.
- Missing source data on all 8 ticks: statistics EMPTY_VALID, events EMPTY_VALID, live odds EMPTY_VALID. Market status NO_SUPPORTED_MARKET / NO_ENTRY. Outcome unresolved.

## Fixture eligibility contract
A candidate is evaluated from real provider payloads; scoreline/activity is never a proxy for data completeness.

FOOTBALL_ELIGIBLE requires:
1. Fixture is live and has stable fixture_id/status/minute/teams.
2. Statistics endpoint is present and contains usable values. Zero is a valid statistic. Empty/null-only statistics are NOT usable.
3. Events endpoint is present and structurally valid.
   - [] is VALID_NO_EVENTS and is allowed.
   - Missing endpoint/capture is ENDPOINT_MISSING and is not equivalent to no events.
   - Malformed event rows are INVALID_EVENTS.
4. received_at <= evaluation_cutoff for every feature used.
5. Capture integrity/hash and persistence/ACK checks pass.

MARKET_ELIGIBLE additionally requires a valid supported live-market payload at the same cutoff.
Missing market does NOT disqualify FOOTBALL_ELIGIBLE; it makes market evaluation ineligible and must be reported explicitly.

## Anti-selection-bias rules
Do not reject a fixture because it has few/no shots, 0-0 score, no cards, no goals, or low event count.
Low-activity is a required situation, not a failure mode.
Coverage targets remain: one-sided, balanced, pressure-high/threat-low, reversal, red-card, low-activity.
Stratum assignment occurs after eligibility; it must not be used to manufacture eligibility.

## Offline regression locked
Regression cases:
- stats=[] + events=[] => football ineligible because stats unusable; events state VALID_NO_EVENTS.
- usable stats containing zero + events=[] => football eligible; low activity preserved.
- usable stats + missing events capture => ENDPOINT_MISSING / football ineligible.
- usable stats + structurally valid event + market => football+market eligible.
Existing full offline suite must PASS before any provider call.

## Specific fixture evidence / candidate policy
- 1627266 is a negative eligibility reference: DO NOT select again for predictive validation from this smoke; stats/events/market detail endpoints were EMPTY_VALID.
- From the same captured discovery universe, fixture 1517361 (York United vs Supra du Quebec) is the first concrete discovery candidate for selector replay because its /fixtures payload contained 7 valid embedded events at the captured cutoff. It is NOT pre-declared eligible: statistics detail was not captured for it, so it may only become FOOTBALL_ELIGIBLE if the pre-detail stats gate returns usable values in an approved pilot.
- Selector must choose the first candidate satisfying the eligibility contract at run time; no manual preference for high-event/high-scoring matches.

## Proposed next pilot — requires explicit approval
Scope: one pilot only, one selected fixture only, staging only.
Pilot ID: FE-B05A-ELIGIBLE-PILOT-01 (fixed across retries; never rotate ID to bypass budget).
Discovery/status/retry are included in the SAME total request budget.
Hard cap proposed: 40 provider attempts total, <=10 minutes, <=1 detailed fixture.
Selection sequence:
1. status/quota gate;
2. one live discovery snapshot;
3. inspect discovery candidates without excluding low activity;
4. perform the minimum stats/events eligibility probes needed to find one FOOTBALL_ELIGIBLE fixture, within the same cap;
5. prefer a candidate with supported live market, but do not reject football-eligible candidate solely for missing market;
6. once selected, pin exactly one fixture and collect OLD+NEW on identical raw captures/cutoffs;
7. stop on cap, auth/persistence/integrity failure, fixture disappearance, or inability to find eligible candidate without exhausting reserve.
Reserve rule: do not spend the full budget searching. Keep enough requests to collect at least 4 comparable ticks for the selected fixture; otherwise stop as NO_ELIGIBLE_FIXTURE_WITHIN_BUDGET.
No automatic second pilot.

Required output:
- attempts total and by endpoint;
- selected fixture and eligibility reason;
- raw captures / observations / OLD exact outputs;
- stats/events/market states per tick;
- received_at/cutoff leakage audit;
- persistence/ACK/readback result;
- football evaluation eligibility and separate market eligibility;
- outcome/settlement status;
- OLD vs NEW only on same raw universe/cutoff.
No outcome or insufficient sample => CHUA_DU_BANG_CHUNG. Smoke success never implies NEW > OLD.
