# Pathway exploration execution — 17 October 2026

Tested base commit: `535c74b327df9320486be781e256748a1542e77a`, branch `codex/qa-pathway-requirements-amendment`, plus uncommitted source, tests, migrations and documentation. Existing user changes, including the ten-attempt quota override, were preserved. No commit, push, merge, deployment, application-database migration or live provider request occurred.

Environment: Windows/PowerShell, Node 24.19.0, Vitest 5.0.3, Playwright 1.63.0 with installed Chrome. Real isolated PostgreSQL, database `qa_pathways_20261017`, synthetic learners and local mocked providers. Initial port 55449; final browser runs used 55461 after Windows denied the original socket. Two additive migrations were applied only there. Browser identities are test-signed sessions; Google OAuth is not tested. No public authentication bypass was added.

## Results and requirement mapping

| Cases / requirements | Execution | Observable coverage |
| --- | --- | --- |
| PX-01–PX-06 / US15, T15 | Passed 6/6 within default unit suite | Preference combinations, strict capability IDs, self-report constraints, minimized request, provisional roadmap guard, live adapter rejects before dispatch |
| Default unit/parser/adapter suite | Passed 140/140, eight files | Includes 24 synthetic resource contracts; no live research |
| IT-PX01–IT-PX12 / US15, T15; shared R11 and state-preservation controls | Passed 12/12 | Real DB preferences/no-op, selection/replay/conflict, bounded correction, two-client lease/stale activation, withdrawal, deletion, ownership/shared funding, stale clearing, no-gap/empty inventory and expired worker fencing |
| Existing store integration regression | Passed 5/5 | Existing persistence and transactional controls, real isolated DB |
| New pathway browser journey / US15, T15 | Passed, including combined run (19.3 seconds for the journey) | Preferences, initial three/more suggestions, selection/reload, API denial of provisional gaps/plans, original completed plan preserved |
| Connected browser regression / CV preview, confirmation, roadmap, progress, fallback, logout | Passed after sidebar fix (1.0 minute journey; 2.0 minutes including startup) | Real PDF parser, mocked server provider, real isolated database; original 90-second timeout restored |
| TypeScript and targeted ESLint | Passed, including final late UI/test changes | Source and test typing/static validation |
| Full integration/browser suites, production build, device/accessibility matrix, real OAuth, live suggestions/resources | Not run | No complete coverage claim |
| Reviewed selected-direction requirements and activation | Blocked | Requires named content review and versioned requirements; provisional selection cannot drive new plans |
| Five attempts/user/rolling hour | Known requirement conflict | Existing user override is ten in `src/lib/ai-operations.ts`; preserved. These passes do not certify the required five-attempt limit |

All database cases create independent synthetic learners/budgets and remove only those fixtures. Provider mocks run at the server adapter boundary. The resource helper remains a request/validation contract, with no connected native-search dispatcher, real source parser/verifier or resource persistence.

## Three Week 3 expected-versus-observed examples

| Case | Preconditions/data and actions | Expected | Actual |
| --- | --- | --- | --- |
| IT-PX01: saved preferences / US15 | Confirmed synthetic QA learner; save preferences, repeat with reordered interests, save a suggestion, read through second Prisma client | No-op save preserves planning revision; selection survives server reload | Passed: unchanged revision for equivalent preferences and same saved selection on second-client read |
| IT-PX04: invalid-provider fallback / T15 | Existing suggestions and completed plan; mock returns invalid suggestions twice; request fresh suggestions | Two accounted attempts maximum; terminal error preserves earlier suggestions, plan and progress | Passed: two attempts reserved; no replacement of committed suggestions or plan |
| IT-PX12: expired worker / R11, T15 | Controlled provider gate holds synthetic operation; expire its deadline, then release result | Expired worker cannot commit suggestions; dispatched reservation remains consumed | Passed: late activation rejected and reservation retained |

## Screenshots

