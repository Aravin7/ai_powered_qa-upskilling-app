# Connected resource previews — 17 October 2026

Base commit `535c74b327df9320486be781e256748a1542e77a`, branch `codex/qa-pathway-requirements-amendment`, plus uncommitted changes. Existing source/docs/evidence and the user's temporary ten-attempt override were preserved. No commit, push, merge, deployment, live provider call, Google OAuth or application-database migration occurred.

This slice connects saved provisional QA direction → server-owned topic → two accounted mock-provider phases → validated synthetic documentation/supporting pair → owned persistence and browser reload. Fixture URLs are deliberately non-clickable placeholders. It does **not** implement live LLM-native search, actual page verification, professional content review or activation of resources into a plan.

Environment: Windows/PowerShell, Node 24.19.0, Vitest 5.0.3, Playwright 1.63.0, installed Chrome, local PostgreSQL 18.4 on port 55461. Only the isolated `qa_pathways_20261017` database was migrated. New additive migration `202610170003_resource_previews` adds bounded owned JSON previews and permits the research operation kind. Prisma client generation Passed. Synthetic learners, provider responses, native-source records and page-check outcomes only; browser identity is test-signed, not real Google OAuth.

## Results / requirement-to-test matrix

| Cases / requirement | Expected observable result | Actual execution |
| --- | --- | --- |
| RP-01 / US15, T15 | Exact distinct fixture pair; every resource synthetic-only and professional review null | Passed |
| RP-02 / US15, security | Mock verifier rejects real hostnames; cannot manufacture page-check evidence | Passed |
| RP-03 / US15, strict server contracts | Missing source/pair and additional caller CV/title fields rejected | Passed |
| RP-04 / R11, T15 | Groq rejects resource work before network dispatch | Passed; zero fetches |
| IT-RP01 / US15, R11 | Two reserved phases; minimized server context; saved pair survives second-client read; replay adds no calls; changed key input conflicts | Passed |
| IT-RP02 / US03, US15 | Missing consent, unrelated topic or unselected direction consumes no research attempts | Passed |
| IT-RP03 / US15, state preservation | Invalid second output makes exactly two calls; earlier saved pair, active plan and completed tasks remain unchanged | Passed |
| IT-RP04 / R11 | Lost first response terminates after one call, retains reservation and plan; no hidden retry | Passed |
| IT-RP05 / R11 | Second phase cannot dispatch without its own funding reservation; first reservation remains consumed | Passed |
| IT-RP06 / R11, revision fencing | Two DB clients share one user lease; input change prevents second dispatch/save | Passed |
| IT-RP07 / US03, R11 | Consent withdrawn while selecting prevents save; both dispatched attempts remain accounted | Passed |
| IT-RP08 / deletion | Deletion during selection leaves no account/exploration recreation | Passed; application-store cleanup only |
| IT-RP09 / R11 | Expired worker cannot commit; both reservations remain consumed; plan unchanged | Passed |
| Default nine-file unit/parser/provider suite | Current validator/parser/provider regressions | Passed 144/144 |
| Resource, pathway and store integration files | Real isolated PostgreSQL, controlled mocked providers | Passed 26/26: 9 resource + 12 pathway + 5 store |
| TypeScript | Type checking | Passed after correcting a new test's extra deleteAccount argument |
| Targeted ESLint | Changed TS/TSX and tests | Passed |
| Extended pathway browser journey | Save/select, pair request/reload, exhausted-funding fallback, blocked provisional plan, original progress | Passed after locator correction; 14.1-second journey, 37.7 seconds including startup |

The invalid-second-output case moves previous fixture attempts outside the rolling hour before retrying, so it does not depend on the temporary ten-attempt quota. Funding totals remain consumed. The required five-attempt gate is still not certified: `src/lib/ai-operations.ts` retains the pre-existing user override of ten. No tests were weakened to match it.

## Three Week 3 examples

