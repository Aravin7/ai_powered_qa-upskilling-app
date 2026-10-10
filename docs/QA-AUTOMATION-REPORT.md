# QA automation report — 10 October 2026

Baseline commit `457afd301de5e3603c998941e8b023d6a4c8bad5`; working branch `codex/qa-automation-coverage`. The Week 3 application implementation was already uncommitted on `codex/week3-connected-workflow` when this work began. Creating the new branch retained those changes. The reported checks cover that working tree, not the baseline commit alone. At the test execution checkpoint, no commit, push, merge, deployment, paid AI call or personal database reset was performed. Branch publication was requested afterward.

The expected behavior is `specs.md` sections 1–2 and its T01–T14 matrix. Tests use synthetic data, the real Node `pdf-parse` child process, a separate migrated PostgreSQL 18.4 database, and a server-side mock `AIProvider`. Playwright authenticates with a synthetic signed Auth.js session only in the isolated test runner; it does not verify Google OAuth. `.env` credentials are not used as test credentials. Browser traces/screenshots are retained on failure under ignored `test-results/`.

## Execution and evidence

| Command / environment | Actual result |
| --- | --- |
| `npm test` | **81 passed**, three files, after the DEF-01 correction. The final complete run used normal local execution because sandbox temp-cache and PDF child-process startup caused false runner failures. |
| `TEST_DATABASE_URL=<isolated migrated DB> npm run test:integration` | **40 passed**, three files, real PostgreSQL and two-client races. |
| `TEST_DATABASE_URL=<isolated migrated DB> RUN_AUTHENTICATED_E2E=true E2E_PORT=31347 npm run test:e2e` | **9 passed** in one complete Chrome run (2.0 minutes). After that, the connected test was expanded to begin with unconfirmed profile onboarding; this changed test passed alone (1.0 minute), while the other eight were unchanged. Separate port and `.next-e2e` avoided the user's running development server. An earlier full run had seven passes, a transient generic upload 503, and a cold demo interaction timeout. The transient 503 remains a reliability observation. |
| `npm run typecheck` / `npm run lint` / `npm run catalogue:validate` | **Passed** on final source. Catalogue validates structurally as eight synthetic skills with `reviewed:false`; this is not professional content approval. |
| `npm run test:known-defects` | **1 failed** (DEF-02). The corrected DEF-01 PDF case moved into the passing unit suite. |

Test file keys: **U** = `tests/qa-coverage.test.ts`; **I** = `tests/integration/qa-coverage.test.ts`; **B** = `tests/e2e/qa-api.spec.ts`; **K** = `tests/known-defects/cv-test-design.test.ts`. Existing evidence: **EU** = `tests/unit.test.ts` and `tests/ai.test.ts`; **EI** = `tests/integration/ai.test.ts` and `tests/integration/store.test.ts`; **EB** = `tests/e2e/connected.spec.ts` and `tests/e2e/workspace.spec.ts`. Each separately named test contains its exact synthetic setup, action and retrying assertion. The table maps those executable variations to requirements and observed outcomes. “Partial” means the listed variation ran but the entire group did not.

## Requirement-to-test matrix

