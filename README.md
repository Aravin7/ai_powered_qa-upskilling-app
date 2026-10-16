# QA Pathway — Week 3 connected mock workflow

A Next.js application for the QA-to-AI-assisted-testing pilot. The connected workflow uses an explicitly labelled **local mock provider**. This is not a live AI integration or production release. See `docs/BUILD-STATUS.md` for current verification limits.

## Try the interface first

Install Node.js 24.19.0 (see `.nvmrc`). Then, from this folder:

```bash
npm ci
npm run dev
```

Open **http://localhost:3000/demo**. No Google credentials, database or API key is needed for this development-only demo.

1. Inspect Overview and open My skills.
2. Select skills or add a label, then click Confirm skills.
3. Open Privacy & settings and enable Learning roadmap generation.
4. Open Learning roadmap and click Create sample roadmap.
5. Complete an activity, reload, and verify that its saved check remains.
6. Change availability to one hour, try replacing the plan, and verify that failure preserves it.

The demo uses a synthetic person and unreviewed content. Its scheduler is deterministic, **not an LLM**. Confirmed demo data is saved only in this browser. Do not enter personal information. Clear it from Privacy & settings. Draft edits are not guaranteed after reload. `/demo` returns 404 in a production build, and it never bypasses the private API’s authentication.

## Connected workflow implemented

- Existing manual review, deterministic comparison, profile, consent and progress flows remain.
- Optional bounded PDF parsing, minimized text, strict mocked extraction output, temporary evidence review, signed candidate references and explicit confirmation.
- PostgreSQL operations with request binding/status, shared per-user lease, five reserved attempts per rolling hour, two attempts per operation and a 45-second deadline including activation.
- Shared mock funding reservations across users. Missing, expired or exhausted configuration prevents dispatch. Mock units are not money or an estimate of paid costs.
- Full roadmap schema/business validation, conservative synthetic activity/effort matching, atomic archive/replacement and unchecked new tasks. Failures leave the active plan and progress intact.
- Current consent, session, invitation, planning and catalogue checks before dispatch and activation. Logout and consent withdrawal fence pending work.

The live provider is now Groq (`openai/gpt-oss-20b`) for a local synthetic Free Plan assignment demo. Gemini dispatch was removed. Current consent, strict output validation and shared request limits remain; production rejects this demo and mock processing. See [Groq setup](docs/GROQ-DEMO.md). A key alone does not prove an account is on the Free Plan.

## Configure local Google + PostgreSQL testing

Use synthetic inputs until content/privacy admission gates are closed. The demo above is independent of this setup.

1. Start a local PostgreSQL service. With Docker installed:

   ```bash
   docker compose up -d db
   ```

   The compose database binds to localhost. Its documented password is for an isolated local development database only; replace credentials for any other environment.

2. Copy `.env.example` to `.env`. Set `DATABASE_URL` and `DIRECT_DATABASE_URL` to the local database. Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.
3. Create your own Google OAuth **web application** credentials. Configure the authorized redirect URI as `http://localhost:3000/api/auth/callback/google`. Add your Google account as an OAuth test user where required.
4. Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `NEXTAUTH_URL=http://localhost:3000` in `.env`. Set `ENABLE_SYNTHETIC_PILOT=true` for this local test. This flag cannot admit users in production.
5. Apply the checked-in migration and invite your email:

   ```bash
   npm run db:deploy
   npm run db:invite -- your-google-email@example.com
   npm run catalogue:validate
   npm run dev
   ```

6. Open **http://localhost:3000** and choose Continue with Google. Use the same hostname as `NEXTAUTH_URL`; mutations reject other origins.
7. For the connected mock workflow, set `AI_MODE=mock`, generate a separate `AI_SIGNING_SECRET` of at least 32 characters, and set `AI_BUDGET_ID=local-mock-v1`. Then run:

   ```bash
   npm run ai:configure-mock
   ```

   First creation reserves a ceiling of 100 **synthetic units** for seven days. Setup never resets an existing balance or extends its expiry. This is a test counter, not a funded paid pilot.

8. Save a profile with five hours/week. Enable the two purposes independently in Privacy & settings. On My skills, upload a synthetic readable PDF, review the temporary excerpts, remove incorrect candidates, then explicitly Confirm skills. Uploading alone never changes saved skills. Manual entry works without CV consent. The action to review entries as manual discards expired/unwanted origin references.
9. Open Learning roadmap and Generate mock roadmap. Complete an activity, reload, then try an invalid/infeasible replacement: the existing plan remains. Use Check last operation / recover saved plan after a lost roadmap response. Lost extraction evidence requires deliberate re-upload with a new key or manual entry.
10. CV limits for local synthetic testing: 2 MiB, 10 pages, 20,000 extracted characters, 40 candidates, 400-character excerpts. Parser runs in a disposable Node process with a 64 MiB V8 heap ceiling and eight-second timeout; this is **not a measured native-memory/RSS guarantee**. No OCR or URL imports. Native process and deployment limits require verification before real uploads.
11. New CV origin references expire after 15 minutes and bind owner/session/consent and exact candidate content. File fingerprints are keyed metadata; no PDF/text/excerpt/prompt is persisted. Local operation/fingerprint/consent metadata remains until account deletion; participant retention, backups and provider schedules are still unresolved.
12. Revoke an invitation with:

   ```bash
   npm run db:invite -- your-google-email@example.com --revoke
   ```

