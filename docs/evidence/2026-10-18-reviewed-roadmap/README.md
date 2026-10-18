# Reviewed roadmap workflow verification — 18 October 2026

## Review-fix follow-up

On the same base commit/branch plus uncommitted changes, four findings were corrected: credential-following personal/education lines no longer enter prepared CV blocks; unsupported infeasibility receives a bounded correction; the API specification matches the existing request schema; reviewed-resource requests retain their operation key and expose status recovery.

| New regression | Expected | Observed |
| --- | --- | --- |
| CV-SEC-09, three variations | Preserve explicit certification/work evidence; exclude following name/location, institution and education metadata from the actual prepared provider payload | **Passed 3** |
| IT-RR11, recovery and terminal failure | Unsupported infeasibility gets a correction; two failures preserve the old completed plan; exactly two attempts and funding units | **Passed 2**, real isolated PostgreSQL with controlled mock provider |
| RR-E2E lost-response addition | Let server save resources, discard browser response, recover by retained key with no new dispatch | **Passed**; recovery stayed at two attempts, full two-topic plan workflow finished at five |

Focused unit invocation: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/cv-minimization.test.ts tests/reviewed-roadmap.test.ts tests/ai.test.ts tests/groq-controls.test.ts` — **55 Passed**. Focused integration invocation: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/reviewed-roadmap.test.ts tests/integration/groq-controls.test.ts` with the isolated test database — **30 Passed**. TypeScript, targeted ESLint and `git diff --check` **Passed**.

The browser ran `tests/e2e/reviewed-roadmap.spec.ts` with authenticated synthetic fixtures and installed Chrome on a separate local port — **1 Passed**, 34.5 seconds test execution. An ignored local Playwright configuration launched Next directly through the workspace Node runtime because npm was unavailable on PATH. It reused the repository configuration, test isolation and deadlines. Test-generated Next type-reference paths were restored. The three screenshots below were refreshed. No full-suite/build rerun, live provider request or real Google OAuth was performed for these fixes. The PostgreSQL server was already reachable; its attempted duplicate startup reported a log-file permission error. Existing pg concurrency deprecation warnings remain visible and did not fail these runs.

## Scope and environment

Browser runner completion: exit 0, **1 passed (3.6 minutes total)**. Test execution took 34.5 seconds; Windows teardown waited on the test-owned Next processes, which were explicitly stopped to complete cleanup. The existing PostgreSQL fixture was left running. The refreshed resource screenshot was visually inspected and shows the recovery button and synthetic labels.

This evidence covers the local synthetic/mock workflow from a saved reviewed direction through mock topic-resource suggestions, strict roadmap validation, atomic plan replacement, task completion and reload. Browser identity and all learner/database fixtures are synthetic. No provider API, real CV, Google OAuth, application database, deployment or external resource page was used.

- Branch: `codex/qa-pathway-requirements-amendment`
- Tested base commit: `535c74b327df9320486be781e256748a1542e77a`; implementation and evidence remain uncommitted in the shared working tree.
- Runtime: Node.js 24.19.0, Next.js 16.3.8, Windows, PostgreSQL test database only for integration/browser cases.
- Current application guard: five shared provider reservations per user per rolling hour; two attempts maximum per operation; 45-second operation deadline.

## Latest execution results

| Check | Result | What it demonstrates |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | **Passed** | Current source type-checks. |
| Unit suite, 12 files | **215 passed** | Validators, mock contracts, resource/reviewed-roadmap logic. No live AI. |
| Full ESLint | **Passed** | Repository lint completed without findings. |
| Local optimized build | **Passed** | Prisma client generation, Next compilation, build-time TypeScript and static-page generation. Not deployment evidence. |
| Reviewed-roadmap PostgreSQL integration suite | **117 passed in prior full run** | Earlier real isolated-Postgres run covers transactions, retries, operation conflicts/concurrency and preservation. It was not rerun in this continuation: starting the isolated PostgreSQL server failed with a Windows log-file permission error. |
| Reviewed-roadmap Playwright journey | **1 passed** | Synthetic signed identity; missing-resource fallback, mock research, plan save, completion/reload and old-plan archive. Not Google OAuth or live AI. |

The full unit command was run through the workspace's Node executable: `node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/unit.test.ts tests/ai.test.ts tests/qa-coverage.test.ts tests/groq-provider.test.ts tests/cv-minimization.test.ts tests/groq-controls.test.ts tests/resource-discovery.test.ts tests/pathways.test.ts tests/resource-preview.test.ts tests/requirements.test.ts tests/requirement-content.test.ts tests/reviewed-roadmap.test.ts`. TypeScript used `node node_modules/typescript/bin/tsc --noEmit`; lint used `node node_modules/eslint/bin/eslint.js .`; the build used Prisma generate followed by `next build`.

## Expected versus observed examples

1. **Missing topic resources:** generation must not dispatch or replace the active plan. **Observed: Passed** — the UI shows a recovery message, no attempt is reserved, and the old active plan remains.
2. **Successful synthetic path:** two retained topics need two reserved mock phases each; a valid plan is then validated and atomically saved. **Observed: Passed** — five reservations in total, five plan tasks, old completed plan archived, and one active plan remains.
3. **Failure/fallback:** invalid output may use one accounted correction; terminal invalid output must preserve the previous plan and progress. **Observed: Passed in the real-DB integration run** — terminal failure left the prior active plan and all completed tasks intact.

## Screenshots

- [`01-missing-resource-fallback.png`](01-missing-resource-fallback.png)
- [`02-synthetic-topic-resources.png`](02-synthetic-topic-resources.png)
- [`03-saved-plan-progress-reload.png`](03-saved-plan-progress-reload.png)

The resource cards deliberately show synthetic placeholder labels without clickable URLs. They are not recommendations, cited results or evidence of live web access.

## Remaining gates

The draft `qa-capabilities-draft-v2` is not approved or active. The earlier reviewer/date mentioned in chat could not be tied to the document/version or scope, so the review claim remains unverified. No live LLM resource research, provider-native search response parsing, independent URL/page/access/relevance verification, provider retention/privacy approval, funding approval for live tool usage, real Google OAuth, browser/device/accessibility matrix, T13 evaluation, backup restoration, deployment compatibility or professional semantic-quality assessment is established by this evidence.
