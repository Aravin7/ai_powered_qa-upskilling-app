# Build status — 11 October 2026 · IT6070 Week 3

## Current Groq replacement checkpoint — 11 October 2026

Tested base commit `72c4ff128315df2bfe544f81e4060930b02042f1` plus the uncommitted Groq replacement described here, on the existing `codex/gemini-dispatch-controls` branch. The tracked working tree was clean at the start. No branch switch, commit, push, merge or deployment was performed in this side conversation. The user edited the ignored local `.env`; this task did not print or commit its credentials or change its AI mode. Historical results below describe prior code.

Active Gemini adapter, selection, setup command and configuration template are removed. Groq `openai/gpt-oss-20b` is connected through a server-only single-request REST adapter with strict JSON schemas. The existing shared quota, two-attempt limit, deadlines, consent/version/session fences, real PDF parser, evidence/roadmap validation and atomic replacement remain. A versioned shared `REQUESTS` counter permits at most 20 initial demo attempts over seven days without reset/refund. Applied Gemini migration/history and historical plans remain intact. The local academic demo explicitly permits synthetic unreviewed content without pretending it has professional review; production and real participant admission remain gated. See [GROQ-DEMO.md](GROQ-DEMO.md) for setup and GR requirement mapping.

Environment: Windows/PowerShell, Node 24.19.0, real isolated PostgreSQL 18.4 on localhost port 55437, fresh disposable database `qa_groq_demo`. All four migrations applied successfully only to that isolated database. Browser check uses Chrome on port 31347 with synthetic signed Auth.js identity and mock AI. CLI checks use the exact Node executable because the default Node shim fails its integrity check. Credentials remain in ignored `.env` and process environment.

- **97 unit/parser tests Passed** across six files, equivalent to `npm test`. The initial sandbox run loaded only one suite (40 passes), while five suites failed to import due to an inaccessible temporary SSR cache. Setting `TEMP`/`TMP` to ignored `.test-tools/tmp` resolved this; all six suites passed with no assertion/deadline relaxation.
- **52 PostgreSQL integration tests Passed**, equivalent to `npm run test:integration`, four files. Includes 12 Groq service cases with intercepted server fetch, two clients/users, real PDF parsing, shared reservations/quota, 401/429, consent/configuration/revocation fences and preserved progress on failed replacement. These are mocked-provider results, not live AI evidence.
- **12 targeted Groq adapter/configuration tests Passed** after adding safe provider HTTP status diagnostics, and again after the safe HTTP 401 message was clarified. These are a subset of the 97, not additional unique cases.
- **Typecheck Passed** after the live runner's fixed-model literal typing was corrected. **Full lint Passed**; targeted lint also passed for the added optional live runner and updated service tests. **Catalogue validation Passed**, eight skills and `reviewed:false`. `git diff --check` passed at this checkpoint.
- **Live smoke Failed / blocked by credentials:** two deliberate runs each reserved exactly one attempt, then stopped without hidden retry or plan generation. The diagnostic run received **HTTP 401** from Groq. The configured value did not have the usual `gsk_` prefix; no credential value or provider echoed error body was logged. Synthetic identity/data and only the isolated database were used. Aggregate request consumption was retained, and disposable learner records were cleaned up. Successful live extraction/roadmap behaviour remains **Not run successfully** until a valid full Groq key is saved. The running `.env` was still `AI_MODE=mock` when last inspected.
- **Browser connected journey Failed:** initial run did not start because the dev web server exceeded the existing 120-second startup limit. After clearing only the verified disposable `.next-e2e` cache, the journey reached saved profile/consent and My skills, but the valid PDF upload returned `SERVICE_UNAVAILABLE`; candidate-review heading did not appear within the unchanged 15-second assertion window. The same generic upload failure was observed at an earlier checkpoint below; its root cause remains unconfirmed. Server-level real-PDF integration passed, so that evidence does not establish successful browser upload. Synthetic screenshot, trace and response context are in ignored `test-results/connected-connected-authen-fdc1e-rogress-fallback-and-status-chromium/`. No browser journey is counted as passed for this change.
- **Production build Passed**, `npm run build` with `E2E_DIST_DIR=.next-e2e` to preserve the normal development directory: Prisma generation, Turbopack compilation, TypeScript, page generation and optimization completed. The build is local verification, not deployment/production-admission evidence. Test/build-generated `next-env.d.ts` path changes were restored to the original development paths.

Three observed Week 3 examples, all with intercepted provider responses and real isolated PostgreSQL:

