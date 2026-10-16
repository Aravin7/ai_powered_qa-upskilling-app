# Historical document — superseded by the local Groq demo

The active Gemini adapter and setup command were removed on 11 October 2026 at the user's request. Use [GROQ-DEMO.md](GROQ-DEMO.md). The following record describes the previous implementation; do not use it to configure the current application.

## Gemini controls — former local synthetic pilot

The server workflow can select Gemini for CV extraction and roadmap generation. No live call has been made during this implementation. The running environment was not changed; it remains mock. Production rejects this synthetic pilot. An API key is insufficient to enable dispatch.

## Decisions still required

Aravin must approve a fixed model ID (no `latest` or preview alias), funded ceiling, expiry, responsible operator and provider privacy/retention disclosure. The pathway catalogue needs professional review and a matching version. Do not set `reviewed:true` merely to bypass the gate. Real participant admission, deployment and paid testing remain separately gated by the specification.

Verify model availability, full billable input limit, output limit (including thinking), pricing bands and any extra charges against [Google's API documentation](https://ai.google.dev/api/generate-content), [token documentation](https://ai.google.dev/gemini-api/docs/tokens) and [pricing](https://ai.google.dev/gemini-api/docs/pricing). Record the verification date and approved validity period. The template intentionally contains nulls; synthetic test prices/model IDs are not recommendations or verified provider facts.

## Private configuration

Copy `config/gemini-pilot.example.json` into ignored `private/gemini-pilot.json` and populate it only with approved facts:

- `model`, `catalogueVersion`: fixed model and professionally reviewed catalogue.
- `maxBillableInputTokens`: the verified full model maximum, including all billable input. Never infer a safe upper bound using characters divided by four.
- `maxOutputTokens`, `maxRequestBytes`: approved bounded response/request limits; bytes include schema and system instructions.
- `inputMicroUsdPerMillion`, `outputMicroUsdPerMillion`: conservative upper-bound rates in USD micro-units per million tokens, covering applicable pricing bands and thinking. One USD equals 1,000,000 micro-units. Zero/absent rates are rejected; free-tier availability is not a funding guarantee.
- `ceilingMicroUsd`: separately approved total ceiling. Reservations round up `(fullInputLimit × inputRate + maxOutputTokens × outputRate) / 1,000,000`. This intentionally over-reserves and is not a billing report.
- `pricingReference`, `pricingVerifiedAt`, `pricingValidUntil`, `expiresAt`: official pricing source and ISO UTC dates. Funding cannot outlast verified pricing.
- `approvedBy`, `approvalReference`, `privacyNotice`: actual operator/approval record and accurate provider-specific purpose, transmission, retention/deletion and limitation disclosure. No retention guarantee is invented by the application.
- `dataScope`: must remain `synthetic-only`. Operators must use synthetic inputs; the program cannot prove whether arbitrary PDF content is synthetic.

The adapter enables no tools, grounding, cache creation or SDK retries. Its pricing assumption is bounded text input/output; provider-specific billing/retention behavior still needs authorized live verification. Do not authorize a model whose charge behavior cannot be conservatively bounded by these fields.

After review and explicit live-test authorization, first set `AI_BUDGET_ID` to a new unique approved ID in ignored `.env`, keeping `AI_MODE=mock` during setup. Apply the migration and configure that new budget using the private file:

```powershell
npm run db:deploy
npm run ai:configure-gemini -- private/gemini-pilot.json
```

The setup command records configuration only and makes no provider call. It never resets balances or extends an existing expiry. Set the following server-only values in ignored `.env`, preserving unrelated settings:

```dotenv
AI_MODE=gemini
GEMINI_API_KEY=your-private-key
AI_SIGNING_SECRET=your-separate-random-secret-at-least-32-characters
AI_BUDGET_ID=your-approved-new-budget-id
```

Restart the local server and explicitly grant the new purpose-specific consent in Privacy & settings. Model, price, expiry or notice changes produce a new configuration/consent hash. Existing mock consent cannot authorize Gemini. Client state includes only the model/provider and disclosure, never the key or funding configuration.

To stop the selected budget without refunding dispatched work:

```powershell
npm run ai:configure-gemini -- --revoke
```

Revocation is shared through PostgreSQL and rechecked before reservation and activation. Use a new approved budget ID for changed/revoked configurations. In-flight old operations cannot activate under a different configuration. Failures preserve committed skills, active plans and progress; manual entry remains available. Five rolling-hour attempts across both features, one operation/user, two attempts total and the 45-second processing/activation deadline still apply.

## Automated evidence

`npm test` includes G-01–G-03 for strict configuration, conservative rounding and configuration/consent version changes. `npm run test:integration` requires a separate migrated `TEST_DATABASE_URL`; G-04–G-13 use the real database and service/REST adapter with intercepted HTTP responses. No real API key, Google OAuth or provider request is used. Existing browser tests use synthetic signed Auth.js sessions and mock AI; they do not validate Gemini UI or Google login.

| ID / requirement | Preconditions and actions | Observable expectation / evidence |
| --- | --- | --- |
| G-01 / R11 | Synthetic valid config; alias, missing approval, zero rate, unknown field, invalid date mutations | Reject each invalid config without defaults |
| G-02 / R11 | Synthetic upper-bound rates and full token limits | Integer reservation rounds up; fixture reserves 101 micro-units |
| G-03 / R03,R11 | Change model, price, notice or expiry | Configuration and consent hash change |
| G-04 / R03,R11 | Invited synthetic user; old consent, unreviewed catalogue, missing key, production mode | No dispatch or attempt; controlled rejection |
| G-05 / R04,R07,R11 | Current test-only disclosure/review; real synthetic PDF then roadmap | Candidate needs confirmation; valid plan saved; two shared reservations exist before HTTP; model provenance saved |
| G-06 / R07,R11 | Existing completed task; two invalid outputs then new-key valid response | Two failed reservations retained; old plan/progress preserved; recovery atomically replaces with unchecked tasks |
| G-07 / R11 | Second database client revokes budget during intercepted response | No late activation; dispatched reservation retained |
| G-08 / R11 | Two users/clients race for last reservation | Exactly one dispatch; ceiling never exceeded |
| G-09 / R03,R11 | Change stored disclosure/configuration | Old consent becomes false; no dispatch |
| G-10 / R04,R11 | Approved byte cap below full request size | Reject before reservation; zero provider calls |
| G-11 / R11 | Intercepted HTTP 401 | One call/attempt; no hidden retry or refund |
| G-12 / R06,R07,R11 | No gaps, old plan, revoked funding | No AI call/attempt; preserve plan |
| G-13 / R11 | Five operations across two database clients | Sixth rejected by shared user quota; exactly five calls |

Execution status: **Passed** for every G-01–G-13 case above on 11 October 2026, using synthetic configuration and intercepted provider responses. Executable assertions and synthetic fixtures are in `tests/gemini-controls.test.ts`, `tests/integration/gemini-controls.test.ts` and `tests/fixtures/gemini-pilot.ts`. The commands, environment, initial failures/corrections and three expected-versus-observed examples are recorded in `BUILD-STATUS.md`. The broader requirement-to-test matrix and coverage limitations remain in `QA-AUTOMATION-REPORT.md`; these additions do not establish complete coverage.
