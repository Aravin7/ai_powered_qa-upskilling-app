# Resource research contract checks - 17 October 2026

Base commit: `535c74b327df9320486be781e256748a1542e77a`, branch `codex/qa-pathway-requirements-amendment`, plus uncommitted source/docs changes. Existing CV edits, the user's quota override, and main-live-Groq evidence were preserved. New code: resource discovery validation/request preparation, focused tests, default test-command registration. Windows/PowerShell, Node 24.19.0, Vitest 5.0.3. Synthetic context and `example.org` URLs; no database, HTTP, browser, LLM or native-search calls.

| Check | Actual result | Boundary |
| --- | --- | --- |
| Focused `tests/resource-discovery.test.ts` | Passed 24/24 | Request/pair validation only; mocked native-source records and research/verification metadata |
| TypeScript `tsc --noEmit` | Passed | Current working source |
| ESLint on two new source modules and focused test | Passed | Changed TypeScript files only |
| Full unit/integration/browser/build suites | Not run | No UI, database or existing adapter behavior changed in this slice |
| Live resource research, real page/relevance checks, native-tool cost/latency | Not run / configuration required | No claims of working live research or resource quality |

## Three actual examples

| ID / requirement | Preconditions and data | Actions | Expected | Actual |
| --- | --- | --- | --- | --- |
| RS-01 / US15, T15 | Synthetic selected QA/CI direction and topic; distinct documentation/tutorial results; matching fresh synthetic verifier records | Prepare the Groq request and validate the resource pair | Native search required; context contains only direction/topic fields; preserve both grounded URLs and explicit automatic-check status | Passed; request used required `browser_search`, no `response_format`; returned two exact fixture URLs and `professionalReview:null` |
| RS-03 / US15, T15 | Same fixtures; model selection supplies an invented resource ID, then an extra URL field | Validate each selection | Reject invented/extra fields rather than accepting hallucinated links | Passed; unknown ID rejected and strict schema rejected URL field |
| RS-07 / US15, T15 failure | Fresh pair fixtures with one unavailable, irrelevant, wrong-topic, wrong-URL, wrong-kind, stale or future-dated check | Validate each of seven invalid verification variants | Reject the whole pair and return no partial pair | Passed seven variants; no replacement/output persisted. This pure test does not verify database preservation or a browser fallback. |

Other executed cases screen unsupported schemes/credentials/IPs/internal hosts/ports without fetching them; reject duplicate fragment URLs, duplicate verifier records, undocumented official-source status and oversized result sets. RS-11 and RS-12 reject missing native-tool sources and a model URL not matching its cited provider source. All source records here are synthetic; the actual provider-source parser is not implemented. String screening is not a complete SSRF defence. The verifier implementation, controlled live dispatcher, persistence, UI recovery and transaction races remain unimplemented.

## Commands

The Node runtime was outside sandbox access; an initial automatic approval-review timed out, a retry succeeded, then checks ran through the installed pinned binary. No temporary runtime installation or dependency upgrade occurred.

```powershell
$taskNode = 'C:/Users/User/AppData/Local/Author Software/nvm/installs/v24.19.0/node.exe'
$env:TEMP = Join-Path (Get-Location) '.test-tools/tmp'
$env:TMP = $env:TEMP
& $taskNode node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/resource-discovery.test.ts
& $taskNode node_modules/typescript/bin/tsc --noEmit
& $taskNode node_modules/eslint/bin/eslint.js src/lib/resource-discovery.ts src/lib/groq-resource-research.ts tests/resource-discovery.test.ts
```

Groq capability reference checked through public documentation (no model request): https://console.groq.com/docs/tool-use/built-in-tools/browser-search. This documents the current model's native search and its incompatibility with strict structured output in the same call; it does not establish this account's free usage, billing, retention, bounded internal-tool usage or integration performance.
