# Live Groq smoke on merged main — 17 October 2026

## Environment

- Branch `main`, clean and up to date before the test; merge commit `535c74b`.
- Windows PowerShell, Node 24.19.0, Groq model configured by the application (`openai/gpt-oss-20b`).
- A dedicated local PostgreSQL 18.4 database, `qa_groq_demo`, with four migrations applied. The normal application database was not used.
- API key read by `dotenv/config` from ignored `.env`; key and provider response bodies were not printed or committed. Groq Free Plan confirmation was present in local configuration.
- Synthetic CV and disposable signed application identity. Provider was **live Groq**, not a mock. Google OAuth was not involved.
- No deployment. The test fixture was stopped afterwards; its allowance reservations are retained.

## Results

| Case | Expected | Observed | Status |
| --- | --- | --- | --- |
| GR-L1 extraction | Live provider returns three supported candidates from synthetic PDF; explicit confirmation persists them. | Groq returned the expected three skills and the confirmation saved three CV-origin entries. One request reserved. | **Passed** |
| GR-L2 roadmap | Live provider returns a valid roadmap; saved task completion survives reload. | Provider declared infeasibility despite the server's validated feasible schedule. The server rejected it and made one bounded correction attempt. The correction again failed validation; no roadmap was saved for this disposable learner. Two requests reserved. | **Failed** |

Command: `node --import tsx scripts/test-live-groq.ts`, with `TEST_DATABASE_URL` set to the isolated `qa_groq_demo` database and `RUN_LIVE_GROQ_TESTS=true`. Total reservations reported: **3**. The two-attempt operation limit was respected. No additional retry was made. Because the runner creates a new disposable learner, it did not verify preservation of a pre-existing active roadmap or its progress in this live run; those preservation behaviors have separate mocked PostgreSQL test evidence.

## Conclusion and next work

The merged live CV extraction path works for this one synthetic example. The live roadmap path did not produce a plan, so end-to-end live AI success is **not established**. The failed result is useful evidence of the bounded validation/correction fallback, but not proof of professional roadmap quality. Investigate why the selected model continues to claim infeasibility despite a validated schedule before authorizing another live attempt. Keep any rerun synthetic, use the same isolated database allowance or an explicitly approved new allowance, and account for provider usage. Do not infer Google sign-in behavior from this test.
