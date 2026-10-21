# QA Pathway — Week 3 connected mock workflow

Native browser research now defaults to a maximum of **six reported browser actions per topic**. Existing stored workflow configurations explicitly set to two must be updated to `maxReportedToolCalls:6` through `npm run ai:configure-groq -- --workflow-config <approved-local-json>`; preserve the other approval/notice fields. This changes configuration/consent binding without resetting funding counters or expiry. The user's five API attempts per rolling hour remain unchanged. Live diagnosis identified a parser mismatch for browser.open within the six-action bound. The compatibility fix passed mocked checks; a successful live resource pair remains unverified.

**Latest live check - 21 October 2026:** the final authorised resource-only diagnostic returned **PROVIDER_TIMEOUT**, confirming the application attempt timer expired before a usable response in this run. Isolated usage is **15/15**; previous plans/progress were preserved. No resource pair or new roadmap was saved. Earlier generic failures cannot be retrospectively classified. See docs/BUILD-STATUS.md.

The product recommends external learning materials and practical activities; learners complete them outside the app and record progress here. Bundled teaching exercises, answer keys, scorers and load-test runners are outside this MVP. Application tests still cover the two AI workflows and their safeguards.

A Next.js application for the QA-to-AI-assisted-testing pilot. The connected workflow supports explicitly labelled local mock processing and the configured Groq synthetic demo. See `docs/BUILD-STATUS.md` for current verification limits; this is not a production release.

**Approved target requirements (17 October 2026):** Feature 1 extracts and confirms professional CV skills after local minimization. Feature 2 explores learner-relevant QA directions from reviewed capability data, calculates gaps for a selected direction and generates a resource-backed roadmap. Resources are researched dynamically by an LLM with provider-hosted web access, with one official documentation page and one supporting lesson/video per topic. Existing resource lists are examples, not a fixed limit. The app supports saved provisional exploration plus reviewed direction selection/comparison, mocked topic-resource research and atomic mock roadmap activation. Actual draft content is unapproved; live suggestions and live resource research remain gated. See `specs.md` v1.2 and `docs/BUILD-STATUS.md`.

The connected Groq adapter now implements native `browser_search` source parsing, independently retrieved page evidence, structured resource selection and reviewed roadmap scheduling. Search and selection are separate reserved attempts; there is no third correction. Each topic saves one official documentation page and one supporting lesson/tutorial/video, then freezes them into a validated plan. Page checks use public-IP-pinned HTTPS, bounded redirects/body/time, reviewed topic terms and quoted evidence. Unusable extra candidates are excluded when a valid pair remains. Access/prerequisite passages and uncertainty are retained. Automatic checks are not professional relevance review. These paths have local mocked/intercepted evidence, **not a successful live connected-workflow test**. No separate browser-search API account is needed.

Live activation remains blocked until the exact current requirement version is professionally approved and native-tool usage/cost/privacy terms are verified. The local-only adapter requires an approved configuration with an exact notice digest; an API key alone cannot enable it. Provider-managed tool calls have no hard orchestration cap: reported tool counts are checked after the response. Do not treat that check or a configuration flag as proof of zero charges. Paid fallback and production Groq processing remain disabled.

The existing `test:live:groq` command verifies the older CV/sample-roadmap path, not this new reviewed-direction/native-resource workflow. The original preparation procedure and activation dependencies are documented in [the current evidence record](docs/evidence/2026-10-19-connected-workflow/README.md); the subsequent authorized attempt is reported below.

**Live test update, 19 October:** the user authorized the synthetic resource journey. The opt-in `scripts/test-live-reviewed-workflow.ts` ran against a separate local database with a preserved five-attempt aggregate allowance. It failed during native research (HTTP 400 initially; HTTP 200 followed by validation/provider failures after removing an optional citation setting). No new resource pair or roadmap was activated; preservation checks Passed. See [the live execution record](docs/evidence/2026-10-19-connected-workflow/live-execution.md). Earlier mocked/browser results are not live success. The allowance is exhausted; the script never resets it or automatically enables further requests.

The next content-review draft is [QA requirements review](docs/qa-requirements-review.md). `npm run requirements:validate` checks fourteen proposed capabilities and prints the draft digest; `npm run requirements:validate -- --reviewed` currently denies use because approval of this exact draft version is unverified. Versioned-requirement/gap helpers are connected to private selection and mock roadmap routes. The existing provisional-direction block remains. Reading the source references is not professional review, and a matching digest is not proof of reviewer identity or permission.

## Try the interface first

The pure requirement module now also supports reviewed direction-specific priorities and explicit optional deferral. `compileDirectionRequirements`/`compareDirectionRequirements` validate selected rule IDs, shared prerequisites and digest-bound priority data. Legacy synthetic helpers remain separate. No direction rule is approved in the actual draft. The helpers are connected to the private flow; synthetic reviewed fixtures verify the integration in the isolated test database.

Server services support registering immutable reviewed requirement snapshots. Registration and activation are trusted operator actions with no learner endpoint; the review evidence reference must be checked independently. The signed-in **My skills** page now offers a reviewed mapping panel only when a registered version has been activated. It presents the capability meaning for explicit confirmation, preserves the learner's saved skill label/source and explains when no mapping is available. The private API rechecks invitation/session, active version, signed 15-minute review reference and planning revision on save. The actual draft remains unapproved and inactive; only synthetic versions were activated in the isolated test database. The Explore directions screen now saves a reviewed rule plus explicit optional deferrals and displays its deterministic comparison. Changed requirement versions require reselection; changed skill meanings require review. Local mock planning compiles reviewed setup, study and practice activities, binds synthetic resource pairs and atomically activates validated plans. Live resource-backed generation remains disabled. A no-gap request makes no provider call and preserves the plan.

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