| Case | Expected | Actual |
|---|---|---|
| GR-05: CV and roadmap | Real synthetic PDF returns a review candidate; a valid roadmap saves only after shared reservations | One API testing candidate, `PLAN_SAVED`, fixed Groq model provenance and two reserved requests |
| GR-06: failed replacement and recovery | Two invalid outputs retain the completed old plan; deliberate valid new-key retry replaces atomically | Two invalid responses rejected, old plan/progress retained, then a different plan saved with all new tasks unchecked |
| GR-14: provider rate limit | HTTP 429 ends without immediate retry, consumes one attempt and preserves progress | `PROVIDER_RATE_LIMIT`, exactly one interception/reservation, prior plan ID and completed task retained |

Remaining evidence gaps: valid-key live Groq quality/availability, real Google OAuth, professionally reviewed content and semantic quality, provider account settings/tier and retention verification, production/deployment compatibility, wider browsers/accessibility/network recovery, T13 measurement and backup/deletion verification. A Free Plan declaration is operator supplied, not automatic billing verification. No paid provider/fallback was enabled. Current results do not establish complete requirement coverage or production readiness.

Commands executed through the local Node 24.19.0 binary: TypeScript `tsc --noEmit`; ESLint `eslint .` and affected paths; catalogue `node --import tsx scripts/validate-catalogue.ts`; Vitest `run --maxWorkers=1` with the six unit files; Vitest `run --maxWorkers=1 --testTimeout=15000 tests/integration`; Prisma `migrate deploy` against `qa_groq_demo`; Playwright `test tests/e2e/connected.spec.ts`; `npm run build` with the runtime directory first on `PATH` and isolated build directory; optional `node --import tsx scripts/test-live-groq.ts` with `RUN_LIVE_GROQ_TESTS=true` and the isolated `TEST_DATABASE_URL`. The live runner is excluded from ordinary test commands and refuses production, absent free/key configuration and other database names.

## Historical Gemini controls checkpoint — 11 October 2026

Current branch: `codex/gemini-dispatch-controls`, created from merged main `2f86215abe47f6f6acd192863ab240f49564d4ce`. Tested that commit plus the uncommitted Gemini controls, migration, UI and tests in this branch. The working tree was clean before this task; pre-existing functionality is retained. Historical sections below describe earlier revisions.

Gemini is now connected through server-only provider selection, strict fixed-model/private configuration, versioned provider disclosure/consent, reviewed-catalogue checks and shared USD micro-unit reservations. Configuration changes and budget revocation fence activation; failed generation preserves plans/progress. Both mock and synthetic Gemini processing are rejected in production. No actual `.env`, API key, provider approval or catalogue review was supplied/changed. The running configuration remains mock. Setup details and G-01–G-13 requirement mapping are in [GEMINI-PILOT.md](GEMINI-PILOT.md).

Environment: Windows, PowerShell, Node 24.19.0; real isolated PostgreSQL 18.4 on localhost port 55437, fresh disposable database `qa_gemini_controls`; Chrome on separate E2E port 31347. All three migrations applied successfully to that fresh database. Synthetic users/prices/configurations and intercepted provider responses only; no paid request, real Google OAuth, deployment or personal database reset.

- **92 unit/parser tests PASS**, `npm test`, six files. Real PDF parser remains bounded at eight seconds; provider responses are mocked/intercepted.
- **50 PostgreSQL integration tests PASS**, complete `npm run test:integration`, four files, including ten new Gemini service cases across two database clients and multiple synthetic users. No hidden retries or assertion weakening.
- **Typecheck PASS** via `npm run typecheck`; **catalogue validation PASS** via `npm run catalogue:validate`, with eight synthetic skills and `reviewed:false`.
- **Full lint PASS**, `npm run lint`. Seven targeted adapter/configuration tests also passed after the final prompt wording was aligned with the existing strict semantic validator.
- **Production build PASS**, `npm run build`, including Prisma generation, compilation, TypeScript and page generation/optimization.
- Browser full run: **8 PASS, 1 FAIL**. The connected journey reached its final logout/session assertions but exceeded the 90-second test allowance during cleanup after cold route compilation. Compilation warmup now runs in separate harness setup; `npm run test:e2e -- tests/e2e/connected.spec.ts` then **PASS**, with the journey completing in 21.9 seconds. Its journey allowance and application deadlines remain unchanged. All nine cases have passing evidence across the full run and affected rerun, not a single final nine-test run. Browser identity is synthetic Auth.js and AI is mock; Google OAuth and Gemini UI/live behavior are not verified. Targeted lint for the changed harness also passed.
- The initial browser run timed out starting its web server before any test ran. A concurrent build compiled but failed on incomplete generated E2E TypeScript output. Clearing the disposable `.next-e2e` cache and rerunning the build sequentially resolved that failure; no product assertion or timeout was relaxed.
- Initial test runs exposed an unpublished migration constraint omission, two test-runner timeouts and a provider fixture quote mismatch after identity minimization. The migration now allows Gemini budgets with currency/configuration constraints; a fresh database verifies the final SQL. The integration runner allows 15 seconds without changing parser/provider/operation deadlines. The fixture now quotes its actual supplied evidence; the complete 50-test rerun passed.