The next private request rejects the old session. Changing a Google email or attaching a different Google subject requires operator review. No password or assessor bypass exists. Successful Google OAuth has not been exercised with a real account in the development workspace.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run catalogue:validate
npm run build
```

Browser tests:

```bash
npx playwright install chromium
npm run test:e2e
```

The default browser suite uses the synthetic development demo. The connected browser case is explicitly skipped unless enabled as below. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an already-installed compatible Chromium. A local dev server is started automatically if necessary.

Database tests require a **separate migrated PostgreSQL database**. Migrate it by temporarily pointing `DATABASE_URL` and `DIRECT_DATABASE_URL` to that isolated database, then set `TEST_DATABASE_URL` and run:

```bash
npm run test:integration
```

For the authenticated connected browser test, use a **separate migrated** database and a free local port. PowerShell:

```powershell
$env:TEST_DATABASE_URL="postgresql://YOUR_LOCAL_TEST_DATABASE"
$env:RUN_AUTHENTICATED_E2E="true"
$env:E2E_PORT="31347" # any free local port; keeps an existing app server untouched
npm run test:e2e
```

The test runner creates temporary secrets, synthetic invited records, mock budget and an Auth.js-signed test session. It starts its own dev server against the test database in an ignored `.next-e2e` directory, exercises the real private API, and cleans its fixture records. This **does not verify Google OAuth success**. Do not point it at a valued application database. The expanded scenario matrix and observed defects are in `docs/QA-AUTOMATION-REPORT.md`. The corrected name-redaction regressions are included in `npm test`; its single worker avoids overlapping real parser processes while preserving application deadlines.

The integration command deliberately fails with `BLOCKED` if `TEST_DATABASE_URL` is missing. It never silently substitutes the application database. Tests create unique synthetic identities and clean up only their own records. See `docs/BUILD-STATUS.md` for observed results and limitations.

With the authenticated test environment above enabled, run `npm run test:e2e -- tests/e2e/cv-upload-api.spec.ts` for the request-only multipart/real-parser regression, and `npm run test:e2e -- tests/e2e/connected.spec.ts` for the full browser journey. Both use mock AI. The runner checks `/api/auth/providers` for readiness with a three-minute cold-start allowance; browser-page compilation is warmed separately before the timed connected journey. No Google OAuth or external AI request is made by these tests.

`npm run db:migrate` creates development migrations; `npm run db:deploy` applies committed migrations. Review migrations before using them on a valued database. `npm run catalogue:validate -- --production` rejects the synthetic catalogue.

## Build and source layout

- `src/app`: Next.js pages, private API and Auth.js routes.
- `src/components`: interface and browser demo; no authentication bypass.
- `src/lib/domain.ts`: shared validation and deterministic rules.
- `src/lib/store.ts`: PostgreSQL access, ownership and transaction logic.
- `src/lib/catalogue.ts`: clearly labelled synthetic fixture.
- `prisma`: schema, checked-in migration and database invariants.
- `tests`: unit, PostgreSQL integration and Playwright checks.
- `specs.md`: target requirements; `docs/BUILD-STATUS.md`: what is implemented today.
- `AGENTS.md`: concise implementation instructions for Codex.

Versions are pinned in `package.json` and `package-lock.json`: Next.js 16.3.8, React 19.3.0, NextAuth 4.24.15, Prisma CLI/client 7.10.0, pdf-parse 2.4.5 and Node.js 24.19.0. Next ESLint config is aligned to 16.3.8. UI uses semantic React and a small CSS stylesheet instead of adding Tailwind/shadcn to this slice. This implementation refinement is recorded in the decision log.

## Put the project in GitHub

Create a private repository and commit this folder’s source. Include the lockfile, migrations, tests, docs and `.env.example`. `.gitignore` excludes secrets, build output, generated client, node_modules, logs and test artifacts. Inspect staged files before pushing. Never commit actual keys, real CVs or a populated `.env`.

## Next implementation milestone

The current local Groq and mock verification is recorded in `docs/BUILD-STATUS.md`. Configure the Free Plan demo with `docs/GROQ-DEMO.md`. The supplied catalogue remains synthetic and unreviewed; only local synthetic demonstration is permitted. One authorized live synthetic extraction and roadmap rerun passed on 17 October 2026; intercepted tests and that single live sample do not establish repeatable AI quality or real Google OAuth.

IT6070 still needs real professional/problem evidence, actual connected AI tests, costs/adoption, the four-page evidence PDF, an accessible repository and the narrated demo. Record this build and subsequent corrections in the AI-use declaration. See the specification for the weekly checkpoints.
