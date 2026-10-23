# Gate A — approved for isolated staging, NOT B or C

User authorized Gate A on 23/10/2026 subject to permissions, resource and account budget verification. No production D1 or scanner writes are authorized.

## What is possible without Cloudflare mutations
- Existing safe read-only runner `ft-audit-fix/d1-readonly-analytics.mjs` is already in repository, uses GET account D1 inventory and Cloudflare GraphQL analytics only; it uses no D1 SQL and no deployment.
- New one-shot `.github/workflows/ft-pilot-gate-a-readonly.yml` uses the existing restricted GitHub environment only to access its Cloudflare credentials. It must not be mistaken for production deployment.
- A previously labeled isolated D1 has ID `e82758f2-e533-44a6-b42d-4821d120e082`, which is NOT yet independently verified as reusable for Gate A. Production D1 ID `0d12a7cc-12a9-4c71-b55b-61dfd2dac4d4` is expressly prohibited for staging.
- D1 adaptive analytics may lag; reported daily usage is not the enforced billing counter or a guarantee of free allocation. If insufficient or inaccessible, fail closed and create no cloud resources.

## Cloud deployment HOLD criteria
1. Verify authenticated Cloudflare account ownership, available quota including other workloads, D1 database identities, potential permission/environment approval, and current billing status.
2. Verify the new Worker, DO and D1 IDs are separate; no production UUID, API-Football key, push credentials, routes, cron or scanner.
3. Use `FT_PILOT_ENABLED=false`; do not start the recorder. Use only synthetic/local replay input for remote QA.
4. Cloud resource creation/deployment is permitted under Gate A only AFTER 1-3 are evidenced. Do NOT opportunistically reuse historical D1 just because it exists.
5. Report exact resource IDs, CPU/DO/D1 billing metrics, rollback, and stop gate. Gate B/C still require independent authorizations.

Gate A authorization does not mean account Free limits are available. All FT AI fair odds, EV, TOP and recommendations remain OFF.
## Gate A independent static isolation guard — 23/10/2026
GitHub workflow `.github/workflows/ft-gate-a-isolation-guard.yml` asserts no production DB/DO names or UUID in staging, no provider/Push credentials, no route/cron, FT recorder OFF, exact Workerd compatibility date, unresolved new D1 ID and missing migration prevents accidental deploy. Pass certifies review-template constraints only, NOT Cloudflare cloud isolation. Cloudflare plan-specific billable quota and actual remaining headroom still UNKNOWN.

Verified official Cloudflare D1 Free limits: 5,000,000 rows read and 100,000 rows written daily UTC per account. On reaching quota queries fail until UTC reset; adaptive GraphQL analytics may lag. See https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/d1/reference/faq/.

Cloudflare roles: creating a NEW Worker requires Workers product Admin, while DO permissions follow its implementing Worker. Prior CI read-only GraphQL/D1 success does NOT prove Admin permission. See https://developers.cloudflare.com/workers/authorization/workers/.

**Cloud provisioning remains HOLD** until fresh reliable quota/billing plan, Worker Admin capability and genuinely separate identifiers verified. User Gate A approval remains valid; Gate B/C not approved.