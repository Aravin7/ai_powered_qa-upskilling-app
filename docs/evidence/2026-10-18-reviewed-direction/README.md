# Reviewed direction selection and gap comparison — 18 October 2026

Branch: `codex/qa-pathway-requirements-amendment`. Tested base commit: `535c74b327df9320486be781e256748a1542e77a`, plus uncommitted implementation/tests/docs from this and earlier slices. Existing user changes were preserved, including the ten-attempt quota override. This is not a clean-commit or remote-Git verification.

Environment: Windows PowerShell, Node 24.19.0, Next 16.3.8, Prisma 7.10.0, Chrome, isolated PostgreSQL 18.4 at localhost:55461 with database `qa_pathways_20261017`. Migration `202610180001_reviewed_direction` was applied only there. No personal/application database was reset or migrated. All learners, requirements, source URLs and review metadata are synthetic fixtures. No live AI, real Google OAuth, paid request, publication of real requirements, deployment, push or merge occurred.

The isolated test database was stopped after verification. Its synthetic immutable snapshot history is retained for reproducibility; disposable learner data was cleaned up.

## Behavior verified

Private reviewed-direction selection binds an active immutable requirement version, server-owned rule and explicit optional deferrals. Comparison uses only the saved binding and confirmed capability meanings. Server-derived mandatory/optional gaps and reconfirmation needs remain distinct. Repeated identical selections are no-ops; changes increment planning revision without replacing skills, plan or progress. A new active requirement version leaves the old selection saved but rejects its use as current. Preferences changing meaningfully clear the reviewed selection. Account deletion cascades it.

Until reviewed resource/plan activation is implemented, a selected reviewed direction with gaps cannot invoke the legacy generator. No-gap generation returns NO_GAPS without consent/funding/provider dispatch, operation creation or replacement. This is deterministic application behavior, not evidence of live AI quality.

## Observed execution

- Prisma generation and isolated additive migration: **Passed**.
- Focused Vitest: **38/38 Passed**, 51.09 seconds, across 10 new direction cases, 16 reconciliation cases and 12 existing pathway cases.
- TypeScript: **Passed** after correcting two test-harness type mistakes (provider mock method and attempt ownership filter). No application assertion was weakened.
- Targeted ESLint: **Passed** for implementation and tests, including the final UI-only follow-up. `git diff --check`: **Passed**, with existing LF/CRLF notices.
- Expanded SR-E2E/RD-E2E Playwright journey: **Passed 1 unique journey**, first run 1.6 minutes for the test / 3.7 minutes including startup. Final rerun after wording/layout adjustments also **Passed** (28.0 seconds test / 1.1 minutes including startup); all three screenshots refreshed and the saved/stale views visually inspected.
- PostgreSQL adapter emitted its existing concurrent-query deprecation warning. Next reported slow filesystem and colour-variable notices. No application safety deadline or retry count was relaxed.
- Initial isolated DB startup omitted its dedicated port and failed to bind the default; corrected to localhost:55461 before migration/tests. No existing database service was changed.

## Requirement-to-test matrix

Common setup: each DB case creates a unique invited synthetic learner with confirmed profile, automation/SQL inventory, one confirmed automation meaning and an existing four-task completed plan. A synthetic registered/active library contains delivery and maintenance rules, CI dependent on automation and optional observability dependent on load testing. Cleanup removes learner/invitation data; immutable synthetic requirement history remains in the isolated cluster.

