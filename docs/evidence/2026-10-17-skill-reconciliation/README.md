# Skill reconciliation and immutable snapshots — 17 October 2026

Branch `codex/qa-pathway-requirements-amendment`; base commit `535c74b327df9320486be781e256748a1542e77a` plus uncommitted working changes. Existing user edits, including the quota override, preserved. Windows PowerShell; Node 24.19.0; Prisma 7.10.0; isolated PostgreSQL 18.4 at localhost:55461, database `qa_pathways_20261017`. No production/personal database used or reset.

## Observed checks

- Prisma client generation and additive migration `202610170004_requirement_snapshots`: **Passed**, isolated DB only.
- First execution: **52 Passed** — 34 requirement unit tests, 13 new reconciliation DB tests, 5 existing store DB tests. Vitest duration 14.97 seconds.
- Follow-up after adding rollback/carry-forward cases: **6 Passed** — SR-14, SR-15, W3-1, CV-07a, CV-08d and RM-08b. Duration 16.38 seconds. 44 other cases filtered out in this invocation, not counted as passes. Some had run in the first invocation; unrelated coverage remains Not run.
- Total distinct executed cases across these runs: **58 Passed**, comprising 34 unit and 24 DB/integration cases. Reconciliation itself: **15/15 Passed** across the runs.
- TypeScript and targeted ESLint: **Passed**, including final test additions (exit 0). `git diff --check`: **Passed** with existing LF/CRLF notices.
- No live AI/real Google OAuth, full suite, browser tests, screenshots or production build run. No UI changed. Four affected regression cases use controlled mock providers; reconciliation/snapshot tests make no provider calls. Passing them is not live AI evidence.
- PostgreSQL adapter emitted a concurrent `client.query()` deprecation warning; assertions passed. No timeout/retry increase was used to conceal failures.

## Reproduction commands

Use a migrated isolated local `qa_pathways_*` database in `TEST_DATABASE_URL`. Node was invoked by its installed absolute path with its directory on PATH; TEMP/TMP pointed to ignored `.test-tools/tmp`. Migration execution explicitly set DATABASE_URL and DIRECT_DATABASE_URL to the isolated URL rather than relying on `.env`.

```powershell
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate deploy
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/requirements.test.ts tests/integration/skill-reconciliation.test.ts tests/integration/store.test.ts
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/skill-reconciliation.test.ts tests/integration/ai.test.ts tests/integration/qa-coverage.test.ts -t 'SR-14|SR-15|W3-1|CV-07a|CV-08d|RM-08b'
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/lib/requirement-snapshots.ts src/lib/skill-reconciliation.ts src/lib/requirements.ts src/lib/store.ts tests/integration/skill-reconciliation.test.ts tests/requirements.test.ts
git diff --check
```

## Requirement mapping and executable cases

Each case creates a unique synthetic invited learner and registered synthetic requirement version. Review metadata explicitly says it is a test fixture, not professional approval. Existing completed plan fixtures support preservation assertions; their creation bypasses plan generation and is not a plan-validator test.

| ID / reference | Preconditions, action and expected observable result | Actual |
| --- | --- | --- |
| SR-01 / R05,R06 | Saved canonical, unmatched and C/C++/C# entries; preview a reviewed alias. Offer scope without creating a mapping or altering CV source. | Passed |
| SR-02 / R05,R06,R08 | Confirm two mappings, read from second client, repeat unchanged confirmation. Persist strengths, increment revision once, preserve source rows and completed plan. | Passed |
| SR-03 / R01,R05 | Submit forged, correctly signed expired and cross-user tokens. Reject every request and write no mapping. | Passed |
| SR-04 / R06,R14 | Change profile or target snapshot after preview. Reject stale revision/token. | Passed |
| SR-05 / R05,R08 | Batch valid choices with an unsupported mapping. Reject entire save; preserve inventory revision and plan. | Passed |
| SR-06 / R05,R14 | Submit the same review concurrently via two Prisma clients. One commit; one stale failure; one revision increment. | Passed |
| SR-07 / R05 | Add Git after mapping confirmation; then omit automation without/with explicit removal. Preserve other row IDs/mappings; reject implicit removal; cascade only explicit deletion. | Passed |
| SR-08 / R06,R12 | Register a changed meaning under a new version. Return review_required with separate reconfirmation IDs; explicit reconfirmation establishes current self-report. | Passed |
| SR-09 / R01,R10 | Submit preview after logout, revocation and deletion. Deny late writes; account stays deleted. | Passed |
| SR-10 / R12 | Mutate source object and attempt SQL UPDATE/DELETE of stored snapshot. Database rejects mutation; stored snapshot unchanged. | Passed |
| SR-11 / R12,R14 | Replay same registration and race changed content under same version. Identical replay succeeds; conflicting write fails without overwrite. | Passed |
| SR-12 / R12 | Register actual unreviewed draft or reuse a meaning version with changed scope. Reject; no invalid new snapshot. | Passed |
| SR-13 / R05,R06 | Confirm two saved source entries supporting automation. Count capability once; preserve both original entries. | Passed |
| SR-14 / R05,R08 | Add a temporary failing DB constraint in the isolated DB; second mapping insert fails. Roll back first insert and revision; preserve old plan. Remove constraint in finally, retry unchanged review successfully. | Passed |
| SR-15 / R06,R12 | New snapshot keeps meanings unchanged. Carry existing self-report without rewriting original confirmation provenance. | Passed |
| W3-1, CV-07a, CV-08d, RM-08b / R04–R08,R14 | Existing real PDF/mock-provider flow, merge/explicit removal, forged CV reference and skill-change activation fence. | Passed |
| Existing 34 requirements + 5 store tests | Structural/direction/review regression, eligibility, profile concurrency, task ownership, revocation/deletion. | Passed |

## Three Week 3 examples

1. **Mapping confirmation (SR-02):** expected two explicit confirmations to survive a second-client read, with CI remaining a gap and the old completed plan unchanged. Actual: strength IDs `test-design, automation`, mandatory gap `ci`, seven original skill rows preserved; plan/task snapshot equal. **Passed**.
2. **Immutable history (SR-10):** expected modifying an in-memory draft or issuing SQL UPDATE/DELETE not to rewrite a registered version. Actual: database rejected both mutations and stored record remained equal to its earlier value. **Passed**.
3. **Failure/recovery (SR-14):** expected a real constraint failure on the second mapping insert to roll back the first insert and revision without disturbing old progress. Actual: zero mappings, unchanged revision 2 and unchanged plan; after removing the controlled fault, retry confirmed two mappings at revision 3. **Passed**. No live-provider reliability claim.

## Remaining gates and limits

No professional reviewer or actual direction rule is approved. Registered synthetic snapshots are test-only immutable records; registration is not publication, active catalogue selection or proof of review identity. No public registration or reconciliation API/UI exists yet. Actual draft content, complete effort metadata, professional review, trusted publication/selection, plan/resource snapshots and live resource research remain outstanding. Text comparison detects changed scope/label/level under a reused meaning version; it cannot judge semantic equivalence. Omitted mappings stay unchanged; explicit mapping withdrawal UX is not implemented. Plan preservation is tested, but no new-plan activation or multi-instance publication fence is claimed here. Snapshots contain public/synthetic requirement metadata, not raw CV text/evidence. Test learner records are cleaned up; synthetic immutable snapshot history is retained in the isolated cluster, which was stopped after testing. Application database untouched.
