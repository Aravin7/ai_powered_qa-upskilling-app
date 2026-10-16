# Decision Log

3 October 2026 · Current behavior is in `../specs.md`; this file records provenance and rationale. A historical entry never overrides current requirements.

## PDF regression setup — 16 October 2026

- Investigated the historical browser upload 503 on `codex/fix-pdf-upload` from merged main `31fe9e5`. Authenticated real-parser HTTP and complete browser journeys passed with synthetic data and mock AI; the historical intermittent error did not reproduce, so no application root-cause correction is claimed.
- Separate server readiness/compilation from learner-operation timing: use the small Auth.js providers endpoint, a bounded three-minute cold-start allowance, and explicit landing-page warmup. Wait for actual consent responses before asserting UI persistence. These are test setup/synchronization changes; application deadlines, retries, validation, quota and funding controls are unchanged.
- Added an independent request-only multipart regression to distinguish server-route/parser behavior from Chromium and frontend timing. It checks real parsing, unchanged committed inventory, malformed recovery and attempt accounting. Temporary diagnostics were removed; no persistent CV/content logging was added.

## Groq replacement for the local assignment demo — 11 October 2026

- User selected Groq Free Plan with `openai/gpt-oss-20b` and requested Gemini removal. Active Gemini code, setup command and configuration template are removed; applied migrations and historical evidence remain to preserve database history.
- Reuse database leases, quota, configuration-bound consent, two-attempt recovery, deadlines and atomic replacement. A free-demo request counter replaces paid monetary reservations: 20 attempts/seven days initially, shared across users; no counter reset or automatic refund. Groq's account tier cannot be verified by the inference API, so configuration explicitly requires operator Free Plan confirmation. No paid adapter/fallback is present.
- The authorized academic demo uses synthetic inputs and the existing visibly unreviewed catalogue locally. This scoped exception does not approve real participants, catalogue publication or production admission. Authentication, ownership, transient processing, output validation and purpose consent remain; removing those would not solve the billing obstacle.
- Direct Groq REST uses strict JSON schemas, no tools/SDK retries, low reasoning effort and bounded completion/request sizes. Rate-limit responses stop for deliberate recovery rather than immediately consuming another attempt. Official structured-output, API, billing and data-control documentation was checked on 11 October 2026; account settings/live quality require actual evidence.

## Historical Gemini dispatch controls — 11 October 2026

- User requested a new branch and completion of Gemini controls; created `codex/gemini-dispatch-controls` from merged main `2f86215`. Live test spending and provider privacy terms remain unapproved; no running environment or actual provider settings were changed.
- Connected server adapter selection to a strict private configuration and reviewed-catalogue gate. Synthetic Gemini mode is local only. Fixed model, verified prices, validity period, funding ceiling and accurate disclosure are operator-supplied facts, not defaults. Incomplete example configuration fails closed.
- Reserve USD micro-units using the verified full model input maximum plus bounded output at conservative upper-band prices. Approximate characters/token heuristics cannot prove a safe financial bound. This over-reserves, may limit usefulness and does not claim actual billed cost; no automatic reconciliation/refund is implemented.
- Configuration hash also versions purpose-specific consent and operations. Model, pricing, expiry or notice changes require new consent and prevent stale activation. Shared budget revocation is rechecked under a database lock at dispatch and commit. Existing one-operation, shared quota, retry, deadline and atomic replacement invariants remain.
- Direct REST GenerateContent structured output was checked against current official Google documentation. Transport, billing assumptions and semantic quality still require separately authorized live evidence. Tests use synthetic prices, test-local review state and intercepted HTTP; these are not provider or professional approvals.
- Integration runner timeout is 15 seconds to accommodate the unchanged eight-second real parser deadline plus database work. Application deadlines and assertion behavior were not relaxed, and no blanket retries were added.

## Approved product decisions