- [Provisional suggestions](01-provisional-suggestions.png)
- [Saved direction after reload](02-saved-direction.png)
- [Preserved original progress](03-preserved-progress.png)
- [Prepared CV preview](legacy-cv-regression/00-prepared-preview.png)
- [Candidate confirmation](legacy-cv-regression/01-cv-evidence-review.png)
- [Reloaded roadmap progress](legacy-cv-regression/02-roadmap-progress-reloaded.png)
- [Malformed PDF recovery](legacy-cv-regression/03-invalid-pdf-recovery.png)

Screenshots contain synthetic data. A screenshot alone does not establish that its whole test passed. Saved-direction layout was visually inspected, including accessible labels, provisional warning, disabled activation and selected sidebar title.

The two distinct browser journeys have passing executions, not one final combined all-pass invocation: the combined run passed pathways and failed connected logout; the affected connected-only rerun passed after the CSS fix. No full browser-suite pass is claimed. Final TypeScript, targeted ESLint and `git diff --check` passed. The generated Next type-reference file was restored after the browser server stopped. The isolated PostgreSQL helper was stopped after verification; its test data directory was retained.

## Reproduction commands

Use a dedicated migrated `qa_pathways_*` database; do not reset a personal/application database. The project commands remain in README. This execution invoked the installed Node binary directly because of the local runtime shim/environment.

```powershell
$taskNodeDir = 'C:/Users/User/AppData/Local/Author Software/nvm/installs/v24.19.0'
$env:PATH = "$taskNodeDir;$env:PATH"
$env:TEMP = Join-Path (Get-Location) '.test-tools/tmp'
$env:TMP = $env:TEMP
$env:TEST_DATABASE_URL = 'postgresql://pathways_test@127.0.0.1:55461/qa_pathways_20261017'
& "$taskNodeDir/node.exe" node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/unit.test.ts tests/ai.test.ts tests/qa-coverage.test.ts tests/groq-provider.test.ts tests/cv-minimization.test.ts tests/groq-controls.test.ts tests/resource-discovery.test.ts tests/pathways.test.ts
& "$taskNodeDir/node.exe" node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/pathways.test.ts
& "$taskNodeDir/node.exe" node_modules/typescript/bin/tsc --noEmit
$env:RUN_AUTHENTICATED_E2E = 'true'
$env:E2E_PORT = '31359'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
& "$taskNodeDir/node.exe" node_modules/@playwright/test/cli.js test tests/e2e/pathways.spec.ts tests/e2e/connected.spec.ts
```

## Failures diagnosed and boundaries

Initial new DB execution failed because the existing SQL operation-kind CHECK excluded pathway suggestions. Added an explicit migration; the focused rerun passed, then three further boundary cases passed in the 12-case run. This was an application/schema defect, not a weakened expectation. Initial browser execution exposed missing programmatic select labels; corrected the actual label associations. An earlier unit batch encountered a Vitest worker startup timeout; the final full default suite passed 140/140.

The connected journey timed out at logout after successfully exercising preview, extraction, confirmation, roadmap, progress and malformed-PDF recovery. Increasing the cumulative timeout from 90 to 180 seconds did not fix it. Trace evidence identified a real UI defect: `locator.click` repeatedly reported `element is outside of the viewport` for the Sign out button. The extra navigation item made the fixed desktop sidebar overflow without scrolling. Added desktop sidebar scrolling and prevented its children from shrinking; restored the original 90-second timeout and retained the ordinary click/logout assertions. No forced click or assertion weakening was used.

An intermediate rerun failed both browser cases because the isolated PostgreSQL helper had stopped during interruption; cleanup also reported `Can't reach database server at 127.0.0.1:55449`. Restarting on that port hit a Windows bind-permission error. The same isolated cluster was recovered on port 55461 with its log outside its data directory; no personal database was reset. These failed executions are not reported as passes.

Remaining: reviewed capability/requirement sets, professionally assessed semantic quality, approved updated live disclosure/provider terms, native-tool funding/cost bounds, shared controlled resource research, source authenticity/page checks and immutable plan resources. Also not established here: T13 evaluation, cross-device/accessibility, deployed compatibility, recoverable real network interruption, provider retention, backups/restoration/deletion. Earlier live Groq evidence is separate and does not prove this new slice works with live AI.
