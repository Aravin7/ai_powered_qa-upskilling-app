# Full runnable suite — 17 October 2026

This checkpoint tested branch `codex/fix-cv-evidence-extraction`, base commit `4631eef2b1df24d86d946e9a8a874fb4ebe626af`, **with uncommitted source, test and documentation changes**. Windows/PowerShell, Node 24.19.0, Chrome and PostgreSQL 18.4 were used. Database `qa_cv_20261017` was the existing isolated, migrated synthetic test database on localhost port 55437. The normal application database and `.env` were not edited. Provider responses were mocked or intercepted server-side; Playwright used synthetic signed identities, not Google OAuth. No live Groq request, paid request or deployment was made.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Full unit/parser/adapter suite, six files | **Passed: 108/108** | `node node_modules/vitest/vitest.mjs run --maxWorkers=1` with the six files from `npm test`; real synthetic PDF parser and controlled provider responses. |
| Full PostgreSQL integration suite, four files | **Failed: 51 passed, 3 failed, 54 total** | `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration`; all three failures assert the approved five-attempt hourly limit. |
| Full Playwright suite, four files | **Passed: 10/10** | `node node_modules/playwright/cli.js test`; connected CV/plan journey, private API, manual workflow, demo, mobile width and stale two-tab save. Mock AI and test-signed identity. |
| TypeScript and full ESLint | **Passed** | `tsc --noEmit`; `eslint .`. |
| Catalogue validation | **Passed structurally** | Eight skills; catalogue reports `reviewed:false`. Professional review remains blocked. |
| Local production build | **Passed** | `prisma generate`, then `next build` using ignored `.next-e2e`; compiled, typechecked and generated pages. No deployment. |
| Diff hygiene | **Passed** | `git diff --check`; generated `next-env.d.ts` restored to its starting content. |

The first integration attempt was blocked by sandbox `EACCES` to the local test port. A subsequent attempt reached a stopped fixture and timed out. After the isolated PostgreSQL fixture was started and a direct `select 1` succeeded, the complete integration run above produced the 51/3 result. These setup failures are **not application test failures**. The first build attempt failed because sandbox access denied Next.js Windows path canonicalisation; the rerun with normal workspace access passed. No assertion or application deadline was relaxed.

## Intentional test quota override: R11/T11 deviation

The user confirmed after this run that they deliberately changed the hourly quota **to ten for testing**. `AGENTS.md` invariants and `specs.md` R11/T11 still require **five provider attempts per user per rolling hour**, shared across extraction and roadmap generation. At the full-suite checkpoint, the source used `count >= 10` while its error message still said five. The user has since restored `count >= 5` in `src/lib/ai-operations.ts`.

Three independently named integration cases reproduced the same behavior:

| Case | Expected | Observed |
| --- | --- | --- |
| RM-10a / R11 / T11, mixed roadmap and CV | After five reserved attempts, sixth CV dispatch rejects with `QUOTA_EXHAUSTED`, provider untouched. | Sixth extraction returned `CANDIDATES_READY`. **Failed.** |
| Connected-service quota case / R11 | After five attempts, next roadmap request rejects with `QUOTA_EXHAUSTED`. | Provider ran; result was `PROVIDER_INCOMPLETE`. **Failed.** |
| GR-13 / R11, two instance Groq controls | After five attempts, next roadmap request rejects with `QUOTA_EXHAUSTED`. | Sixth request returned `PLAN_SAVED`. **Failed.** Groq HTTP was intercepted; no live request occurred. |

Reproduction: on the isolated database, create a synthetic invited learner, valid consent and a shared test allowance; reserve five requests within an hour across the two AI features; submit one new-key request. At ten, the sixth request was permitted. After the user restored the five-attempt gate, the three focused cases were rerun against isolated PostgreSQL and **all three Passed** (46 unrelated tests filtered/not run): `RM-10a`, the connected-service retry quota case and `GR-13`. Command: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/qa-coverage.test.ts tests/integration/ai.test.ts tests/integration/groq-controls.test.ts -t 'RM-10a|counts retries in the five-attempt|GR-13'`. Provider responses were mocked/intercepted; no live AI call was made. This confirms the five-attempt behavior for these cases only; the full integration suite was not rerun after restoration.

## Browser evidence captured in this run

The connected Playwright case refreshed these synthetic screenshots:

1. [CV evidence review](../2026-10-17-cv-amendments/01-cv-evidence-review.png): demonstrated candidates checked; listed technology unchecked before confirmation.
2. [Roadmap after reload](../2026-10-17-cv-amendments/02-roadmap-progress-reloaded.png): saved completion and percentage persist.
3. [Invalid PDF recovery](../2026-10-17-cv-amendments/03-invalid-pdf-recovery.png): controlled error and retained inventory.

Database reservation failures do not have a meaningful UI screenshot; the assertion output and source line are their evidence.

## Coverage still open

The full integration run with the temporary ten-attempt override recorded three quota failures. The later focused rerun with the restored five-attempt limit passed all three. The **full existing runnable suite** is not every case in the whole-system manual catalogue. The executable suite does not establish real Google OAuth, live Groq behavior for the new prompt, provider retention/deletion, deployed parser memory and deadline behavior, backup restoration, full browser/device and accessibility matrix, actual network interruption or process-crash recovery, catalogue/professional review, T13 participant measurement or semantic plan quality. Those remain **Not run** or **Blocked** by their specified external criteria. The synthetic catalogue's structural pass is not publication approval.
