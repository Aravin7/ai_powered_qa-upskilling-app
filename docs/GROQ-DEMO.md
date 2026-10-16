# Local Groq assignment demo

11 October 2026. Gemini was replaced as the live provider. The fixed model is `openai/gpt-oss-20b`, hosted by Groq. Google OAuth still handles sign-in and is independent of the AI provider. `/demo` remains browser-only mock data; use the authenticated `/` workspace for real AI.

## Setup

1. Create a key at [Groq Console](https://console.groq.com/keys). Keep the account on the **Free Plan** without upgrading or adding billing. Check the account tier yourself: this application cannot verify it through the inference API. A key alone does not establish free billing.
2. Keep your existing database, Google OAuth and signing secrets in the ignored local `.env`. Replace only the AI settings:

   ```dotenv
   AI_MODE=groq
   AI_BUDGET_ID=local-groq-demo-v1
   GROQ_API_KEY=your-key-from-groq-console
   GROQ_FREE_PLAN_CONFIRMED=true
   ```

   Keep `ENABLE_SYNTHETIC_PILOT=true` and the existing `AI_SIGNING_SECRET` (at least 32 characters). Delete the unused `GEMINI_API_KEY` line locally. Do not paste keys into chat, commit `.env`, or prefix keys with `NEXT_PUBLIC_`.
3. Apply the additive migration and create the shared allowance:

   ```powershell
   npm run db:deploy
   npm run ai:configure-groq
   npm run dev
   ```

   Stop/restart your existing dev process after editing `.env`. Migration preserves existing users, skills, plans, progress and historical budgets. The setup command makes no provider request and never resets an existing counter.
4. Sign into `http://localhost:3000/`. In Privacy & settings, enable each desired purpose under the new Groq notice. Old mock/Gemini consent cannot authorize Groq dispatch. Upload a **synthetic** PDF, review/confirm candidates, then generate a roadmap. Manual entry also works. Both extraction and generation consume requests; a normal two-feature journey uses at least two attempts.

## Demo boundaries

- Local only; production rejects Groq and mock configurations. Synthetic catalogue content remains `reviewed:false`; this specific local academic demo is permitted without claiming professional review. Real participant admission and production publication still require reviewed content and the other specification gates.
- The database reserves one `REQUESTS` unit before every attempt, shared across users/instances. Initial allowance: 20 attempts over seven days. This is a demo request ceiling, **not money or proof of the provider's billing tier**. Five attempts/user/rolling hour, one running operation/user, two attempts/operation and the 45-second deadline remain enforced. Uncertain attempts are not refunded. Revoke with `npm run ai:configure-groq -- --revoke`.
- Groq's own account/organization token and request limits also apply. HTTP 429 ends the operation with `PROVIDER_RATE_LIMIT`; there is no immediate automatic retry. Check your console limits and wait before a deliberate new-key retry. No SDK, hidden retry, tool or external search is enabled.
- Strict JSON schemas constrain output structure. Existing evidence and roadmap validators still reject unsupported claims, bad IDs, false effort/prerequisites or invalid plans. They currently require exact synthetic catalogue activities/outcomes/effort; semantic quality is not professionally assessed. Failed replacement keeps the previous plan/progress.
- CV files, full text, prompts and excerpts remain transient in this application. The notice states that Groq documents exceptional reliability/abuse retention up to 30 days unless Data Controls disable it; no ZDR setting is assumed or verified. Use synthetic data for this assignment.

## Verification

`npm test` exercises intercepted Groq HTTP and the existing PDF/validator suite. `npm run test:integration` requires a separate migrated `TEST_DATABASE_URL`; tests use real PostgreSQL and intercepted server fetch. Existing Playwright journeys use synthetic signed Auth.js sessions and mock AI. None proves real Google OAuth or live Groq behaviour. Current outcomes are in [BUILD-STATUS.md](BUILD-STATUS.md).

Optional live smoke: with `TEST_DATABASE_URL` pointing specifically to the migrated local `qa_groq_demo` database, set `RUN_LIVE_GROQ_TESTS=true` for that process and run `npm run test:live:groq`. This is disabled by default, requires the confirmed Free Plan/key, sends one synthetic CV operation and one roadmap operation (up to four accounted attempts including recovery), and uses synthetic identity rather than Google OAuth. It cleans up only its disposable learner and preserves consumed shared request totals. It does not change your `.env` or application database.

| Cases | Requirement | Observable checks |
|---|---|---|
| GR-01/02 | R03/R11 | Fixed model/free scope, strict config and version changes |
| GR-A1/A2 | R04/R07 | Strict request, known evidence, full validated roadmap, minimized provider payload |
| GR-A3/A4/A5 | R04/R07/R11 | No hidden retry, 401/429, refusal/truncation/malformed output, pre-dispatch limits/cancellation |
| GR-04/05 | R03/R04/R07/R11 | Current consent, local-only/free declaration/key; real PDF and saved plan with reservations |
| GR-06/07/08 | R07/R09/R11 | Failure preserves progress, revocation fences late commit, atomic shared ceiling across clients/users |
| GR-09/10/11 | R03/R04/R11 | Changed notice, rejected oversized input and non-retryable credentials |
| GR-12/13 | R06/R11 | No-gap bypass and five-attempt quota across clients |
| GR-14/15 | R03/R07/R09/R11 | Rate-limit recovery preserves progress; changed in-flight configuration rejects activation |

The existing broader QA matrix remains applicable. Live model availability/output, account tier, provider settings, production/deployment, broader devices/accessibility, network recovery, T13 evaluation, backup/deletion and professional content assessment remain separate evidence gaps.

Current unresolved defects observed during verification:

- **GR-DEF-01, configuration:** the saved credential produced HTTP 401 in a live synthetic extraction. Expected: Groq accepts a valid server key and returns evidence. Actual: one accounted request, controlled failure, no plan generation; safe HTTP status diagnostics expose no credential/error-body content. Replace the full Groq key before retrying. A passing intercepted 401 test verifies failure handling only.
- **GR-DEF-02, intermittent browser/API reliability:** the 11 October connected run returned `SERVICE_UNAVAILABLE` on valid upload. On 16 October, a new authenticated multipart HTTP regression and the complete browser journey both passed with real parsing and mock AI after test setup/synchronization corrections. The historical 503 did not reproduce; its root cause is still unconfirmed and is not claimed fixed. See `BUILD-STATUS.md` for exact results and earlier failed attempts. Failure artifacts are generated in ignored `test-results/` and may be replaced by later Playwright runs.

Official references checked 11 October 2026: [strict structured outputs](https://console.groq.com/docs/structured-outputs), [API reference](https://console.groq.com/docs/api-reference), [billing tiers](https://console.groq.com/docs/billing-faqs), [data controls/retention](https://console.groq.com/docs/your-data).
