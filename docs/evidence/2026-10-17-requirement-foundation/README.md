# Requirement-library foundation — 17 October 2026

Branch `codex/qa-pathway-requirements-amendment`; base commit `535c74b327df9320486be781e256748a1542e77a` plus uncommitted changes. Existing source, evidence and user quota override were preserved. New files are the requirement validator/comparison module, fourteen-capability review draft, read-only validation script, focused tests and review packet. Updated current contracts, decisions, setup and build status. No private application route/UI, database schema, provider configuration, active plan or confirmed inventory was changed by this slice.

Environment: Windows/PowerShell, Node 24.19.0, Vitest 5.0.3, TypeScript 6.0.3 and ESLint 9.39.5. Inputs are synthetic; review metadata in positive tests is explicitly labelled synthetic. No database, browser, model or page-fetch request occurs in these tests. Six public documentation sources were separately opened to prepare the draft; links and limitations are in [the review packet](../../qa-requirements-review.md). This is manual source inspection, not application-native web research, source-verifier integration or professional review.

## Actual execution

| Check | Expected | Actual / status |
| --- | --- | --- |
| `tests/requirements.test.ts` | Strict validation, deterministic closure/comparison, review binding, changed-meaning reconfirmation and preservation of unrelated skills | **Passed 18/18**, one file, 3.38 seconds |
| `tsc --noEmit` | Current source type checks | **Passed** |
| Targeted ESLint, two new modules/script/test | No lint errors | **Passed** |
| Draft validation command | Structurally valid fourteen-node draft, reviewed=false, digest printed; no writes | **Passed**, exit 0 |
| `--reviewed` command | Refuse the actual unreviewed draft | **Blocked as intended**, CONTENT_REVIEW_REQUIRED, exit 1; not a successful professional review |
| `git diff --check` | No whitespace errors | **Passed** |
| Full unit/database/browser suites or build | Not required to validate an unconnected pure module | **Not run for this slice**; previous slice's results are not new execution evidence |
| Real review, publication, legacy meaning migration and private selected-direction integration | Actual named review/trusted publication and integration required | **Blocked / not implemented** |

Observed draft digest: `9cd8aafe47946a2434b41d3fbbe49c44de1bbf689320dd702bd2d896b734a0e1`. A digest binds exact content; it is not a signature, reviewer authentication or proof of permission. The draft's review remains null. No public endpoint accepts a caller-supplied library/review.

## Three expected-versus-observed examples

| Scenario / requirement | Preconditions and actions | Expected | Observed |
| --- | --- | --- | --- |
| RQ-04 / R06, T06 | Synthetic reviewed four-capability library. Select CI and observability in both orders; compile dependencies | Same set ID and prerequisite order; a nice prerequisite of mandatory work stays mandatory | **Passed**: design → automation → CI → observability; design retains nice priority but mandatory=true; observability remains optional |
| RQ-06 / R06, T12 | Synthetic requirement changes automation meaning to v2; fixture confirmation still has v1; compare selected CI | Old evidence cannot silently count under new meaning | **Passed**: automation marked reconfirmation_required; automation and CI remain mandatory gaps |
| RQ-01 / T12, T15, failure gate | Actual fourteen-node draft has review=null; attempt authoritative comparison | Reject before returning authoritative gaps; do not fabricate review | **Passed rejection**: CONTENT_REVIEW_REQUIRED. CLI independently returned exit 1. No database/plan transaction was exercised or claimed |

## Requirement-to-test mapping and boundaries

| Cases | Contract / test data and observable behavior |
| --- | --- |
| RQ-01 | Real draft structural validation and unreviewed-use denial |
| RQ-02, five separately executed variations | Reject cycle, missing prerequisite, missing source, duplicate capability ID and duplicate source ID |
| RQ-03 | Equivalent content order keeps digest; changed effort invalidates previous review binding |
| RQ-04 | Arbitrary capability combination/prerequisite closure; no fixed career-path menu; mandatory dependency handling |
| RQ-05 | Same confirmed evidence in different input order yields identical output; confirmed evidence is labelled self-report |
| RQ-06 | Explicit meaning-version change causes reconfirmation; this is not automatic semantic-change detection |
| RQ-07 | No-gap result preserves unrelated SQL entry and does not mutate input; pure code makes no AI call |
| RQ-08 | Empty evidence is not established; mandatory versus optional gaps separate |
| RQ-09 | Text/alias alone does not silently establish a canonical match; C, C++ and C# remain distinct |
| RQ-10 | Future review denied; unknown legacy meaning version requires reconfirmation |
| RQ-11 | Duplicate canonical evidence, caller-priority override and unknown/duplicate selected IDs rejected |
| RQ-12, three variations | Effort 0, fractional or numeric-string values rejected without clamping/coercion |

No existing application defect was diagnosed or fixed in this pure slice. Source relevance, complete curriculum/alias meaning, realistic effort, semantic version assignment and professional usefulness still need a reviewer. The script does not publish, authenticate reviewers, enforce immutable historical versions against a database or increment catalogue/planning revisions. Existing skills do not yet store this new meaning provenance; the app must not fabricate it during future integration. Actual selected-direction activation, no-gap dispatch bypass in that route, versioned plan snapshots and publication races remain unimplemented. Existing provisional-direction denial stays active. Live LLM search, provider funding/retention approval and real page verification also remain unresolved.

## Commands executed

```powershell
$taskNode = 'C:/Users/User/AppData/Local/Author Software/nvm/installs/v24.19.0/node.exe'
$env:TEMP = Join-Path (Get-Location) '.test-tools/tmp'
$env:TMP = $env:TEMP
& $taskNode node_modules/typescript/bin/tsc --noEmit
& $taskNode node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/requirements.test.ts
& $taskNode node_modules/eslint/bin/eslint.js src/lib/requirements.ts src/lib/requirement-draft.ts scripts/validate-requirements.ts tests/requirements.test.ts
& $taskNode --import tsx scripts/validate-requirements.ts
& $taskNode --import tsx scripts/validate-requirements.ts --reviewed # expected exit 1
git diff --check
```

The default `npm test` command now includes this file for subsequent full runs; no 162-test full-suite pass is claimed here. No screenshot was generated because no interface changed. No live AI, credential change, migration, deployment, commit, push or merge occurred.