Three Week 3 examples observed in the passing integration run (all use intercepted HTTP, not live AI):

| Test | Expected | Actual |
| --- | --- | --- |
| G-05, valid PDF and roadmap | Current consent/configuration permits a real parsed PDF candidate and validated saved roadmap; shared funding reserved before each dispatch | One API testing candidate returned, `PLAN_SAVED`, synthetic configured model provenance recorded, two HTTP interceptions and two reservations |
| G-04, unmet gates | Old mock consent, unreviewed catalogue, missing key and production mode cannot authorize Gemini | Controlled errors; zero attempts/provider calls |
| G-06, failure then fallback recovery | Two invalid responses retain prior completed task/plan; deliberate new-key valid response replaces atomically | Two calls rejected, old plan ID/progress retained, failed reservations retained; recovery saved a different plan with all tasks unchecked |

**Blocked / not run:** fixed-model availability and pricing verification, actual approved funding/privacy terms, professional catalogue review and semantic assessment, live Gemini, real Google OAuth, deployment/runtime compatibility, broader browser/accessibility/network checks, T13 measurement and provider/backup retention/deletion evidence. The synthetic semantic validator still accepts only exact catalogue activities/outcomes/effort; general semantic plan quality is unverified. No production-readiness or full requirement-coverage claim follows from these passes.

Earlier branch: `codex/qa-automation-coverage`, branched from `codex/week3-connected-workflow` while its Week 3 implementation was still uncommitted. Connected **local mock-provider** implementation; not a live AI integration or verified production release. Requirements remain in `../specs.md`. Prior evidence is retained in `BUILD-STATUS-2026-10-03.md`; historical passes are not current regression evidence.

## Live-provider preparation — 10 October 2026

The user selected Google Gemini Flash Latest (`gemini-flash-latest`) for exploration. `src/lib/ai-provider-request.ts` prepares versioned CV and roadmap requests from minimized text and server-owned catalogue data. `src/lib/gemini-provider.ts` now builds a single Gemini REST request with structured JSON output, no SDK retries or tools, bounded response reading and controlled failure mapping. Four adapter cases and two request-contract cases passed with intercepted responses; no live AI request was made. Typecheck and targeted lint passed. The application routes still select the mock provider, and `AI_MODE=paid` fails closed. Gemini Flash Latest is a changing alias, so a fixed model and verified price are needed for a funded pilot. Funded limit, provider privacy/retention terms and catalogue review remain open.

The five-attempt rolling-hour guard had been commented out in the working copy, conflicting with `specs.md` R11. The user asked to restore it; the guard is now active again. Two targeted quota cases passed against the isolated real PostgreSQL fixture, including cross-feature accounting. This preparation is **not** live AI integration evidence.

## Merge-preparation verification — 10 October 2026

Tested base commit `4f7292743be7c945ae61cdb3f4a2e9bf3a181c2d` plus the uncommitted DEF-02 correction in `src/lib/ai-output.ts`, normal-suite minimization regressions and single-worker unit command. Documentation edits do not change tested behavior. Windows/Node 24.19.0, isolated PostgreSQL 18.4 at localhost port 55437 (`qa_week3`), Chrome and separate E2E port 31347; no personal database reset, external AI request or deployment.