| ID / requirements | Actions and expected observable result | Actual / evidence |
| --- | --- | --- |
| RD-01 / R06,R08,R15 | Select delivery and defer observability; read using another client; repeat same save. Derive CI gap, omit optional-only load/observability, increment revision once; retain SQL and old plan. | Passed; real DB assertions |
| RD-02 / R06 | Submit unknown direction, mandatory deferral, forged priority and forged gap fields. Reject all; create no selection or revision change. | Passed; strict schema/compiler assertions |
| RD-03 / R06,R12 | Select version A, activate B, then compare/save against A. Return stale notice/error; retain A selection and plan. | Passed; real DB assertions |
| RD-04 / R14 | Submit two different selections with the same revision via separate Prisma clients. Exactly one commits; one fails; one row/revision increment. | Passed; concurrent transaction assertions |
| RD-05 / R06,R07 | Select maintenance with all required meanings confirmed; request a plan with no consent/funding. Return NO_GAPS, call no provider, create zero operations/attempts and preserve old plan. | Passed; spy and DB assertions |
| RD-06 / R07 | Request a plan for reviewed delivery with a missing requirement. Fail REVIEWED_ROADMAP_UNAVAILABLE before operation reservation; preserve plan. | Passed; real DB assertions |
| RD-07 / R01,R10 | Read as another learner, forge owner field, revoke invitation, delete account, then attempt a late write. No foreign comparison; denied mutations/read; deletion cascades selection and prevents recreation. | Passed; real DB assertions |
| RD-08 / R06,R15 | Save identical preferences then changed preferences after selecting. No-op preserves selection; changed preference clears it; completed tasks remain. | Passed; real DB assertions |
| RD-09 / R06 | Remove mapping provenance while retaining the skill; select maintenance. Return review_required with automation in reconfirmation IDs and no fabricated mandatory gap. | Passed; real DB assertions |
| RD-10 / R08,R14 | Install a temporary failing constraint in the isolated DB; switch direction, remove fault and retry. Failure rolls back selection/revision and preserves progress; retry succeeds; old-revision save fails. | Passed; constraint removed in finally |
| SR-E2E/RD-E2E / R01,R05,R06,R08,R12,R15 | Test-signed browser session; explicitly confirm two source mappings, choose delivery, reload, submit forged fields, request unavailable plan, switch active requirement version. Preserve saved comparison and completed plan; 401 unsigned options, 400 forged save, 409 plan/stale gaps; zero AI operations. | Passed; route/UI/DB assertions and screenshots |
| Existing SR-01–SR-16 and IT-PX01–IT-PX12 | Reconciliation, immutable history, input/consent/lease/deadline/provisional-selection regressions. | 28 Passed in the focused run; controlled mock-provider evidence only where applicable |

## Three Week 3 examples

1. **Saved comparison:** expected confirmed automation to satisfy one requirement while CI remained a learning need, with SQL retained outside the direction. Observed one confirmed match, one required need and unchanged saved skills after reload. **Passed.** [Saved comparison](01-saved-comparison.png) · [Reload](02-comparison-after-reload.png).
2. **No-gap path:** expected no model attempt and no replacement when the maintenance rule was fully covered by confirmed self-report. Observed NO_GAPS, no provider calls, zero operation/attempt rows and unchanged active completed plan. **Passed (RD-05).** No claim of competence or live generation.
3. **Failure/fallback:** expected a changed active requirement version to prevent stale comparison while retaining the learner's old choice and plan. Observed HTTP 409, explicit review message and all four tasks still completed on the active plan. **Passed (RD-03/browser).** [Stale-version message](03-stale-version.png). RD-10 separately verifies rollback under a controlled real database failure.

## Reproduction

Use a disposable local `qa_pathways_*` database in TEST_DATABASE_URL. Migrate with DATABASE_URL and DIRECT_DATABASE_URL explicitly pointing to that same isolated database. Browser testing also needs RUN_AUTHENTICATED_E2E=true, E2E_PORT=31361 and PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Do not run the mutating DB suite and browser suite concurrently: both intentionally exercise the singleton test activation pointer.

```powershell
node node_modules/prisma/build/index.js generate
node node_modules/prisma/build/index.js migrate deploy
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/reviewed-direction.test.ts tests/integration/skill-reconciliation.test.ts tests/integration/pathways.test.ts
node node_modules/@playwright/test/cli.js test tests/e2e/skill-review.spec.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js 'src/app/api/[...path]/route.ts' src/components/reviewed-direction.tsx src/components/workspace.tsx src/components/pathway-explorer.tsx src/lib/reviewed-direction.ts src/lib/skill-reconciliation.ts src/lib/store.ts src/lib/ai-operations.ts src/lib/types.ts tests/integration/reviewed-direction.test.ts tests/e2e/skill-review.spec.ts
git diff --check
```

## Remaining gates / not run

**Blocked by external evidence:** actual professional review of capability meanings, effort, sources and direction priorities; real review/activation authorization; approved native-search processing/tool-cost/funding terms. The real draft remains review:null and inactive. Synthetic fixture registration is not professional approval.

**Not implemented:** live suggestion grounding in the reviewed library; binding researched, verified two-resource topic pairs into immutable plans; reviewed-direction roadmap validation/activation. The signed-in screen can expose active reviewed rules, but novel suggestions cannot manufacture those rules.

**Not run here:** full unit/integration/E2E suites, production build/deployment compatibility, live provider/native search, real OAuth, browser/device/accessibility matrix, recoverable network interruption, simultaneous operator-activation/learner-save stress across multiple app processes, T13 professional usefulness measurement, provider retention, backup restoration/deletion, semantic professional plan review. Two Prisma clients verify shared-DB selection races, not multiple deployed app instances. The user quota override remains ten versus the specified five, unchanged and not verified by this slice.