| ID | Preconditions / actions | Expected | Actual |
| --- | --- | --- | --- |
| IT-RP01 success | Synthetic confirmed learner, saved delivery direction, mock budget, current consent; request automation topic, read using second DB client, replay same key | Two dispatch reservations; two synthetic resources persist; replay makes zero extra calls | Passed: search/select phases observed, attempts=2, saved pair recovered, provider calls remained two after replay |
| IT-RP03 failure/fallback | Earlier pair and fully completed active plan; previous attempts outside rolling hour; mock search succeeds and selection returns invented IDs | Reject selection without third correction; preserve exact saved pair and active completed plan | Passed: RESOURCE_VERIFICATION_REQUIRED, two calls, operation failed, old preview/progress retained |
| IT-RP09 late worker | Controlled mock holds selection after both reservations; second DB client expires deadline; release result | No late resource save; no automatic refund or plan change | Passed: DEADLINE, no preview saved, shared counter retains both research reservations plus setup consumption |

## Commands

Use only a separate test database. No reset/delete-database command was used. The test fixture deletes only its own synthetic learner/invitation/budget records; deletion tests deliberately exercise account deletion for that synthetic learner.

```powershell
$taskNodeDir = 'C:/Users/User/AppData/Local/Author Software/nvm/installs/v24.19.0'
$env:PATH = "$taskNodeDir;$env:PATH"
$env:TEMP = Join-Path (Get-Location) '.test-tools/tmp'
$env:TMP = $env:TEMP
$env:TEST_DATABASE_URL = 'postgresql://pathways_test@127.0.0.1:55461/qa_pathways_20261017'
# Use a dedicated test shell; these process variables point only to the test DB.
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:DIRECT_DATABASE_URL = $env:TEST_DATABASE_URL
& "$taskNodeDir/node.exe" node_modules/prisma/build/index.js generate
& "$taskNodeDir/node.exe" node_modules/prisma/build/index.js migrate deploy
& "$taskNodeDir/node.exe" node_modules/typescript/bin/tsc --noEmit
npm test
& "$taskNodeDir/node.exe" node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/resource-preview.test.ts tests/integration/pathways.test.ts tests/integration/store.test.ts
$env:RUN_AUTHENTICATED_E2E = 'true'
$env:E2E_PORT = '31359'
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
& "$taskNodeDir/node.exe" node_modules/@playwright/test/cli.js test tests/e2e/pathways.spec.ts
```

The default `npm test` script's nine explicit files were invoked through the pinned Node binary and `node_modules/vitest/vitest.mjs` in this execution. The initial TypeScript command failed only for the new test's incorrect deleteAccount call; it was corrected before the passing test runs. No application assertion was weakened.

The initial browser run failed after 23.3 seconds at a test-only locator: it expected a status message containing the API code, whereas the application correctly rendered an alert containing the safe error explanation. The API already returned HTTP 503 and the saved resource preview remained. The corrected test explicitly asserts `code:FUNDING_STOP` in the HTTP response and the full human-readable alert text. No application change or forced click was needed for this correction; the failed run is not counted as passed.

## Evidence and limits

- [Direction suggestions](01-provisional-suggestions.png)
- [Saved direction](02-saved-direction.png)
- [Existing plan progress](03-preserved-progress.png)
- [Reloaded resource preview](04-resource-preview-reloaded.png)
- [Funding fallback preserves preview](05-funding-fallback-preserves-preview.png)

All five screenshots were saved by the passing browser rerun. The reloaded-preview and funding-fallback screenshots were visually inspected: placeholder/source warnings, the saved documentation/supporting pair and the funding-denial alert are present. Final TypeScript and targeted browser-test lint Passed after the locator correction. `git diff --check` Passed. The generated Next type-reference file was restored after the browser server stopped.

The isolated PostgreSQL helper was stopped after verification; no database/data directory was deleted and the application database was untouched.

Live research remains blocked by approved tool/model usage and funding bounds, processing/retention disclosure, an actual provider-native source parser and independent real-page verification. Reviewed selected-direction requirements and semantic quality review are also absent. No separate search API was introduced. No full integration/browser suite, production build, device/accessibility matrix, T13 evaluation, deployed-runtime checks, real network recovery, provider retention or backup restore/deletion test ran in this slice. A success with synthetic fixtures does not prove live resources are available or useful.
