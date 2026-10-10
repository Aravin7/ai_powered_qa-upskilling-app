# Build status — 10 October 2026 · IT6070 Week 3

Current branch: `codex/qa-automation-coverage`, branched from `codex/week3-connected-workflow` while its Week 3 implementation was still uncommitted. Connected **local mock-provider** implementation; not a live AI integration or verified production release. Requirements remain in `../specs.md`. Prior evidence is retained in `BUILD-STATUS-2026-10-03.md`; historical passes are not current regression evidence.

## Live-provider preparation — 10 October 2026

The user selected Google Gemini Flash Latest (`gemini-flash-latest`) for exploration. `src/lib/ai-provider-request.ts` prepares versioned CV and roadmap requests from minimized text and server-owned catalogue data. `src/lib/gemini-provider.ts` now builds a single Gemini REST request with structured JSON output, no SDK retries or tools, bounded response reading and controlled failure mapping. Four adapter cases and two request-contract cases passed with intercepted responses; no live AI request was made. Typecheck and targeted lint passed. The application routes still select the mock provider, and `AI_MODE=paid` fails closed. Gemini Flash Latest is a changing alias, so a fixed model and verified price are needed for a funded pilot. Funded limit, provider privacy/retention terms and catalogue review remain open.

The five-attempt rolling-hour guard had been commented out in the working copy, conflicting with `specs.md` R11. The user asked to restore it; the guard is now active again. Two targeted quota cases passed against the isolated real PostgreSQL fixture, including cross-feature accounting. This preparation is **not** live AI integration evidence.

## QA automation follow-on — 10 October 2026

The requirement-to-test matrix, per-scenario setup/action/expected/actual notes, defects and run instructions are in `QA-AUTOMATION-REPORT.md`. Baseline commit `457afd301de5e3603c998941e8b023d6a4c8bad5`; the checks below ran against the then-uncommitted Week 3 implementation and test expansion. This test branch preserved the pre-existing worktree. No production/personal database was reset, and no paid AI request or deployment occurred. Branch publication was requested after this verification checkpoint.

- **DEF-01 corrected in the local mock on 10 October:** demonstrated “designed boundary and negative test cases” now maps to the Test design review candidate in both mock extraction and server output validation. A real synthetic PDF regression returned Test design, API testing and Test automation. This is a narrow evidence rule, not proof of general AI extraction quality.
- **81 unit/parser PASS** in the final complete run after this correction, including the new positive PDF and negative aspiration cases, real synthetic encrypted/image-only/mixed-page/boundary fixtures, output validation and roadmap checks. Sandbox-only temporary cache and child-process startup failures did not reproduce in the successful normal local run; application deadlines were not changed.
- **40 PostgreSQL integration PASS** in one full run against the isolated migrated PostgreSQL 18.4 fixture. New cases cover purpose-specific consent, revoked in-flight CV evidence, invalid-then-valid and refusal paths, actual provider timeout, edited/forged origins, input minimization, no-op planning revision, stale skill edits, empty-inventory acknowledgment, deliberate retry, deletion during provider work, and quota/funding shared across CV and roadmap.
- **9 Playwright PASS** in one complete Chrome run on a separate port and `.next-e2e` build directory. The connected journey was then expanded to save an initially unconfirmed profile through the UI; that changed journey passed separately, and the other eight were unchanged. Synthetic Auth.js sessions exercised private APIs; real Google OAuth was not automated. Failure traces/screenshots use ignored `test-results/`.
- **1 known-defect test FAIL** in the separate `npm run test:known-defects` command. DEF-02: known-name token removal can erase an unrelated `API testing` phrase. Manual skill review remains available. The earlier DEF-01 failure is now a passing unit regression.
- An earlier full browser run had seven passes, a generic upload `SERVICE_UNAVAILABLE` response and a cold demo interaction timeout. The connected journey then passed alone and all nine passed in the final run. The generic 503 has no confirmed root cause and remains a local reliability observation; no assertion or product deadline was relaxed. The test runner now uses a distinct port/build directory and gives cold development compilation its own allowance.

The **81 current unit passes** and **40 integration plus 9 browser passes from before the correction** total 130 observed local synthetic/mock cases across the two source revisions. The integration and browser suites were not rerun after DEF-01; do not treat 130 as a single current full-suite run or complete T01–T14 coverage. Reviewed catalogue publication, real Google OAuth, live AI, deployment/runtime, professional semantic assessment, provider/backup retention and T13 evaluation remain blocked or not run as detailed in the matrix. The three Week 3 expected/actual cases below passed in the earlier complete integration run.

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