- Five MVP recommendations were applied following Aravin's “fix it”; G1–G10 defaults were approved by “ok.”
- “fixs those gaps” authorized the A1–A6/B1–B11/C1–C5 amendments represented in handoff 1.1 and carried into specs.
- Invited Google-only QA pilot; one pathway/no role switching; optional CV/manual review; deterministic comparison; two AI operations; activity tracking; explicit safe replacement; consent/deletion; bounded use and external practical-assessment boundary.
- Numeric baseline: integer 1–40 hours/week; 4–12 occupied weeks for nonempty plans; five attempts/user/hour, one concurrent operation/user, two attempts/operation, 45-second total deadline. Scope exclusions and honest-effort constraints remain authoritative in specs.

## Technical implementation default adopted for this pack

| Decision | Rationale / consequence | Status |
|---|---|---|
| TypeScript Next.js modular monolith | One language for interactive UI/server and one deployment; server/cache boundaries need care | Implementation default from recommendation, not original discovery fact |
| PostgreSQL + Prisma | Shared transactions/constraints for activation, quota/funding and fences | Implementation default; versions/runtime configuration verified at bootstrap |
| Auth.js Google | Supported identity integration plus explicit invitation/ownership services | Library default; product access rule already approved |
| Tailwind/shadcn + Zod | UI consistency and strict executable contracts | Implementation defaults |
| Node pdf-parse + server AI adapter | Transient bounded parsing and schema-constrained proposals | Library/provider direction; version/model/caps/privacy must be verified |
| Managed Node/container + managed PostgreSQL | Deployment/runtime flexibility without extra services | Hosting pattern only; no provider purchase/region/plan approved |
| Versioned catalogue and normalized plans | One authority, frozen provenance and atomic archive/reset | Approved behavior; exact migrations/configuration implemented within scope |
| Database quota/funding/lease with idempotency | Multi-instance correctness and budget control | Approved protections; exact transaction implementation must pass tests |
| Short CLAUDE.md + authoritative specs.md + README | Relevant context on demand and no duplicated requirement authority | Documentation organization accepted after tradeoff discussion |

Python/Django/HTMX/PostgreSQL remains an alternative if developer expertise or deployment evidence warrants a recorded stack change. No framework choice guarantees scalability, feasibility, security or accuracy by itself.

## Open external facts and evidence

The subsequently attached weekly-deliverables source gives 26 September professional/problem, 3 October design/feasibility, 10 October implementation/testing and 17 October final readiness, with Week 1–4 forms. These checkpoints are now included in specs/README; year 2026 is inferred from the course context. Actual forms, submission time and completed checkpoint evidence remain unprovided. This refines the planning timeline without adding product features.

The D01–D13 register in specs section 5 is authoritative. Professional identity/discovery evidence, actual submission/student details, current provider/prices/permissions, funded count/cap, reviewed content/operator, deletion schedules, exact deployment limits, browser/language/accessibility matrix and observed test results are not supplied by this pack. Do not insert guessed people, deadlines, prices or compliance guarantees. Exact compatible dependencies are resolved from official docs/package evidence and pinned in the repository, rather than copying stale versions from history.

## Change records during implementation

For a material change record actual date, decision, rationale/alternative, approval when product scope changes, affected R/US/T IDs, migration/configuration impact and observed verification. Do not claim an earlier approval that was absent. Update specs and README when the implementation contract changes. Track actual AI assistance and corrections for the assignment declaration.

Historical warnings: the original transcript ends before Q10 is answered; older eight-role/quizzes/rebranding/admin requirements are superseded. Earlier validators silently clamped work/weeks, sliced to twelve tasks, omitted invoked auth/consent/quota/token caps and failed validation retries; do not reuse those handlers.

## CV minimization correction — 10 October 2026

- R04/T04, DEF-02: replace global name-substring removal with case-insensitive whole-identifier removal. Full identities are removed first; an individual name token within an exact catalogue skill phrase is retained so a name containing `API` does not erase `API testing`. Contact/header filtering remains in effect; this pattern-based minimizer still cannot guarantee anonymity.
- The former known-defect case and a full-name/token/subword regression now run in the normal unit suite. The unit runner uses one worker after a concurrent cold parser test reached the unchanged eight-second application deadline; the sequential full run passed all 89 cases. No retry or deadline relaxation was introduced.
- No requirements, database schema, provider approval or deployment configuration changed.