| Group; requirement | Preconditions / synthetic data; action | Observable expected result | Actual status and evidence / remaining boundary |
| --- | --- | --- | --- |
| CV-01; US04–05, R04–05, T04–05 | EI W3-1 and EB connected: readable text PDF, consent; extract, reload, confirm. U CV-01d parses a synthetic PDF with concrete boundary/negative test-design wording. | Supported candidates appear only for review; inventory changes on confirmation and survives reload. | **Passed local mock:** U CV-01d now returns test design, API testing and automation; prior EI/EB exact-label cases passed before this correction. Full browser/database suites were not rerun after it. |
| CV-02a–g; US04, R04–05, T04 | U: separate affirmative, negated, aspiration, quoted requirement and embedded-instruction strings; parse/validate. | Only affirmative evidence produces candidates; instructions cannot redirect processing. | **Passed** named U variations, including the new test-design aspiration rejection. No live model prompt-injection claim. |
| CV-03a–h; US04, R04, T04, D02 | U: unsupported bytes, corrupt header, encrypted fixture, 2 MiB exact/+1, 10/+1 pages, >20k text; invoke real parser. EI W3-2 verifies zero attempt on malformed input. | Controlled PDF codes, no truncation; malformed pre-dispatch rejection preserves inventory. | **Passed** parser boundaries and W3-2. Native process RSS and deployed upload limits remain **Blocked** by D02. |
| CV-04a–b; US04, R04, T04 | U: actual image-only XObject and readable+empty page fixture; real parser. EI W3-2 manual entry. | Insufficient text routes to manual entry; readable part survives with partial-page warning. | **Passed** local parser and manual fallback; OCR is out of scope. |
| CV-05a–d; US03–04, R04, T03 | I/B: missing/outdated consent and withdrawal while provider is held; upload before/after consent. | No unauthorized provider dispatch; rejected preconditions reserve zero attempts; late evidence withheld. | **Passed** I a–c and B d in the complete final run. |
| CV-06a–f; US04, R05, T04 | U: `{skills:[]}`, missing/extra fields, JSON string, foreign ID, unsupported excerpt. | Explicit empty array is valid no-evidence; all malformed/unsupported alternatives are rejected. | **Passed** U a–f. Transport-level malformed JSON is represented as a provider string; there is no live transport adapter. |
| CV-07a; US05, R05, T05 | I: populated inventory, extract then omit old entries; EB stale draft. | Upload leaves committed skills; omission without explicit removal fails atomically. | **Passed** I and existing EB/EU coverage. Open-page draft recovery is browser-local only. |
| CV-08a–e; US05, R05, T05 | U/I/EU: alias, C/C++/C#, normalized unmatched duplicates, forged and edited candidate references; save. | Canonical aliases dedupe, punctuation remains distinct, forged origin fails, edit becomes manual. | **Passed** U/I/EU. Expired token is covered in EU with a controlled clock. |
| CV-09a–c; US04, R11, T04/T11 | I/EI: invalid then valid response, refusal, actual 12-second provider timeouts, parser failure, key replay; inspect attempts/inventory. | Only permitted retry occurs; failures preserve inventory; replay does not redispatch. | **Passed** named variations, including two reserved timeout attempts. A first full browser run showed a generic upload 503 that did not repeat; actual network-lost response remains **Not run**. |
| CV-10a–b; US04, R04/R11, T04 | I/EI: send contact-bearing synthetic PDF to captured server provider, inspect operation metadata and keyed file replay. K tests name/skill collision. | Contact details removed, no raw text/excerpts in operation rows, changed-file key conflict. | **Mixed:** I/EI passed sampled storage/minimization before this correction; **Failed** K CV-10b: name-token removal erases unrelated `API testing` (DEF-02). Full log/backup audit **Blocked** by D04. |
| RM-01; US06–07, R06–07, T06–07 | EI W3-1/EB: confirmed QA skills, five hours/week; generate from server gaps. | 4–12 occupied weeks, <=300 minutes/week, practical work, valid resource IDs, saved plan. | **Passed local mock** five-week example. Reviewed-resource/content claim **Blocked**: catalogue has `reviewed:false` (D03). |
| RM-02a–b; US03/07, R07, T03/T07 | I/EI: CV consent declined, outdated/missing roadmap consent, withdrawal during held generation. | Purpose-specific dispatch; zero attempt before consent; withdrawn result cannot activate. | **Passed** I/EI for these gates. |
| RM-03; US06–07, R06–07, T06/T11 | EI: confirm every catalogue ID with existing plan; request generation. | `NO_GAPS`, zero provider calls/attempts, old plan preserved; no competence claim. | **Passed** EI no-gap checks; absence of competence claim is asserted in EU. |
| RM-04a; US07, R07, T07 | I: explicitly remove all skills, request without/with acknowledgement. | No attempt before acknowledgement; acknowledged introductory request may dispatch. | **Passed** I RM-04a. |
| RM-05a–c; US07, R07, T07 | U/EU: confirmed/missing prerequisites, omitted nice skill, deferral, weekly capacity. | Valid order/coverage/capacity accepted; missing prerequisite or undeclared deferral rejected without shrinking work. | **Passed** local catalogue validator cases. Professional effort judgement **Blocked** by D03. |
| RM-06a–f; US07, R07, T07, D02 | U/EU: week 99, blank title, negative effort, foreign resource, absent practical task; schema with 24 tasks/12 weeks. | Invalid plans rejected whole; 24 tasks within configured 60-task schema are not sliced. | **Passed** invalid cases and schema-only 24-task check. Full semantic activation of a valid 24-task plan **Blocked**: current eight-skill synthetic catalogue lacks reviewed 24-task activities. |
| RM-07a–e; US07/09, R07/R11, T07/T09 | U/I/EI: model infeasibility claims, independently demonstrable capacity, invented URL/activity, invalid twice, invalid then valid, nonretryable refusal. | Unverified impossibility is not asserted; bad output never replaces active plan; recovery counts attempts. | **Passed** local mock/validator cases; real provider quality **Not run**. |
| RM-08a–b; US09, R07/R11, T09 | I/EI/EU: no-op profile save and skill edit during held provider, changed role/profile/catalogue/consent/session/deletion/deadline. | No-op preserves revision; material changes fence late activation. | **Passed** I/EI/EU. Skill-meaning publication path **Blocked** by missing publication workflow. |
| RM-09a; US09, R11, T09 | I/EI: same key replay, changed input/file conflict, status lookup, terminal failure then new key. | No duplicate dispatch/plan; replay status only; new key deliberate retry. | **Passed** I/EI against real PostgreSQL. Abrupt process crash recovery **Not run**. |
| RM-10a–b; US11, R11, T11 | I/EI: two Prisma clients, multiple synthetic users, mixed CV/roadmap attempts, exhausted funding, held provider and expired deadline. | Five shared attempts/hour, one lease/user, two attempts/op, atomic budget reservation, late worker fenced. | **Passed** local DB tests. SDK hidden retries and real paid token/currency accounting **Blocked**: no paid adapter or approved funding profile. |
| WF-01; US01–09, T01–09 | EB: synthetic signed session, unconfirmed profile then UI save, consent/PDF/confirm/gaps/plan/task/reload. | Confirmed profile persists; connected user-visible state persists; extraction alone does not save. | **Passed** EB local mock journey after the profile-onboarding expansion. Real Google OAuth **Not run** in automation. |
| WF-02; US01, T01 | EI/EB: wrong subject, missing/revoked invite, anonymous/cross-origin request, cross-owner task/status. | No account attachment or private data/mutation. | **Passed** simulated identity/service checks. Real verified-email and Google account switching **Not run**. |
| WF-03a; US02, R03, T02 | EU/B: hours 1/40 and 0/41/fraction/string through schema and private API. | Valid whole values persist; bad writes return 400 and cannot advance onboarding. | **Passed** EU and B API. |
| WF-04; US02/14, T02/T14 | EB: save profile/skills, reload; stale draft in another tab. | Confirmed steps resume; failed save leaves draft intact. | **Passed** browser demo regression. Draft across browser closure is out of scope. |
| WF-05a; US03/05/06, T03/T05/T06 | B/EB: manual skills with no CV consent; GET gaps with forged query params. | Authoritative deterministic gaps; CV consent not required for manual entry. | **Passed** B and EB. Arbitrary priority override mutation is not exposed by the API. |
| WF-06; US08, T08 | EB/EI/EU: check/undo/reload, stale task revision, archived task ID, null progress. | Persisted completion only, stale write conflict, active-plan-only percentage. | **Passed** existing browser/service/unit cases. Network interruption during save **Not run**. |
| WF-07; US09, T09 | EI/EB: valid replacement, invalid twice, changed input, old completed task. | One active plan; failed replacement retains plan/progress; valid replacement archives and resets atomically. | **Passed** existing two-client PostgreSQL and browser checks. Forced transaction crash **Not run**. |
| WF-08; US01/14, T01/T14 | EB/EI: sign out, session revision, revoked invite, stale session. | Private API becomes inaccessible; logout does not delete account. | **Passed** synthetic session and DB checks. Browser account switching/late response race **Not run**. |
| WF-09a; US10, T10 | I/EI: delete during held CV/roadmap provider and before activation. | No account recreation or late plan/skill persistence; revoked invite remains. | **Passed** local DB provider/deadline fences. Deletion during parser phase and backup restore **Not run/Blocked** by D04. |
| WF-10; US12, T12 | EU/EI/catalogue validator: unreviewed synthetic catalogue, global revision changed during generation. | Production publication rejected; stale generation cannot activate; old plan preserved. | **Passed** validation/fencing only. Publication, retained semantic versions and unavailable-resource recovery **Blocked**: operator/content workflow absent (D03/D07). |

