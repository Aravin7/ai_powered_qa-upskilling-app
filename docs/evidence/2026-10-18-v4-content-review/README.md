# Content review trail — 18 October 2026

## Status and evidence limits

Aravin reported in this session that Tharindu Perera supplied and approved the sixteen amendments below. The recorded v3 content digest is `8a9e457309ffbda0fdca1c8e5181df248dac92c1c3ec7b0c96cc54354a2d4a38`. This is a transcription of the user-provided amendment list, not an independently received reviewer signature or dated written confirmation. The earlier reported date alone did not identify the reviewed document. Do not backdate a confirmation or imply it covers later v4 changes.

A new user-supplied review of the v4 packet requested priority inheritance, revised evaluation prerequisites, mandatory performance work, clearer versioning/CI simulation, coverage decisions and pilot evidence. Its author/approval was not independently authenticated. Applying those requested corrections does not constitute reviewer approval. Current v4 remains `review:null` and inactive. Exact v4 digest is maintained in `../../qa-requirements-review.md`.

## Sixteen reported v3 amendment points

1. State a programming and Git baseline or add a capability: automation, CI, load testing and scripted evaluation depend on it.
2. Add automation to scripted `llm-evaluation` or restate it as a rubric/spreadsheet exercise; add `llm-evaluation` to AI security and observability where evaluation signals remain; describe API testing as harness structure, not live calls.
3. Make load testing Nice generally or Important only in a relevant delivery direction; publish priorities per direction.
4. Assign prompt injection to AI security only. Responsible AI covers privacy, bias, transparency and human oversight.
5. Rename `ai-evaluation` to `generated-test-review` to distinguish it from GenAI response evaluation.
6. For automation, deliberately break behavior, confirm the test fails and repeat runs to inspect flakiness.
7. Use Playwright request API status/body assertions and distinguish 401 from 403.
8. Seed generated tests with known defects, including tautologies, invented selectors and missing negative cases, with an answer key.
9. Supply 10–12 saved evaluation cases, one 3–4-criterion rubric and a simple scorer to demonstrate automated-judgment limits.
10. Permit an optional learner-owned external AI chat tool for prompt variability, or acknowledge that the node cannot show live non-determinism.
11. Permit an optional free hosted account for CI/delivery gates or label the outcome local simulation.
12. Supply labeled retrieval corpus documents, chunks and answers.
13. State the automation coding baseline or substantially increase the optimistic 180-minute estimate.
14. Raise delivery-gate practice beyond 65 minutes, to a total around 180–210 minutes.
15. Use distinct setup IDs for Playwright, k6 and CI; share IDs only for genuinely identical setup.
16. Confirm tight prompt/security/retrieval/load estimates only with supplied fixtures; local load timings are machine-noisy.

The current v4 revision removes the Playwright prerequisite from the supplied-scorer exercise because its scripted baseline is explicit; that later decision does not rewrite the historical v3 report.

## Required genuine confirmation — PENDING

A reviewer confirmation must identify the reviewer (agreed name/pseudonym), actual review date, exact document/library digest and fixture revision/commit, scope reviewed (including priorities, prerequisite closure, meanings, effort and answer keys), corrections/limits and explicit disposition. Store a consented written confirmation or an evidence reference here after receipt. No confirmation text or signature is fabricated in this record.

## Publication gate — BLOCKED

Record at least one timed participant pilot per exercise, including starting knowledge, phase times and blockers. Four fixture groups are drafted; prompt/security/bias exercise content remains incomplete. Use `../../fixtures/qa-capability-v4/pilot-record.md`. Professional content review and completed pilots are required before v4 publication; developer tests alone cannot satisfy them.
