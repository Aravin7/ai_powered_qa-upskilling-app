# QA Pathway — first working build

A Next.js application for the QA-to-AI-assisted-testing pilot. This is an **initial implementation**, not the complete MVP or a production release.

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

## What works

- Responsive overview, profile, manual skill review, deterministic gap comparison and privacy screens.
- Strict validation; confirmed profile and inventory persistence; explicit removals; reviewed-alias normalization with Unicode case folding; unmatched labels preserved separately.
- Google-only authentication code with verified email, stable provider subject and operator-owned invitation checks.
- PostgreSQL profile, inventory, consent, roadmap/task models and migration constraints.
- Revision-checked writes, task ownership checks, invitation revocation and application-record deletion.
- Development demo: validated sample roadmap, progress/undo, outdated-plan indication, explicit replacement with archived history and reset progress.

## What is not implemented or enabled yet

- PDF parsing and CV skill extraction, transient origin tokens and model validation.
- Live OpenAI roadmap generation, provider adapter and real output evaluation.
- Shared AI attempt quotas, funded reservations, idempotent operations, deadline fencing and transactional live-plan activation.
- Reviewed catalogue publication, frozen catalogue lookup and unavailable-resource workflow.
- Retention cleanup/backup restore handling, external provider erasure verification, research event collection and production admission.

AI routes fail closed; they do not send a paid request. Supplying an API key alone will not enable them. No deployment or GitHub push was performed. The app does not yet fulfill the assignment’s two connected live AI feature requirement.

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
7. Save profile, confirm skills and inspect comparison. These steps use PostgreSQL, unlike the browser-only demo.
8. Revoke an invitation with:

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

The browser suite uses the synthetic development demo. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when using an already-installed compatible Chromium. A local dev server is started automatically if necessary.

Database tests require a **separate migrated PostgreSQL database**. Migrate it by temporarily pointing `DATABASE_URL` and `DIRECT_DATABASE_URL` to that isolated database, then set `TEST_DATABASE_URL` and run:

```bash
npm run test:integration
```

The integration command deliberately fails with `BLOCKED` if `TEST_DATABASE_URL` is missing. It never silently substitutes the application database. Tests create unique synthetic identities and clean up only their own records. See `docs/BUILD-STATUS.md` for observed results and limitations.

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

Versions are pinned in `package.json` and `package-lock.json`: Next.js 16.3.8, React 19.3.0, NextAuth 4.24.15, Prisma 7.10.0 and Node.js 24.19.0. UI uses semantic React and a small CSS stylesheet instead of adding Tailwind/shadcn to this slice. This implementation refinement is recorded in the decision log.

## Put the project in GitHub

Create a private repository and commit this folder’s source. Include the lockfile, migrations, tests, docs and `.env.example`. `.gitignore` excludes secrets, build output, generated client, node_modules, logs and test artifacts. Inspect staged files before pushing. Never commit actual keys, real CVs or a populated `.env`.

## Next implementation milestone

Implement transient PDF extraction and the live AI operation layer from `specs.md`, with database quotas/funding/fencing and failure tests before any paid dispatch. Continue with atomic live-plan activation. Provider credentials/model, funded limits, reviewed content, operator ownership and retention disclosures remain required facts. Do not convert the synthetic scheduler into claimed live AI evidence.

IT6070 still needs real professional/problem evidence, actual connected AI tests, costs/adoption, the four-page evidence PDF, an accessible repository and the narrated demo. Record this build and subsequent corrections in the AI-use declaration. See the specification for the weekly checkpoints.
