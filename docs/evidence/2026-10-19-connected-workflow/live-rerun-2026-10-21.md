# Authorized allowance extension and live rerun — 21 October 2026

Aravin instructed: “okay then change it to the 10 and test.” This authorizes the isolated test ceiling increase from five to ten and up to five additional requests. It does not change the application's five-attempts/user/rolling-hour quota, two provider attempts/operation, deadlines or paid-fallback restrictions.

Branch: `codex/live-reviewed-roadmap-workflow`; base `aee234a5b32ea295a31a266d74929eed29e35ca1` plus uncommitted changes. Synthetic identities/content, real Groq `openai/gpt-oss-20b`, existing isolated local database `qa_pathways_live_20261019` on port 55471. No real CV or Google OAuth; no application database, `.env`, push, merge or deployment changes.

## Allowance change

The opt-in runner accepts `--extend-test-allowance-to-10` for this specifically authorized amendment. It checks the existing configuration/hash, mode/currency, enabled state, original ceiling/reservations and exact notice. An optimistic conditional update changes only the isolated budget ceiling/configuration hash and renews its expired test window for one day. The five previous reservations remain consumed. Repeating the flag against an already-ten allowance does not reset counters or renew expiry. New test consent is recorded under the changed configuration version.

The final [read-only database result](live-database-result-2026-10-21.json) confirms **ceiling 10, reserved 8**, zero remaining synthetic users/roadmaps/active requirement pointers, and eight retained immutable synthetic test snapshots. The earlier five-attempt evidence file is preserved separately.

## Actual requests and outcomes

| Additional request | Real observation | Outcome | Aggregate |
|---|---|---|---|
| 1 | HTTP 200; controlled diagnostic `native_metadata`, rejected, `toolCount: 5` | Invalid output. The reported tool count alone exceeds the configured two-tool bound. No selection/page check reached. | 6/10 |
| 2 | No successful HTTP response logged; `PROVIDER_UNAVAILABLE` | Controlled provider failure. This does not establish a precise network/timeout root cause. | 7/10 |
| 3 | HTTP 200 after focused search-stage prompt; controlled diagnostic `native_metadata`, rejected, `toolCount: 4` | Invalid output; reported tool count still exceeds two. No selection/page check reached. | 8/10 |

**Overall: live workflow Failed during native research.** No resource pair or new roadmap was activated. Missing-resource precondition fallback Passed with zero provider reservations. Provider-failure checks confirmed the existing completed plan stayed active with progress intact before disposable fixture cleanup. Two authorized attempts remain unused; stopped to avoid repeating the demonstrated tool-bound rejection. No sixth additional request, hidden SDK retry, counter reset or new-budget workaround occurred.

This evidence identifies a concrete acceptance blocker for the HTTP-200 responses: native tool counts of five/four violate the two-tool bound. It does **not** prove the remaining metadata, candidate JSON or source bindings would pass if that bound changed. Prior live failures remain distinct and are not retrospectively reclassified.

## Narrow corrections and local verification

The configured internal-tool count is now included in the native search instruction. Input values outside the existing allowed range 1–4 are rejected. Search now asks for focused candidate discovery without duplicating the application page retrieval and subsequent structured AI review. This preserves source grounding, independent access/relevance checks and the existing attempt/deadline constraints. It is a prompt instruction, **not** an enforceable pre-dispatch cap; the server still rejects over-bound responses afterward. The bound was not raised to make this test pass.

Focused mocked `resource-discovery` and `groq-provider` checks **Passed 63/63** after the final prompt changes. TypeScript, full lint and whitespace checks are recorded in BUILD-STATUS.md. No unrelated browser/build/full-suite rerun was needed for this isolated runner/prompt correction. Successful earlier mocked/page/browser checks do not establish live research success.

## Executed commands

With the installed Node 24.19.0 directory prepended to PATH:

```powershell
node node_modules/typescript/bin/tsc --noEmit
$env:TEST_DATABASE_URL="postgresql://workflow_test@127.0.0.1:55471/qa_pathways_live_20261019"
$env:RUN_LIVE_REVIEWED_WORKFLOW="true"
$env:GROQ_FREE_PLAN_CONFIRMED="true"
node --import tsx scripts/test-live-reviewed-workflow.ts --extend-test-allowance-to-10
node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/resource-discovery.test.ts tests/groq-provider.test.ts
node --import tsx scripts/test-live-reviewed-workflow.ts
node --import tsx scripts/test-live-reviewed-workflow.ts
npm run lint
git diff --check
```

The two non-extension runs were deliberate diagnostic attempts following local prompt checks, not automatic retries. A separate read-only local database query produced the linked accounting/cleanup JSON. No credentials, raw model prose, CV text or prompts were logged.