- **89 unit/parser/Gemini-adapter PASS** across five files, including two CV minimization regressions and intercepted provider transport tests. The initial concurrent run had 88 passes and one real-PDF timeout at the unchanged eight-second parser deadline; the complete sequential run passed. The unit command now uses one worker, with no retry or deadline relaxation.
- **40 PostgreSQL integration PASS** in the complete `npm run test:integration -- --maxWorkers=1` run, including the three Week 3 examples below and two-client concurrency controls.
- **9 Playwright PASS** in the complete authenticated/mock browser run (2.5 minutes), including onboarding, PDF confirmation, plan/progress persistence, fallback, ownership and stale writes. Auth.js sessions are synthetic; Google OAuth and live Gemini remain unverified.
- **Typecheck, full lint and catalogue validation PASS**. The eight-skill catalogue remains synthetic and `reviewed:false`.
- **Production build PASS**: Prisma generation, Next.js compilation, TypeScript, page generation and optimization completed. This is a local build, not deployment evidence.
- **DEF-02 corrected:** whole known identities are removed first; individual name tokens use whole-word matching and are preserved inside exact catalogue skill phrases. Full identities and case variants are still removed; unrelated longer words are preserved. Pattern-based minimization still cannot guarantee anonymity.

These 138 automated passes verify the local synthetic/mock slice, not complete T01–T14 coverage or production admission. Open live-provider, reviewed-content, deployment, measurement and professional-review gates remain as recorded in the coverage matrix.

## Earlier QA automation follow-on — 10 October 2026

The requirement-to-test matrix, per-scenario setup/action/expected/actual notes, defects and run instructions are in `QA-AUTOMATION-REPORT.md`. Baseline commit `457afd301de5e3603c998941e8b023d6a4c8bad5`; the checks below ran against the then-uncommitted Week 3 implementation and test expansion. This test branch preserved the pre-existing worktree. No production/personal database was reset, and no paid AI request or deployment occurred. Branch publication was requested after this verification checkpoint.

- **DEF-01 corrected in the local mock on 10 October:** demonstrated “designed boundary and negative test cases” now maps to the Test design review candidate in both mock extraction and server output validation. A real synthetic PDF regression returned Test design, API testing and Test automation. This is a narrow evidence rule, not proof of general AI extraction quality.
- **81 unit/parser PASS** in the final complete run after this correction, including the new positive PDF and negative aspiration cases, real synthetic encrypted/image-only/mixed-page/boundary fixtures, output validation and roadmap checks. Sandbox-only temporary cache and child-process startup failures did not reproduce in the successful normal local run; application deadlines were not changed.
- **40 PostgreSQL integration PASS** in one full run against the isolated migrated PostgreSQL 18.4 fixture. New cases cover purpose-specific consent, revoked in-flight CV evidence, invalid-then-valid and refusal paths, actual provider timeout, edited/forged origins, input minimization, no-op planning revision, stale skill edits, empty-inventory acknowledgment, deliberate retry, deletion during provider work, and quota/funding shared across CV and roadmap.
- **9 Playwright PASS** in one complete Chrome run on a separate port and `.next-e2e` build directory. The connected journey was then expanded to save an initially unconfirmed profile through the UI; that changed journey passed separately, and the other eight were unchanged. Synthetic Auth.js sessions exercised private APIs; real Google OAuth was not automated. Failure traces/screenshots use ignored `test-results/`.
- **1 known-defect test FAIL at that checkpoint** in the former `npm run test:known-defects` command. DEF-02 was subsequently corrected and moved into the normal suite as recorded above. The earlier DEF-01 failure is also a passing unit regression.
- An earlier full browser run had seven passes, a generic upload `SERVICE_UNAVAILABLE` response and a cold demo interaction timeout. The connected journey then passed alone and all nine passed in the final run. The generic 503 has no confirmed root cause and remains a local reliability observation; no assertion or product deadline was relaxed. The test runner now uses a distinct port/build directory and gives cold development compilation its own allowance.

At that earlier checkpoint, 81 unit passes and 40 integration plus nine browser passes totaled 130 cases across two source revisions. The merge-preparation run above supersedes those totals and reruns all three suites after DEF-01/DEF-02. Reviewed catalogue publication, real Google OAuth, live AI, deployment/runtime, professional semantic assessment, provider/backup retention and T13 evaluation remain blocked or not run as detailed in the matrix. The three Week 3 expected/actual cases below also passed in the current complete integration run.

## Implemented behavior

