# Authorized live synthetic resource journey — 19 October 2026

**Overall result: Failed. The new connected live resource/roadmap workflow is not established.** This report records real external Groq calls, separately from the successful mocked checks in README.md.

Authorization: Aravin explicitly said “Run the live synthetic journey”, after confirming Groq Free Plan with paid billing disabled. No paid fallback was authorized or enabled. Branch: `codex/live-reviewed-roadmap-workflow`; base `aee234a5b32ea295a31a266d74929eed29e35ca1` plus uncommitted implementation/test/report changes. No commit, push, merge or deployment.

## Scope and environment

- Windows/PowerShell, Node 24.19.0, PostgreSQL 18.4, Groq `openai/gpt-oss-20b`.
- Newly created local `qa_pathways_live_20261019` database on `127.0.0.1:55471`, with all eleven existing migrations. No reset or use of the application database; `.env` and real credentials remained unchanged/out of Git.
- Opt-in runner: `scripts/test-live-reviewed-workflow.ts`. It uses the real provider adapter, service orchestration and default public-page verifier. No provider/DNS/page mock was supplied.
- Synthetic reviewed test vocabulary for Playwright assertions and Playwright/GitHub Actions CI; public Playwright documentation used as source context. Its review metadata explicitly says synthetic smoke fixture, **not professional approval**. Actual v4 content was not activated.
- Synthetic invited identity and empty confirmed inventory with introductory acknowledgment, five hours/week. The route begins with deterministic selection/gaps and an existing completed synthetic plan. CV extraction and real Google OAuth are not part of this run.
- A fixed aggregate allowance of five requests. Re-executions preserved the same budget/counters; no reset, refund or new-budget workaround. Each execution created a disposable synthetic identity; the aggregate limit still bounded all five provider requests together.

## Expected journey

Missing resources should block dispatch and preserve the old plan. Native research and structured selection should save two independently checked resources/topic. Two topics require four requests, followed by one plan request. A valid replacement should archive prior completion atomically, start new tasks unchecked and persist a subsequent completion. Internal browser-tool count validation is post-response; it is not a spending cap. This run relied on the user's Free Plan/billing-disabled confirmation and never enabled paid fallback.

## Actual executions

| Execution | Real first research response | Observable result | Aggregate reserved |
|---|---|---|---|
| 1 | HTTP 400 | `PROVIDER_UNAVAILABLE`; stopped before selection | 1/5 |
| 2, deliberate diagnostic | HTTP 400 | Error type `invalid_request_error`; safe category identified model-related rejection | 2/5 |
| 3, deliberate diagnostic | HTTP 400 | Safe error categories `model`, `support`; prior plan active and completion retained | 3/5 |
| 4, after removing explicit `citation_options` | HTTP 200 | `INVALID_OUTPUT` under strict validation; no pair activated; prior plan/progress retained | 4/5 |
| 5, bounded response-shape diagnostic | HTTP 200 headers | `PROVIDER_UNAVAILABLE`; prior plan active and completion retained | 5/5 |

All executions first Passed the missing-resource precondition check: controlled `RESOURCE_VERIFICATION_REQUIRED`, zero attempts consumed, existing plan still active. Each failed research operation used one attempt; no automatic SDK retry or hidden third correction occurred. A separate **read-only** `GET /openai/v1/models` returned HTTP 200 and included the configured `openai/gpt-oss-20b`; that was not an inference request and does not prove browser-search compatibility.

No valid resource pair was saved. Independent candidate-page inspection, structured selection, new roadmap generation and live completion/reload were **Not reached**, not Passed. Existing-plan preservation Passed before disposable fixture cleanup. The app's mocked atomic-save and progress tests remain separate evidence.

## Findings and limits