## Defects reproduced without product changes

| ID | Reproduction and expected | Actual / evidence | Impact |
| --- | --- | --- | --- |
| DEF-01, corrected in local mock | U CV-01d; synthetic PDF says “designed boundary and negative test cases,” alongside affirmative API and Playwright work. Expected `test-design`, `api-testing`, `automation` candidates. | **Passed after correction:** all three candidates from real synthetic PDF parsing, minimized text and mock-provider validation. Prior result omitted test design. | This fixes one narrow demonstrated wording; broader semantic extraction and live AI remain unverified. |
| DEF-02 | K CV-10b: learner name includes the token `API`, CV says “I performed API testing.” Expected skill phrase retained after name minimization. | **Failed:** minimizer removes `API` globally from unrelated evidence. | Candidate can disappear due to over-broad identifier replacement. |

The mock provider and validator now share one narrow test-design evidence rule. The separate known-defect command still exits nonzero for DEF-02.

## Three Week 3 expected-versus-observed examples

| Case / data | Expected | Observed in real PostgreSQL integration run |
| --- | --- | --- |
| W3-1; synthetic readable PDF with three exact-label affirmative claims, five hours/week | Three temporary candidates; confirmation then valid plan <=300 minutes/week. | **Passed:** three candidates, unchanged pre-confirmation inventory, confirmed CV skills, five occupied weeks and unchecked tasks. |
| W3-2; malformed PDF with existing skills | `PDF_MALFORMED`, zero attempts, old skills preserved, manual entry works. | **Passed:** those codes/counts and a fourth manually saved skill. |
| W3-3; saved completed task, two invalid mocked plan outputs | Exactly two reserved attempts; old active plan/progress unchanged. | **Passed:** `INVALID_OUTPUT`, two provider calls/reservations and one unchanged roadmap with completed task. |