## Initial build — 3 October 2026

- Pinned Next.js 16.3.8 after verification from the official release and npm registry. Stable NextAuth 4.24.15 explicitly permits Next.js 16 and React 19 in its peer constraints; Prisma 7.10.0 uses the PostgreSQL driver adapter. No beta ORM selected.
- Used semantic React/CSS for this small initial interface, reducing UI dependencies while preserving the required screens. Target stack section updated to match.
- Kept live provider routes unavailable while their required controls are unimplemented. Synthetic browser-only roadmap behavior demonstrates interactions, not live AI integration. Production `/demo` is disabled and Google participant admission is closed in production.
- Database writes lock the invitation then user consistently. Revision checks protect profile/inventory/task changes. Deleted application records cascade; revoked invitations remain an explicit re-entry fence. No all-store deletion claim.
- Development field ceilings: role 2–100 characters; years integer 0–60; inventory 100 entries; label 100 characters; JSON mutation 32 KiB. User-facing boundaries documented in forms and specs.
- No external participant identity, funding amount, pricing, retention schedule or permission has been invented.

## Live-provider preparation — 10 October 2026

- The user selected Google Gemini Flash Latest (`gemini-flash-latest`) after authorizing work toward live AI, while funded limits/privacy terms remained unapproved. This is a changing alias and no fixed billable model, price, currency, retention or spending limit has been assumed.
- Added a provider-independent request builder and a direct Gemini REST adapter with structured JSON output, one HTTP request per reserved attempt, bounded response reading, no SDK retries and no tools. Tests intercept fetch and make no live calls. Existing application routes still select the mock; paid mode remains disabled until fixed provider pricing, reviewed content, purpose-specific disclosure, retention and shared funded ceiling satisfy the specification.
- The current working copy had the R11 five-attempt guard commented out. After the conflict was reported, the user explicitly asked to restore it. The shared CV/roadmap quota gate is active again; live dispatch remains disabled for other open gates.

## Week 3 connected mock workflow — 10 October 2026

- R03–R11/R14 and corresponding US/T groups. User requested synthetic/mocked development with no paid calls/deployment. Created `codex/week3-connected-workflow`; production admission remains closed.
- Added transient PDF parsing, signed candidate origins, reviewed merge, mock provider contracts, shared PostgreSQL quota/funding/operations and fenced atomic activation. Migration adds operations/attempts/funding/global revision and plan provenance. No product expansion or additional service.
- Separate browser-only demo retained. Signed-in UI uses private services; the new browser test simulates Auth.js session establishment and does not prove Google OAuth.
- Disposable Node parser processes contain native worker-thread crashes. Changed `fork` to `spawn` for Turbopack compatibility; the subsequent production build and connected browser journey passed. Bounds/native-memory caveat are documented in specs/README.
- Explicit UTC database-clock queries correct the adapter timezone reinterpretation exposed by real PostgreSQL tests. Short transactions, consistent lock ordering, partial unique operation index and final fences protect multi-instance state.
- Mock budget units are nonmonetary; the later Gemini transport is not connected to paid dispatch. Conservative exact synthetic activity validation is not general LLM semantic evaluation. Retention facts and reviewed content remain external gates.
- Aligned Prisma CLI/client/adapter 7.10.0, Next ESLint configuration 16.3.8, pinned pdf-parse 2.4.5 and updated lockfile. Sources: [Prisma 7 migration guidance](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7), [pdf-parse maintainer documentation](https://github.com/mehmet-kozan/pdf-parse), and bundled Next route-handler/client-boundary/external-package guides. npm advisory assessment remains pending.
- Expected/actual tests are in BUILD-STATUS. Continuation resolved the earlier approval-review limit: 41 unit/parser cases, 20 PostgreSQL cases and six browser journeys pass. Production build and local production smoke pass. The browser fixture now checks API readiness and awaits Auth.js sign-out persistence; no product timeout or safety gate was relaxed. Google OAuth success, live provider behavior and deployed-runtime evidence remain unverified.