1. The adapter sent optional `citation_options: enabled`; removing that setting was followed by HTTP 200. Native source validation uses executed-tool metadata, so this option is unnecessary. The request helper now omits it and has a regression assertion. This is a compatibility correction, not proof that all live outputs now validate.
2. The first HTTP-200 response did not satisfy the current strict output/source contract. The root mismatch was not established: do not claim it was necessarily hallucinated JSON or missing native metadata. No source/semantic assertion was weakened to make it pass.
3. The last diagnostic used a bounded cloned-body reader. A local harness issue was identified afterward: awaiting cancellation of one response tee branch before consuming the original can stall. The reader now cancels without awaiting the other branch, with a ceiling matching the adapter's 200,000-byte response bound. This correction was not live rerun; the final failure cannot be conclusively attributed to provider latency versus diagnostics.
4. The aggregate allowance is exhausted at five; no sixth inference request was made. Investigating the exact HTTP-200 schema/source shape requires a newly authorized bounded run. Existing uncertain reservations remain charged to the local attempt counter.
5. Logs contain HTTP statuses, controlled error categories and shape descriptors only. No CV, provider prompt/response prose, error body, API key or private credential was logged or committed. No live browser screenshots exist because a usable resource pair/UI plan was never reached; the four screenshots in the local report are explicitly mocked/seeded evidence.

## Local checks after changes

The focused mocked `resource-discovery` and `groq-provider` tests Passed **56/56** after removing the citation option. TypeScript, full lint and whitespace checks are recorded in BUILD-STATUS.md. The earlier 242-unit, 127-integration and two-browser results predate this live execution and do not establish its success. No repeat of unrelated browser checks was needed for the request option and optional runner.

## Reproduction — external requests, not part of normal tests

Requires explicit live authorization, a server-side Groq key, user-confirmed Free Plan with paid billing disabled, a separately migrated database with the exact test name below, and an unexhausted approved allowance. The existing budget is exhausted; this command will not replenish it.

```powershell
$env:TEST_DATABASE_URL="postgresql://workflow_test@127.0.0.1:55471/qa_pathways_live_20261019"
$env:RUN_LIVE_REVIEWED_WORKFLOW="true"
$env:GROQ_FREE_PLAN_CONFIRMED="true"
node --import tsx scripts/test-live-reviewed-workflow.ts
```

The runner cleans only its disposable synthetic learner/invitation and isolated active-content pointer; immutable test snapshots and aggregate budget consumption are preserved. Do not use it against a personal/application database or describe its synthetic content as an approved curriculum.

The final [read-only database inspection](live-database-result.json) confirms **reserved 5 / ceiling 5**, zero remaining test users/roadmaps/active requirement pointers, and five retained immutable synthetic test snapshots. This query made no provider request.

## Offline diagnostic follow-up

The optional runner no longer clones or reads provider bodies. An optional `onResearchDiagnostic` callback now receives controlled stage/outcome/tool-count events from the adapter's existing parse path. It can identify `native_metadata`, `research_json`, `candidate_schema`, `source_binding`, `resource_urls` or accepted output. It receives no raw message, text, title, URL, error prose, arbitrary JSON field name or credential. Observer exceptions are ignored so diagnostics cannot turn a rejected response into success, fail a valid response or trigger another dispatch. Existing validation/error outcomes remain unchanged.

Focused synthetic/intercepted tests Passed **63/63**, including five distinct rejection stages, observer failure isolation and propagation through one adapter dispatch. This verifies local diagnostic behavior only. The previous HTTP-200 body was intentionally not retained, and no new request was made; its exact mismatch remains unknown. The exhausted allowance was not reset, renewed or expanded.

[Groq's published TypeScript response definition](https://github.com/groq/groq-typescript/blob/main/src/resources/chat/completions.ts) documents native result fields but describes `executed_tools` as belonging to compound AI systems. That shared SDK shape does not guarantee this configured GPT-OSS browser-search response contains it. Missing native provenance must still fail; model-written URLs must not be relabelled as provider source metadata. The next authorized bounded run should use the controlled diagnostic stage to establish the actual mismatch before changing the parser or model.
