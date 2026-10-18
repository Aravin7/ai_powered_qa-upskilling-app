> Historical execution record. The teaching fixtures and exercise commands described here were removed on 18 October 2026 after the user clarified external-resource-only scope. These results do not establish application acceptance. See BUILD-STATUS.md for the subsequent k6 observations and current scope.

# v4 packet and fixture verification — 18 October 2026 (Asia/Colombo)

Tested base commit `07b4b73906d728b816cb3cfd5b8bf090895eb445` plus uncommitted changes on `codex/refine-qa-capability-draft`. Existing user changes were preserved. Changes include specs, capability definitions/details/compiler, review/status/decision docs, synthetic learner/reviewer fixtures, package scripts and focused tests. No commit, push or merge was performed.

Environment: Windows/PowerShell, Node 24.19.0, repository-pinned TypeScript/Vitest/Playwright, installed Chrome; synthetic files and ephemeral loopback HTTP only. No application database, real identity, real CV, live AI, paid call or external web resource was used. Four fixture groups are drafted; participant pilots and content approval remain pending.

## Commands and observed results

| Command | Actual result / scope |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/requirements.test.ts tests/requirement-content.test.ts tests/reviewed-roadmap.test.ts tests/capability-fixtures.test.ts` | **Passed: 80 tests, four files**, final run 10.24 seconds. Covers transitive highest-priority inheritance/root ordering, optional deferral, draft review denial, effort, strict scorer/error handling, independent learner data, saved variation and real loopback server modes. |
| `node node_modules/@playwright/test/cli.js test --config docs/fixtures/qa-capability-v4/reviewer/playwright.config.ts` (also `npm run test:fixtures:browser`) | **Passed: six checks**, 14.2 seconds: accepted name, rejected empty name, detection of missing button, wrong status, wrong body and disabled validation. Browser-only teaching page; does not verify the application/private workspace. No blanket retries. |
| `node node_modules/typescript/bin/tsc --noEmit` | **Passed**, including fixture/scorer/reference TypeScript. |
| `node node_modules/eslint/bin/eslint.js src/lib/requirements.ts src/lib/requirement-draft.ts src/lib/requirement-content-draft.ts tests/requirements.test.ts tests/requirement-content.test.ts tests/capability-fixtures.test.ts docs/fixtures/qa-capability-v4 scripts/fixtures/qa-capability-v4` | **Passed**, final exit 0 with no warnings. |
| `git diff --check` | **Passed**, final exit 0; Git reported an informational LF/CRLF normalization notice for the review document. |
| `node --import tsx scripts/validate-requirements.ts` | **Passed**: fourteen capabilities, details complete, reviewed false, digest `34374758d204f28873d3f8cc1269e959a344cff8adb32e117b248abaf26ea13d`. No publication/database write. |
| `node --import tsx docs/fixtures/qa-capability-v4/score-genai-evaluation.ts` | **Passed, exit 0**: twelve cases, four criteria; exactly `GE-05/safety` disagrees because keyword matching ignores negation. This is fixture consistency, not model accuracy. |
| k6 30-second normal/broken/restored workloads | **Blocked / Not run**: k6 CLI unavailable on PATH. Node tests verify normal/delay/error/wrong-body endpoint modes, but cannot establish that k6 thresholds actually fail/pass. |
| Full app build, complete unit/DB/browser suites, live AI, Google OAuth | **Not run in this amendment**; earlier results remain historical. |

For reproducibility, the focused Vitest run set `TEMP` and `TMP` to the ignored `.test-tools/tmp` directory. The sandbox initially prevented tsx from obtaining Windows user information (`uv_os_get_passwd`); authorised local execution outside the sandbox resolved it. No runtime or package versions were changed.

## Diagnosed harness defects

- Initial isolated Playwright output paths traversed one parent too far; fixed both configs so artifacts stay under this repository's ignored `test-results/`.
- First reference run had two unexpected failures: HTML `output` elements have an implicit status role, making an unnamed status locator ambiguous. Added a unique accessible feedback name and used that named locator. The final normal and fault-detection checks pass; passing fault checks from the earlier ambiguous run are not used as evidence.
- Targeted ESLint initially reported an anonymous default-export warning in the k6 workload. Named the iteration function; final lint/whitespace checks passed.

## Expected versus observed examples

1. Highest-priority prerequisites should stay Critical even when explicitly Nice and independently ordered. **Observed:** the synthetic compiler regression promotes both ancestors transitively and gives identical results when rule roots are reordered; test passed.
2. Repaired browser checks should accept valid input and reject empty input without a save. **Observed:** both reference cases passed; four independently injected behavior faults caused the intended repaired assertions to fail and were detected.
3. Malformed evaluation JSON should fail clearly and not be echoed. **Observed:** scorer test returned exit 2 and a controlled `EVALUATION_FIXTURE_INVALID` message. Changed judgments returned exit 1; the intentional negation disagreement returned exit 0. These are synthetic fallback checks, not live AI tests.

## Remaining gates

Install/choose k6 locally and run normal, deliberate-failure and restored workloads; record output and exit codes. Obtain genuine dated confirmation identifying exact v4 content and fixture revision. Draft/review the additional prompt/security/bias exercises. Run at least one timed participant pilot per exercise and revise effort from evidence before publication. No reviewer signature or participant result is supplied by these developer checks.
