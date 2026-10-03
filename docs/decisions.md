# Decision Log

3 October 2026 · Current behavior is in `../specs.md`; this file records provenance and rationale. A historical entry never overrides current requirements.

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

## Initial build — 3 October 2026

- Pinned Next.js 16.3.8 after verification from the official release and npm registry. Stable NextAuth 4.24.15 explicitly permits Next.js 16 and React 19 in its peer constraints; Prisma 7.10.0 uses the PostgreSQL driver adapter. No beta ORM selected.
- Used semantic React/CSS for this small initial interface, reducing UI dependencies while preserving the required screens. Target stack section updated to match.
- Kept live provider routes unavailable while their required controls are unimplemented. Synthetic browser-only roadmap behavior demonstrates interactions, not live AI integration. Production `/demo` is disabled and Google participant admission is closed in production.
- Database writes lock the invitation then user consistently. Revision checks protect profile/inventory/task changes. Deleted application records cascade; revoked invitations remain an explicit re-entry fence. No all-store deletion claim.
- Development field ceilings: role 2–100 characters; years integer 0–60; inventory 100 entries; label 100 characters; JSON mutation 32 KiB. User-facing boundaries documented in forms and specs.
- No external participant identity, funding amount, pricing, retention schedule or permission has been invented.
