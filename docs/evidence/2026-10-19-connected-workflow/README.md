# Connected AI workflow — local verification, 19 October 2026

**21 October update:** the isolated ceiling was explicitly extended to ten, preserving previous use. Three additional live research requests failed; aggregate consumption is **8/10**, with two unused. See [the new rerun report](live-rerun-2026-10-21.md). Historical 5/5 statements below describe the earlier checkpoint.

**Subsequent live attempt:** the user later authorized the real synthetic resource journey. It **Failed** during native research; see [the separate live execution record](live-execution.md). The results and screenshots below remain local mocked/seeded evidence.

Branch: `codex/live-reviewed-roadmap-workflow`. Tested base commit: `aee234a5b32ea295a31a266d74929eed29e35ca1`, plus the uncommitted implementation, tests and documentation in this branch. No commit, push, merge or deployment was performed. This record does not claim live AI success.

Environment: Windows/PowerShell, Node 24.19.0, PostgreSQL 18.4, installed Google Chrome through Playwright's Chromium project. Database: **only** `qa_pathways_workflow_20261019` on `127.0.0.1:55471`. All eleven existing migrations were applied to this isolated database; no new schema migration was needed. No application database reset/migration or `.env` change occurred. Synthetic users are unique per case. Provider requests, DNS and page bodies are intercepted in integration tests; browser journeys use mock AI or seeded synthetic researched-link metadata. Google OAuth is not exercised.

## Subsequent user response — 19 October 2026

In response to the exact-current-v4 review question, Aravin answered “yes , 19/10/2026”. Record this as user-reported approval dated 19 October 2026. That response supplied no reviewer identity or separate review evidence; do not attribute it to Tharindu or fabricate a professional review record. No requirement snapshot was activated from this response.

Aravin also stated that separate native-search terms/privacy verification was unnecessary for this student portfolio. This is a request to avoid production-style approval overhead, not evidence of account billing settings or authorization for paid calls. Keep the existing synthetic-only/no-paid-call limits. No separate formal provider-approval document is being requested again in this response.

In the subsequent reply, Aravin confirmed that the Groq account is currently on the **Free Plan with paid billing disabled**. This is user-provided account-status evidence, not an independent console inspection. It resolves the account-status question without authorizing paid fallback or claiming live success. The reply answered that specific account-status question; no live request or runtime activation was performed from it.

