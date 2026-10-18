# Direction-rule compiler execution — 17 October 2026

Branch: `codex/qa-pathway-requirements-amendment`. Base commit: `535c74b327df9320486be781e256748a1542e77a`, with existing uncommitted source/docs/tests/migrations preserved. This slice changes the pure requirement module, draft schema value, focused tests and documentation; the tested working tree is not a new commit.

Environment: Windows PowerShell, Node 24.19.0, installed project TypeScript/ESLint/Vitest. Synthetic capability data and explicitly synthetic review metadata. No provider mock was dispatched, no live model or Google OAuth was exercised, and no database was accessed. Installed Node execution required sandbox escalation after an initial Access denied; that initial invocation did not execute tests.

## Commands and results

Run with the installed Node runtime available on PATH; this environment also set TEMP/TMP to ignored `.test-tools/tmp`:

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/requirements.test.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src/lib/requirements.ts src/lib/requirement-draft.ts tests/requirements.test.ts
git diff --check
```

- Focused tests: **Passed 34/34** (18 existing foundation tests plus 16 direction-rule variations), 2.45 seconds reported by Vitest.
- TypeScript: **Passed**, exit 0.
- Targeted ESLint: **Passed**, exit 0.
- Whitespace check: **Passed**; Git emitted existing LF/CRLF conversion notices.
- Full unit/integration/browser suites, production build, read-only validation CLI: **Not run** for this slice.
- Professional approval and trusted publication: **Blocked**, no real reviewer/rules approved. Actual draft remains `review:null`, `directionRules:[]`.

## Requirement-to-test mapping

| Cases | Requirement | Preconditions/data, action and observable expected result | Actual |
| --- | --- | --- | --- |
| DR-01 | R06/US06/US15 | Synthetic reviewed delivery/exploration rules share CI; compile both. CI is mandatory/important only in delivery, optional with optional prerequisites in exploration. | Passed |
| DR-02, DR-03 | R06 optional closure | CI mandatory, observability optional, load exclusive, design shared. Compile with/without observability deferral; exclusive work drops, shared design occurs once, retained dependencies precede topics. | Passed |
| DR-04 variations, DR-05, DR-06 | R06 validation | Attempt mandatory, implicit, unknown or still-needed optional deferrals. Compiler rejects each; no partial result or mutation. | Passed |
| DR-07 | R06/T12 version binding | Reorder rules/entries, then change a priority without new review digest. Reordering preserves ID; edit invalidates review. | Passed |
| DR-08, DR-09 variations | R06 server ownership/contracts | Unknown rule, duplicate deferrals, caller priority field, duplicate rule/entry and missing capability reference. Strict validation rejects each. | Passed |
| DR-10 | R06 inventory | Confirmed design/automation plus SQL; defer observability. Only CI is mandatory gap, SQL preserved, input objects unchanged. | Passed |
| DR-11 | R06 no-gap | Defer the sole optional root in exploration. Empty retained set, explicit deferred closure and no_gaps; pure function performs no dispatch or plan write. | Passed |
| DR-12 | R06/T12 review/evidence | Actual unreviewed draft rejects compilation. Synthetic inventory with old automation meaning requires reconfirmation, never a strength. | Passed |
| RQ-01–RQ-12 variations | R06/T06/T12 foundation | Existing structural, review, deterministic comparison, evidence/meaning and effort-boundary regressions. | Passed 18/18 |

## Three Week 3 examples

1. **DR-01 — context-specific priority:** expected CI mandatory for delivery but optional for exploration despite its global draft priority. Actual: both compiled outputs had the expected effective priority/mandatory flags. **Passed**.
2. **DR-02 — optional deferral:** expected deferred observability to remove exclusive load work while retaining shared design, automation and CI. Actual retained IDs: `design, automation, ci`; deferred IDs: `load, observability`. **Passed**.
3. **DR-07 — failure preservation:** expected a priority edit with stale review digest to fail rather than compile unchecked requirements. Actual: `CONTENT_REVIEW_REQUIRED` rejection matched the test assertion. **Passed rejection case**. This is pure validation evidence, not a database rollback or live-provider fallback test.

## Limits and next work

No UI changed, so no screenshots were generated. No application route uses the new compiler yet. Legacy helpers retain their synthetic global-priority behaviour for prior regressions and must not implement the amended selection workflow. Draft import immutability, full effort metadata, trusted publication, reviewed dynamic direction binding, legacy inventory reconciliation, frozen plan/resource activation and multi-instance transaction tests remain outstanding. No production/deployment compatibility or professional semantic quality is established by these results. Existing user quota override was not edited or tested. No credentials, paid requests, push, merge or deployment.
