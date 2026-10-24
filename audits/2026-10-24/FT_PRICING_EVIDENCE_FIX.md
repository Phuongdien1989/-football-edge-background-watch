# FT pricing and exact decision evidence — 24 October 2026

Base: b8fe4ea4aad4629e7608012b58e214835c5fd3f4, PR16. Served core SHA256 checked directly: 1ee74e827136bb08a9c506fda82ccd677bc4be65c07b4da37491f3dc2e8605c5.

## Implemented
- Reviewer V2 uses settlement weights W=P(win)+0.5P(half-win), L=P(loss)+0.5P(half-loss). Weighted model share W/(W+L) is compared with 1/odds; neither is labelled probability of full win. The five outcome probabilities remain visible separately.
- Sensitivity holds W+L fixed and perturbs weighted share +/-5pp. EV=(W+L)*(share*odds-1). This is a hypothetical scenario, not calibrated uncertainty. No forecast/ranking threshold changed.
- Reviewer can emit TRIAL_OVER only when core recommendation does. A shadow/demo assessment cannot independently become a trial recommendation merely because EV is positive.
- New pure exact-decision serializer freezes source snapshot, model PMF, quote, decision, policy, source commit and actual decision time together. Original snapshot time and decision time are distinct. Mutable source objects cannot change the serialized record. Missing raw odds remain null. Future context and oversized records rejected. Includes non-recommendations and missing-price decisions.
- Settlement helper uses regulation score once, treats unverified final as pending and flags a score correction for review. Result is hypothetical return, never a claim of an actual bet.

## Validation
11 local test scripts PASS plus integrated module syntax. Existing core suite 36 tests. Added hand-calculated binary/integer/quarter quote comparisons and card/core parity; EV below 1% at odds 2.9 stays eligible. Synthetic serializer checks include mutable input, future context, missing odds, negative EV, AET regulation score and pending outcomes. No real accuracy claim.

## Deliberate production boundary
No deployment, remote migration, D1 queries/writes, scanner changes or provider calls. No HT/HC/backend/overall TOP/Push source changed. Model and core ranking untouched. Changes staged on a separate branch because PR16's push workflow named “preflight” actually deploys when integrated.mjs changes. Do not push these files to that branch without updating the release mechanism.

## Remaining integration gap — must not be concealed
Current ft-pilot recorder captures LEGACY BACKEND FT evaluation and sender acceptance. Current browser AI V2 is computed from browser bridge + DEEP context. Enabling that recorder alone does not preserve the displayed V2 PMF or decision. The new serializer is tested but NOT wired to persistence. There are no new real prediction/outcome pairs from this change.

Required next storage patch: transmit the serialized browser decision to an authenticated, size-bounded FT-only receiver (no provider requests), retain raw source rows when bridge supplies them, and write atomically with a unique epoch+fixture key under the existing pilot limits. Receiver must not trust a client assertion as provider-attested or allow client code to set server logic identity. Distinguish client source commit from receiver code version. Validate contract, identity, receipt times and recompute settlement/EV before accepting. The exact displayed decision and server verification must both be preserved; never replace the original with a reconstructed forecast. This is a separate runtime path requiring code and security review, not a schema-only activation.

Storage gate remains: default OFF, max5 unique fixtures, one pair each, capture4h, outcomes72h, max10 outcome revisions, pair20KB, max60 reserved SQL attempts and 240 provisional billed-write tokens per epoch. These existing limits require measured D1 amplification; not a billing guarantee. Sampling must use V2 decision class, not legacy Push acceptance. Outcomes only from existing final-result responses; absent remains pending. Cost includes client-to-Worker transport and D1/DO even though provider calls remain zero.

## Release/rollback requirements
Frontend pricing patch must update the installed FT V2 module files in the existing shell; do not inject a second card. Capture all live asset hashes and active Mobile version just before release; preserve root HTML and every non-FT asset byte for byte. The old release script pins the pre-V2 Mobile and cannot be rerun unmodified. Back up current Mobile as rollback; verify backend/Desktop versions unchanged. Storage remains OFF until its complete receiver/producer package is reviewed and approved. Keep all evidence tables on rollback.