The unapproved requirement draft is now `qa-capabilities-draft-v4`, with explicit inclusion/exclusion boundaries, starting knowledge, prerequisite rationale and effort breakdowns in `src/lib/requirement-content-draft.ts`. `npm run requirements:validate` reports structural completeness; `-- --reviewed` still rejects it. New registration/activation cannot accept incomplete metadata, and shared setup has one workload cost. See `docs/qa-requirements-review.md` for the concrete proposals requiring professional correction/approval. This draft cannot be activated without verified review. Synthetic reviewed fixtures exercise mock planning; live research remains disabled.

On `codex/qa-pathway-requirements-amendment`, the signed-in workspace also has **Explore directions**: persist interests/work/coding preferences, request local mock capability combinations, see three suggestions initially and explore more, and save/clear a provisional direction of interest. Reload restores committed choices. Changed profile/inventory/preferences invalidate stale suggestions. These examples are not live AI recommendations or reviewed requirement sets. A selected provisional direction blocks authoritative gaps/new generation, preserving the existing plan and progress. This is an additional step within Feature 2, not a third learner-facing AI feature.

Apply the seven new migrations (`202610170001`–`202610170005`, `202610180001` and `202610180002`) to your intended local database with `npm run db:deploy` before using this source. The fourth adds immutable requirement snapshots and owned capability confirmations; the fifth adds the single active-version pointer and the sixth stores the reviewed learner direction binding, and the seventh adds its resource snapshots. Only isolated test databases were migrated during development (latest: `qa_pathways_workflow_20261019` on localhost port 55471); the application database was not migrated. In local `AI_MODE=mock`, renew roadmap consent for notice `development-mock-disclosure-v4`. In Groq mode the new suggestion/research actions are disabled until reviewed capability data, native-tool usage bounds and updated approved disclosure/configuration are available; existing Groq CV/sample-roadmap behavior is preserved. No model change, credential change or live call is required for the mock slice.

After saving a provisional direction, expand a topic under **Explore topic resources** and select **Preview mock resources**. This tests two separately accounted server-provider phases and saved-pair recovery after reload. The displayed `example.org` source records are synthetic placeholders, not usable learning links, real web research or professional review. A failed request preserves the earlier pair and active plan. Direction/input changes hide outdated pairs; preference changes clear them. Live LLM-native search and independent page-check code is implemented behind approval gates, with mocked HTTP/DNS evidence only. Mock reviewed-direction plans now freeze their resource snapshots.

For an operator-activated **synthetic reviewed** test version, save a reviewed direction in Explore directions, research each retained topic with its **Research mock resources** button, then open Learning roadmap and generate. Empty inventory requires acknowledgment. Each topic uses two provider attempts; planning normally uses one (a correction can use a second). The shared five-attempt/hour limit can therefore require waiting between topics for larger directions; the app does not bypass it. Missing resources or invalid/stale output preserve the existing plan. Placeholder resources remain clearly labelled and are not clickable learning recommendations.

- Existing manual review, deterministic comparison, profile, consent and progress flows remain.
- Optional bounded PDF parsing, minimized text, strict mocked extraction output, temporary evidence review, signed candidate references and explicit confirmation.
- PostgreSQL operations with request binding/status, shared per-user lease, five reserved attempts per rolling hour, two attempts per operation and a 45-second deadline including activation.
  The temporary ten-attempt test override was restored to the approved five-attempt limit in `src/lib/ai-operations.ts`; shared resource/roadmap and CV/roadmap regression cases verify the sixth dispatch is denied.
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

For the reviewed direction/resource/plan slice specifically, use the same isolated environment and run:

```powershell
$env:E2E_EVIDENCE_DIR="docs/evidence/2026-10-19-connected-workflow"
npm run test:e2e -- tests/e2e/reviewed-roadmap.spec.ts tests/e2e/resource-links.spec.ts
```

These checks cover reviewed direction selection, missing-resource fallback, lost-response recovery, atomic plan replacement, external-link rendering and saved completion after reload. The link-rendering case seeds synthetic researched-resource metadata; it does not prove live search or real page access. Screenshots are saved under the evidence directory. The Groq-mode service cases in `tests/integration/connected-groq-workflow.test.ts` use real isolated PostgreSQL with intercepted provider HTTP, DNS and page fixtures.

The existing Groq configuration command configures only the local synthetic allowance. A future `npm run ai:configure-groq -- --workflow-config <approved-local-json>` additionally accepts the exact approved privacy notice and `workflowApprovalSchema` fields defined in `src/lib/ai-execution.ts`. That JSON must reference verified provider usage/privacy terms, zero-charge native-tool eligibility and the exact notice SHA-256. Do not copy the synthetic test approval as real approval. This implementation did not run the command on the application database. Applying it changes the configuration/consent version without resetting counters or expiry; learners must renew purpose-specific consent. Keep live dispatch disabled until the external gates are actually resolved.

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