- Optional PDF → transient minimized text → strict mocked candidates → explicit merged skill confirmation → deterministic gaps → validated mock roadmap.
- Real pdf-parse 2.4.5 in a disposable child process: local synthetic limits of 2 MiB, 10 pages, 20,000 characters, eight seconds and 64 MiB **V8 heap**. Native/RSS memory and deployed limits remain unverified. Distinct malformed/encrypted/unsupported/insufficient-text outcomes; no OCR or URL imports.
- Excerpts stay temporary, outside PostgreSQL and browser persistent storage; parser diagnostics are suppressed. HMAC fingerprints bind extraction bytes to keys. Signed candidate references expire after 15 minutes and bind account/session/consent/exact content. Explicit manual review handles expired references; existing inventory origins remain unchanged.
- Independent consent under `development-mock-disclosure-v2`, mock disclosure and manual fallback. Production and paid modes cannot dispatch. API keys alone enable nothing.
- PostgreSQL operation status/replay, one shared operation/user, five reservations/rolling hour, two attempts, 45-second deadline and explicit UTC database-clock fencing. Shared mock budgets stop missing/expired/exhausted dispatch atomically. Uncertain reservations are not refunded. Mock units are not money.
- Full roadmap schema/prerequisite/coverage/capacity/duration validation. The synthetic semantic gate requires exact complete catalogue activities, outcomes and effort without overlap or shrinking. General provider semantics remain future work.
- Atomic archive/new-plan activation; old progress archived on success, new tasks unchecked, failure preserves the active plan. Session, invitation, consent sequence, revisions, operation fence and deadline are rechecked.
- Signed-in upload/review/generation and status recovery UI. Logout fences pending work. Browser-only `/demo` remains separate.
- Prisma CLI aligned from 6.19.3 to client/adapter 7.10.0; Next ESLint config aligned from 14.2.35 to 16.3.8; pdf-parse 2.4.5 added as a runtime dependency. Exact lockfile updated.

## Earlier Week 3 verification (before QA expansion)

| Check | Actual result | Scope / limitation |
| --- | --- | --- |
| TypeScript | PASS on final source | Workflow, child-process launcher, evidence validation and connected browser-test additions |
| ESLint | PASS on final source | Application, scripts and tests |
| Unit/parser cases | **41 PASS in one complete run** | Actual synthetic PDF parsing, input boundaries, evidence/origin checks and mocked output validation; clean npm test run |
| PostgreSQL migrations | PASS | Both applied to a new isolated real PostgreSQL 18.4 database |
| PostgreSQL integration | **20 PASS** | Complete real PostgreSQL suite; two Prisma clients for shared controls; database not mocked |
| Catalogue | PASS | Eight-skill `qa-synthetic-v1`, `reviewed:false` |
| Production build | **PASS** | Next.js 16.3.8 production build, TypeScript, page generation and output tracing completed after the spawn correction |
| Browser journeys | **6 PASS in one complete run** | Chrome 154.0.8037.98: connected mock workflow plus five existing regressions; synthetic signed Auth.js session and real API/database, not Google OAuth |
| Production smoke | **PASS** | Local built app: home 200, `/demo` 404, anonymous `/api/me` 401; API trace includes parser script and pdf-parse/pdfjs packages |
| Paid AI / deployment | **NOT RUN** | Intercepted Gemini adapter tests only; no paid call or deployment |

The earlier automatic approval-review usage-limit interruption was resolved. At that Week 3 checkpoint, **67 automated cases passed** (41 unit/parser, 20 real PostgreSQL, six browser), alongside type checking, lint, catalogue validation, production build and local production smoke checks. The follow-on results above supersede those case totals. These results verify the local synthetic/mock slice; they do not complete all T01–T14 groups or production admission.

Observed environment: Windows, Node.js 24.19.0, Next.js 16.3.8, React 19.3.0, Prisma CLI/client/adapter 7.10.0, pdf-parse 2.4.5, Vitest 5.0.3, Playwright 1.63.0 and Chrome 154.0.8037.98. Database reported PostgreSQL 18.4 (MSVC, x86_64 Windows). Disposable binaries/data were provisioned under ignored `.test-tools/`, bound to localhost and excluded from source deliverables. No application database was migrated.

## Three Week 3 tests: expected and actual

All fixtures are synthetic; model `mock-fixture-v1`, catalogue `qa-synthetic-v1`, date 10 October 2026. These are not live AI quality/accuracy results. Cases: `tests/integration/ai.test.ts`.