Public documentation was checked without an API call: [Groq browser search](https://console.groq.com/docs/tool-use/built-in-tools/browser-search) supports the configured `openai/gpt-oss-20b`, runs provider-side and cannot be combined with structured output. It delegates pricing to a pricing link which redirected to Groq's homepage in this check; zero-charge native-search eligibility for this particular account could not be established. [Groq's data policy](https://console.groq.com/docs/your-data) describes usage metadata retention, limited reliability/abuse retention and configurable data controls; account-specific settings and downstream search-provider retention were not verified. Public documentation is not account access. No live inference/search request was made.

## Executed checks

| Check | Actual result | Evidence boundary |
|---|---|---|
| `npm test` | Passed, 242 tests / 12 files; final run 12.25 seconds | Synthetic unit/parser/provider tests; no live AI |
| `npm run test:integration` | Passed, 127 tests / 10 files; 101.31 seconds | Real isolated PostgreSQL, controlled mocks |
| Connected Groq-mode integration subset after final scope update | Passed, 8 tests; 14.82 seconds | Real database and actual adapter/orchestration; HTTP/DNS/pages intercepted |
| Focused Playwright rerun | Passed, 2 tests; 1.3 minutes | Synthetic signed identities, mock processing and seeded resource links |
| `npm run build` | Passed | Local production compilation; no deployment |
| `tsc --noEmit`, `npm run lint`, `git diff --check` | Passed | Final local static/whitespace checks |
| Rest of browser suite | Not run in this slice | Earlier results are historical |
| Live Groq search/selection/roadmap journey | Not run; activation gated | No external provider request or real page verification |
| Real Google OAuth, deployment/retention checks | Not run | Not established by synthetic sessions/builds |

The first focused browser run had one Passed case and one Failed case: the seeded link test asserted a saved checkbox within five seconds while its PATCH remained pending. The test now waits for that response and requires HTTP 200 before checking the checkbox. The explicit rerun Passed both cases; blanket retries remain disabled. Slow-filesystem and `pg` concurrent-query deprecation warnings were observed; neither was relabelled as a failed application requirement. The attempted redundant PostgreSQL startup could not open an already-held log; integration connections verified and reused the running isolated instance without deleting locks or restarting another cluster.

## Three Week 3 expected-versus-observed examples

| Test / requirement | Preconditions and actions | Expected | Actual / status |
|---|---|---|---|
| CV-SEC-01 / US04–US05, R04–R05 | Synthetic personal/summary/work/technology/education/extracurricular sections. Run text preparation, construct the provider payload, validate a mocked Playwright suggestion against its source block. | Retain professional summary/work/technology text, exclude personal/education/extra text from the provider input, and classify a technology-list mention as listed self-report. | Passed in the final 242-test suite. The payload contains the retained source blocks, excludes the seeded private/education/extra lines, and the candidate has `evidenceType: listed`. This is source preparation/validation evidence, not live extraction quality. |
| CW-01 / US07–US09, US11–US12, T07/T09/T11/T15 | Synthetic reviewed two-topic direction, empty confirmed inventory with introductory acknowledgment, five hours/week, funded mock HTTP adapter, previous completed plan. Research two pairs, generate, complete a task, read through another client, replay. | Five total reservations, two resources/topic, valid atomic replacement, archived old progress, unchecked new tasks; saved completion survives a new read and replay makes no dispatch. | Passed in both the full database suite and final 8-case subset. Exactly five HTTP calls/reservations; old plan archived with progress; new completion persisted; same-key replay made no further call and a sixth request was quota-rejected. Browser RR-E2E separately Passed the mock UI journey and reload. |
| RR-E2E fallback / US07, US09, US11, US14 | Existing completed plan, selected synthetic reviewed direction, no researched resources. Attempt replacement in the browser. Then research each topic, deliberately lose a saved response, recover status, generate and reload completion. | Missing resources prevent dispatch and preserve the active plan. Lost response recovers saved resources without redispatch. A later valid replacement saves and retains progress after reload. | Passed. The missing-resource alert appeared, attempt count remained zero and old plan stayed active. Saved-status recovery found the successful two-attempt resource operation. Final plan has five activities / 230 minutes and exactly one active plan; checked completion survived reload. |

Additional new checks: RS-18 retains access/payment and prerequisite passages outside the main article; RS-19 keeps a usable pair despite an inaccessible extra candidate; RS-20 rejects single-word topic overlap. CW-07 verifies that the unusable extra candidate is excluded from the actual structured-selection request, with exactly two reservations and the old active plan preserved. CW-UI checks both external `href` values, `noopener noreferrer`, the synthetic provenance warning and persisted completion. None of these proves real-page relevance or provider quality.

## Screenshots

- [Missing-resource fallback](01-missing-resource-fallback.png): controlled error and preservation notice. Database assertions establish actual preservation.
- [Saved mock topic resources](02-synthetic-topic-resources.png): explicit synthetic placeholders, not real recommendations.
- [Saved plan and progress after reload](03-saved-plan-progress-reload.png).
- [Two frozen external links and saved progress](04-frozen-resource-links.png): deliberately seeded synthetic metadata; no live page inspection.

## Reproduce locally

Use Node 24 and a separately migrated, disposable local database named `qa_pathways_*`. Do not point tests at a personal or production database. No actual Google or AI credentials are required for these tests.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
$env:TEST_DATABASE_URL="postgresql://workflow_test@127.0.0.1:55471/qa_pathways_workflow_20261019"
npm run test:integration
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --testTimeout=15000 tests/integration/connected-groq-workflow.test.ts
$env:RUN_AUTHENTICATED_E2E="true"
$env:E2E_PORT="3107"
$env:E2E_EVIDENCE_DIR="docs/evidence/2026-10-19-connected-workflow"
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
npm run test:e2e -- tests/e2e/reviewed-roadmap.spec.ts tests/e2e/resource-links.spec.ts
git diff --check
```

The executed commands prepended the installed Node 24.19.0 directory to PATH. Static checking was invoked as `node node_modules/typescript/bin/tsc --noEmit`, equivalent to the existing typecheck script. The browser harness starts its own server on the selected port against the test database with temporary secrets. Use an installed compatible Chromium path or Playwright's installed browser. Run database and browser suites sequentially because they intentionally exercise the same isolated active-requirement pointer. Tests do not fetch the external links.

## Remaining limitations and activation gates

- The exact current v4 capability meanings, direction priorities, prerequisites and effort estimates still require professional approval; the actual draft remains inactive.
- Native-search eligibility, zero-charge usage protection, retention/privacy and the exact processing notice require verified approval. Reported internal-tool counts are validated **after** the provider responds; they are not a hard spending cap. Approval fields are operator records, not proof of provider billing terms. Production Groq and paid fallback remain disabled.
- Page verification inspects bounded text without JavaScript/OCR/video transcription. Generic hosts, changing pages, terminology differences, paywalls and ambiguous wording can produce false positives/negatives. A publicly retrievable landing page does not prove full lesson access. LLM semantic judgments plus quoted evidence do not replace professional content review.
- Source excerpts are transient. Stored resource URLs, citations, checked time and bounded access/prerequisite notes do not establish future availability. Existing plan snapshots remain frozen.
- Larger directions may require more than five attempts and therefore more than one rolling-hour window; research/planning do not bypass the shared quota. No live synthetic journey is authorized by these local results.
- Real Google OAuth, accessibility/device coverage, professional learning usefulness, deployed parser/runtime behavior, provider retention and backup/deletion guarantees remain outside this verification slice.

## Original live journey procedure — preparation before authorization

1. Obtain exact-content approval for `qa-capabilities-draft-v4`, digest `746d9e94eb0d73396a283f17bc01518f28a583b6d65472857f20a1cf0c9f9b75`, as presented in `docs/qa-requirements-review.md` and its source definitions. The review must cover capability scope, direction priorities, prerequisites and effort assumptions. A changed draft requires a new digest/review; the historical v3 amendment approval does not approve v4.
2. Verify the account/model's native-search eligibility, usage/cost protection and retention settings. Record real approval/terms references and a notice describing native search, the data sent, page retrieval and retention uncertainty. Bind the exact notice digest in the local configuration. Provider-managed internal calls cannot be hard-capped by the current adapter; if zero-charge eligibility cannot be established, do not activate this configuration.
3. Obtain explicit authorization for the **new connected live synthetic journey**, including its allowed request ceiling. These local tests and previous live smoke authorization do not authorize this run. Publish approved content/configuration only to a separate disposable test database; preserve budget counters, and renew purpose-specific consent under the new configuration version.
4. Use synthetic confirmed skills and interests, select an approved reviewed direction, inspect its deterministic gaps, and research every retained gap topic. Each topic reserves two requests. Planning normally reserves one, potentially two with a correction. Choose data that fits the approved allowance and five-attempt rolling hour; wait for older reservations to expire when needed rather than changing the quota or under-reporting work.
5. Generate within the saved weekly availability, inspect the two resources/topic and their access notes, complete an activity and reload. Record native request/source metadata, actual reservations and validation outcomes without logging CV text, provider prompts or credentials. Show a controlled missing-resource/withdrawn-consent failure preserving the existing plan. Report provider/model limitations and actual failures honestly.

`npm run test:live:groq` is the **older CV/sample-roadmap smoke script**. It does not select reviewed directions or research native resources and must not be cited as proof that this new connected resource workflow works. The new journey can be performed through the existing signed-in UI after its gates are resolved; no teaching tools or additional live-test runner is required.
