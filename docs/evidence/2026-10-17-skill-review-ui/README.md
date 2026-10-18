# Learner skill review UI — 18 October 2026

Tested branch `codex/qa-pathway-requirements-amendment`, base commit `535c74b327df9320486be781e256748a1542e77a`, with uncommitted changes. Windows PowerShell, Node 24.19.0, Next 16.3.8, Prisma 7.10.0, Chrome and isolated PostgreSQL 18.4 (`qa_pathways_20261017` on localhost:55461). Only the isolated database received migration `202610170005_requirement_activation`. Existing user edits, including the ten-attempt quota override, were preserved. No paid AI, production database, real Google OAuth, push, merge or deployment was used.

The private `/api/requirements/active` and `/api/skills/reconciliation` routes expose only the active reviewed snapshot to eligible signed-in learners. The My skills screen permits explicit mapping of saved skills to reviewed meanings, retains original labels and CV/manual source, and reloads confirmed mappings. An internal operator service activates an immutable snapshot and increments the shared catalogue revision; there is no public publication route. The actual requirement draft remains unreviewed and inactive.

## Execution

- Prisma client generation and isolated migration: **Passed**.
- Focused real-PostgreSQL integration SR-16 after the final availability change: **Passed 1**, 15 other cases filtered in that invocation. Earlier runs exercised the other 15 reconciliation cases; see the prior [reconciliation report](../2026-10-17-skill-reconciliation/README.md). The first SR-04 rerun had a test expectation error: an inactive target is denied before token validation. Corrected the expectation without weakening the gate, and SR-04 passed. SR-16 checks activation revision increase, same-version no-op and omission of reviewer identity from the learner response.
- Playwright synthetic signed-identity journey SR-E2E: **Passed 1** in the final run (34.1 seconds test, 1.9 minutes including server startup). It used the real app routes and isolated database, not Google OAuth or a provider call. An initial run failed during cold Next compilation with the default 5-second locator timeout; a bounded 30-second assertion was used, and subsequent runs passed. No blanket Playwright retry was enabled.
- TypeScript, targeted ESLint and `git diff --check` after the final code/test changes: **Passed** (exit 0). Git emitted existing LF/CRLF notices, with no whitespace error.
- Full test suite, production build, live provider, real OAuth and multi-instance activation race: **Not run** for this slice.

Reproduce with `TEST_DATABASE_URL` pointing to a migrated, disposable local `qa_pathways_*` database. Set `RUN_AUTHENTICATED_E2E=true`, `E2E_PORT=31361`, and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to installed Chrome. The browser test creates and deletes its synthetic learner/invitation; the synthetic immutable requirement snapshot remains in the isolated cluster.

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/skill-reconciliation.test.ts -t 'SR-16'
node node_modules/@playwright/test/cli.js test tests/e2e/skill-review.spec.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/app/api/'[...path]'/route.ts src/components/skill-reconciliation.tsx src/components/workspace.tsx src/lib/requirement-snapshots.ts src/lib/skill-reconciliation.ts tests/integration/skill-reconciliation.test.ts tests/e2e/skill-review.spec.ts
git diff --check
```

## Three expected-versus-observed cases

1. **Unavailable review / R06,R12 (SR-E2E):** with no active reviewed snapshot, expected a visible unavailable message and no mapping options. Observed “Reviewed QA requirements are not active yet.” and no candidate control. **Passed.** [Screenshot](01-no-active-review.png).
2. **Explicit mapping and reload / R05,R06,R08 (SR-E2E):** after activating a synthetic reviewed version, expected canonical Test automation and alias Browser suite maintenance to require selection, unmatched SQL to remain, and both confirmations to persist without replacing completed tasks. Observed two confirmed mappings after reload, three original labels and CV/manual sources retained, four completed tasks still on the active plan. **Passed.** [Candidates](02-reviewed-candidates.png) · [After reload](03-confirmed-after-reload.png).
3. **Rejected write / R01,R05,R14 (SR-E2E):** expected wrong-origin and forged-review requests to fail without committing partial mappings. Observed HTTP 403 `ORIGIN_DENIED`, HTTP 409 `REVIEW_EXPIRED`, zero confirmation rows before valid submission. Unsigned availability/review reads returned HTTP 401. **Passed.** This is a controlled failure/fallback, not a live provider failure.

## Limits

The snapshot and identity in this execution are synthetic fixtures, not professional approval or real Google sign-in. The actual draft has `review:null`, so learners will see the unavailable state until a trusted reviewer supplies approved content and an operator activates it. The UI does not yet bind a selected direction to authoritative gap comparison or roadmap generation. The existing quota override is still ten, conflicting with the specified five; this slice did not test quota behavior. No screenshot contains a real CV. The historical test cluster is retained but stopped after execution; no personal/application database was migrated.