| Test / input | Expected | Actual |
| --- | --- | --- |
| **W3-1:** readable PDF containing affirmative test design, API testing and Playwright evidence; five hours/week | Three candidates without inventory changes; confirmation; five-week validated roadmap | **PASS:** actual PDF yielded three validated candidates; inventory remained unchanged before confirmation; confirmed skills produced five occupied weeks, each within 300 minutes, with unchecked tasks. Operation records contained no excerpt/CV text. The 15-second test allowance passed; application limit remains 45 seconds. |
| **W3-2:** malformed PDF bytes; populated inventory | Malformed-PDF code, zero attempts, inventory preserved, manual recovery succeeds | **PASS:** real PostgreSQL assertions observed `PDF_MALFORMED`, zero attempts, unchanged original skills and a fourth skill saved manually. |
| **W3-3:** completed task in active plan; two invalid mock responses | Exactly two attempts/reservations, no replacement/archive, same plan and progress | **PASS:** `INVALID_OUTPUT`, two calls, unchanged roadmap/completion; budget total 3 including initial successful generation. |

The connected browser test additionally verified that upload alone saves no skills, confirmation saves three CV-origin entries, five-week roadmap progress persists after reload, status recovery works, malformed-PDF fallback preserves skills/progress, and sign-out advances the session revision and denies private access. The completed integration run also passed valid archive/reset, replay, changed-file conflict, lost-extraction metadata-only recovery, status ownership, shared lease, cross-user funding race, consent/budget rejection, no-gap bypass, quota, and late activation fencing after consent/profile/catalogue/session/deletion/deadline changes. The original five store cases passed. This is partial T01–T14 coverage, not completion of every acceptance group.

## Corrections found during verification

1. Native PDF code crashed in a worker thread; moved into a disposable child process with suppressed diagnostics and cleanup. Parser tests and the production build now pass with the `spawn` launcher.
2. Adapter interpretation shifted `clock_timestamp()` by +05:30. Explicit `AT TIME ZONE 'UTC'` corrected the deadline checks; initial rerun passed 19/20. The remaining case exceeded the test runner timeout under concurrent build load; the completed rerun passed all 20 without changing the application deadline.
3. Candidate binding, contact/quoted-requirement section filtering and word-boundary evidence matching harden the conservative synthetic path; no general semantic accuracy claim.
4. Cold dev-route compilation initially exceeded browser assertions. The connected test now verifies the authenticated API is ready and waits for the actual Auth.js sign-out response before checking the redirect and anonymous 401. Final complete suite: six passes. No application timeout or safety gate was relaxed.
5. The production smoke fixture initially omitted its required auth secret; a temporary test secret corrected the fixture. Home 200, demo 404, private API 401 and parser trace checks then passed.

## Reproduce verification locally

Use Node 24.19.0. This workstation's global NVM shim reported an integrity error; process-local PATH to the installed Node 24.19.0 worked. Select/fix your Node installation before npm commands.

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run catalogue:validate
npm run build
# Separate test database, migrated with committed migrations:
$env:TEST_DATABASE_URL="postgresql://YOUR_LOCAL_TEST_DATABASE"
npm run test:integration
$env:RUN_AUTHENTICATED_E2E="true"
npm run test:e2e
```

The connected browser case needs free port 3000 and starts its own server with temporary test secrets. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only for installed compatible Chromium if needed. The local production smoke confirmed `/demo` 404 and anonymous `/api/me` 401. Repeat smoke and parser runtime verification on the intended host before any deployed claim.

## Remaining information and gates

- Local Google credentials/callback/invitation, application/test database URLs, generated signing secrets in ignored configuration. Actual Google login remains unverified.
- Explicit authorization before future paid calls/deployment; chosen schema-capable model/provider, processing/retention terms, verified token prices/currency, funded ceiling/payer/period and token caps. Mock counters are not paid pricing evidence.
- Named catalogue/content/access owner and reviewed resources/effort. Global revision fencing exists; publication/retained-version lookup/retired-skill/unavailable-resource workflows remain incomplete.
- Participant metadata/backup/provider retention, cleanup and restore evidence. Local mock metadata remains until account deletion; aggregate consumed budget counters remain without CV content. No all-store erasure claim.
- Professional identity or permitted pseudonym, discovery evidence, two confirmed requirements, evaluation permissions/criteria, student/submission details, realistic costs/adoption and assignment artifacts. None invented.
- Native-memory/deployed upload bounds and real Google/provider integration. npm installation reported high-severity advisories; advisory assessment is still a release gate.

## Actual AI-use record

Codex inspected requirements/code, created the branch and implemented the mock workflow, controls, synthetic fixtures/tests and documentation at the user's request. Verification/corrections are recorded above. AI-assisted development is distinct from the application's deterministic mocked provider. No live AI evidence, professional approval, paid costs or production readiness is claimed.