These are parser/database/mock-provider results, not live AI tests.

## Remaining coverage boundaries

- Browser/device/accessibility: one Chrome desktop journey and a narrow mobile overflow check; no Firefox/WebKit, keyboard/screen-reader audit or device matrix (T14/D11).
- Recoverable network loss during upload/save and actual process-crash recovery are not exercised; the operation-key status path is tested without a real network outage.
- T13 evaluation events, external practical-work rubric, sampling/missingness and research permissions remain blocked by D06/D08. Checked tasks are activity, not assessed capability.
- Real Google OAuth, verified-email behavior and live AI are not part of synthetic identity/mock tests. No paid calls are authorized.
- Deployment compatibility, native parser memory, provider retention, application backups/restore, deletion schedules and all-store erasure lack target-environment evidence (D02/D04).
- Professional review of skill semantics, effort, resource access and live plan quality is absent (D03/D07). The catalogue is explicitly unreviewed.

## Reproduction

Use Node 24.19.0. Migrate a **separate disposable** PostgreSQL database using the committed migrations, then set `TEST_DATABASE_URL` to that database. The test commands reject missing test DB configuration. Keep `DATABASE_URL` for your app untouched. With Chrome installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if Playwright Chromium is unavailable. `E2E_PORT` selects a free test port; authenticated tests use `.next-e2e` so an existing dev server is not stopped.

```powershell
npm run typecheck
npm run lint
npm test
$env:TEST_DATABASE_URL='postgresql://YOUR_ISOLATED_TEST_DB'
npm run test:integration
$env:RUN_AUTHENTICATED_E2E='true'
$env:E2E_PORT='31347'
npm run test:e2e
npm run test:known-defects # expected nonzero until DEF-02 is fixed
```

The runner uses generated test secrets and synthetic identities; `RUN_AUTHENTICATED_E2E` must not be enabled against a valued database. Browser failure artifacts are stored in ignored `test-results/`.
