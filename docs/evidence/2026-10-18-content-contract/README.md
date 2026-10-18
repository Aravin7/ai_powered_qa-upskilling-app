# Complete scope and effort contract — 18 October 2026

Branch `codex/qa-pathway-requirements-amendment`, base `535c74b327df9320486be781e256748a1542e77a`, plus uncommitted changes. Windows PowerShell; Node 24.19.0; Prisma 7.10.0; Next 16.3.8; isolated PostgreSQL 18.4 at localhost:55461 (`qa_pathways_20261017`). Existing user edits and quota override preserved. No schema migration, application DB change, paid/live AI, real OAuth, push, merge or deployment.

## Implemented and verified

New publication/activation/current-active reads require complete scope and effort records. Immutable historical records remain readable. Scope includes included/excluded work, starting knowledge and exactly one rationale per prerequisite. Five integer effort components sum to declared topic minutes; shared setup has stable identity and identical activity/minutes wherever reused. Workload calculation removes confirmed-topic learning work and counts each still-required setup once. It is not a scheduler or feasibility proof.

The explicit fourteen-node `qa-capabilities-draft-v2` removes runtime dependence on the sample catalogue and replaces placeholder meanings. Observability proposes interpreting supplied signals, with API testing as its prerequisite; performing load testing is outside that exercise. CI no longer maps the broader ci/cd phrase as exact equivalence. All content and estimates remain proposals with review:null and no direction rules. The earlier review date supplied by the user has no identified document/version or scope, so it cannot approve this revision.

## Observed checks

- First focused execution: **74 Passed, 1 Failed** (75 cases). SR-11's old fixture incremented total minutes without a corresponding effort component. This correctly failed the new arithmetic gate before reaching its intended registration-conflict assertion. Corrected the fixture to increment practice effort as well; no application assertion was weakened.
- Corrected SR-11 rerun: **1 Passed**, 17 filtered/not run in that invocation. Total distinct cases with a passing observation across runs: **75** (34 requirement compiler, 13 content contract, 18 snapshot/mapping DB and 10 reviewed-direction DB).
- Added legacy-active-pointer assertion in SR-17 and reran: **1 Passed**, 17 filtered. It verifies historical reads work while activation and current learner access reject incomplete metadata; active version restored afterward.
- TypeScript and targeted ESLint: **Passed** (exit 0).
- Read-only draft validator returned fourteen nodes, detailsComplete=true, reviewed=false and digest `526339a6d36c89f03fe948f23f9ecd114bdb8aec76ec0961285b3d521f6f971c`. `--reviewed` correctly failed with CONTENT_REVIEW_REQUIRED (exit 1). This expected denial is not professional approval.
- Browser regression with complete synthetic metadata: **Passed 1** (1.2 minutes test / 2.7 minutes including startup). Existing [direction screenshots](../2026-10-18-reviewed-direction/README.md) were refreshed by the signed-identity mapping/direction journey. `git diff --check` **Passed**, with existing LF/CRLF notices.

## Requirement mapping

| Cases / requirements | Preconditions, actions and expected result | Observed |
| --- | --- | --- |
| RC-01 / R06,R12 | Validate real unapproved draft structure; attempt publication readiness. All fourteen have scope/effort; review gate denies approval. | Passed |
| RC-02 / R12 | Synthetic reviewed digest but missing scope. Reject publication despite digest. | Passed |
| RC-03, five variations / R07 | Change one effort component without total. Reject every mismatch rather than clamp. | Passed |
| RC-04 / R06 | Remove prerequisite rationale. Reject incomplete prerequisite contract. | Passed |
| RC-05 / R07 | Reuse setup ID with different activity. Reject conflicting shared setup. | Passed |
| RC-06 / R07 | Three 120-minute synthetic topics share 10-minute setup; defer optional node; repeat with confirmed prerequisites. Return 340 total, then 120, then zero; no duplicate setup or invented filler. | Passed |
| RC-07 / R06,R12 | Change scope boundary or effort after review. Meaning identity/digest changes invalidate old approval. | Passed |
| RC-08 / R06,R07 | Empty scope or troubleshooting limitation. Reject strict schema. | Passed |
| RC-09 / R07 | Nonzero anonymous setup or foreign confirmed workload ID. Reject; no guessed omission. | Passed |
| SR-17 / R06,R12 | Incomplete synthetic legacy snapshot and active pointer. Preserve historical read; deny new registration, activation and current learner access. | Passed, including follow-up assertion |
| SR-18 / R06,R12 | New snapshot changes included scope under same meaning version. Reject; accept after new meaning version and review digest. | Passed |
| Existing RQ/RD/SR cases | Compiler, explicit mappings, version/transaction/race and plan-preservation regressions under complete synthetic metadata. | Passed across stated runs |

## Three concise examples

1. **Honest arithmetic:** expected three 120-minute topics sharing one 10-minute setup to require 340 minutes, not 360 or a shortened capacity-fitting total. Actual: three 110-minute topic portions plus one 10-minute setup, total 340. **Passed (RC-06).**
2. **Changed boundary:** expected expanded included knowledge to require reconfirmable meaning provenance. Actual: registration rejected the reused meaning version; the new meaning version with a new digest registered. **Passed (SR-18).**
3. **Failure/fallback:** expected legacy metadata to stay readable without becoming active content. Actual: immutable historical load succeeded, registration/activation/current-active read returned CONTENT_DETAIL_REQUIRED, and the previous valid activation was restored. **Passed (SR-17).**

## Commands and limits

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/requirements.test.ts tests/requirement-content.test.ts tests/integration/skill-reconciliation.test.ts tests/integration/reviewed-direction.test.ts
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/skill-reconciliation.test.ts -t 'SR-11'
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/skill-reconciliation.test.ts -t 'SR-17'
node node_modules/typescript/bin/tsc --noEmit
node --import tsx scripts/validate-requirements.ts
node --import tsx scripts/validate-requirements.ts --reviewed
node node_modules/@playwright/test/cli.js test tests/e2e/skill-review.spec.ts
```

DB tests require the dedicated TEST_DATABASE_URL; browser execution requires RUN_AUTHENTICATED_E2E=true, E2E_PORT=31361, a Chrome executable and the same migrated isolated DB. Run mutating suites sequentially. Provider behavior remains mocked where existing regressions use it; the new workload/content code makes no provider calls. No full suite/build, live search, real-page check, real OAuth, accessibility/device matrix, deployment/retention/backup verification or professional semantic evaluation ran. Real review, direction-rule content, resource research and immutable reviewed-roadmap activation remain outstanding; the overall goal is not complete.
