# Build status — 3 October 2026

Version 0.1.0. Initial working slice; **not the complete MVP and not approved for production admission**. The target remains `../specs.md`.

## Observed checks

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | PASS | Strict project type checking |
| ESLint | PASS | Application and test source |
| Unit tests | 28 PASS | Input boundaries/revisions, inventory preservation/normalization, comparison, roadmap validation and progress |
| PostgreSQL tests | 5 PASS | Actual isolated PostgreSQL 18.4: identity conflict, simultaneous profile updates, task ownership/revision, invitation revocation, deletion/re-entry fencing |
| Playwright journeys | 5 PASS | Actual Chromium 153: reload persistence, consent/sample plan/progress/undo/failed replacement, mobile overflow, anonymous API/origin rejection, stale multi-tab edits |
| Production demo gate | PASS | Production `/demo` returned HTTP 404 |
| Catalogue structure | PASS | Eight-skill synthetic fixture; `reviewed:false`, not real content approval |
| Next.js production build | PASS | Next.js 16.3.8 optimized build with TypeScript |
| Visual inspection | COMPLETE | Synthetic desktop 1440 px and mobile 390 px screenshots; screenshots in this folder |

38 automated test cases passed. This does not mean all T01–T14 acceptance groups are complete. Tests use synthetic records; Google OAuth success and live provider behavior are not covered.

Environment: Node.js 24.19.0, React 19.3.0, Prisma 7.10.0, NextAuth 4.24.15, Vitest 5.0.3, Playwright 1.63.0. The test database was a separate local PostgreSQL 18.4 process, not a mock. Test records were removed by fixture cleanup. The browser used a locally provisioned Chromium 153 binary after the regular browser download was unavailable; Playwright’s executable-path override is documented. No installed verification binaries are shipped in the source ZIP.

The initial browser suite had one ambiguous alert selector (Next.js also renders a route-announcer alert); it was corrected and the suite rerun successfully. A stale-edit revision issue discovered during implementation was corrected and covered by the fifth browser test. Build/tool execution needed normal process permissions in the hosted sandbox; this is an environment limitation, not a requirement for elevated privileges when running the project on a normal development machine.

## Implemented first slice

- Invited Google authentication code with provider-subject binding, verified-email check, encrypted JWT session and per-request database authorization. Local synthetic admission only; actual Google account flow remains unverified.
- Resumable confirmed profile, separate purpose consent, atomic reviewed manual inventory, exact/alias mapping, deterministic comparison and explicit empty-inventory semantics.
- Strict API validation, body limit, mutation-origin guard, no-store responses, safe error envelopes and no credential/content logging in custom services.
- PostgreSQL schema, initial migration, checks, active-plan uniqueness and service ownership/revision constraints.
- Application-record deletion with revoked invitation retained as a re-entry fence. Backup/provider erasure and metadata-retention schedules remain unresolved.
- Development-only browser demo with synthetic roadmap validation, relative weeks, progress/undo, outdated state, archive/reset on explicit valid replacement, preservation on failure and multi-tab stale-write handling.

## Required next work

| Area | Current state / remaining work |
| --- | --- |
| CV extraction | Unimplemented; route safely unavailable, manual entry works. Add bounded parser, minimization, affirmative evidence validation and signed candidate origins. |
| Live AI roadmap | Unimplemented; sample scheduler is deterministic and clearly labelled. Add structured provider adapter and semantic validation. |
| Shared operations | Unimplemented: quotas, funded cost reservations, operation keys/status, 45-second deadline, two-attempt accounting and lease fencing. No dispatch occurs. |
| Live plan activation | Unimplemented: atomic archive/new-plan commit bound to input/catalogue revisions and active consent. Models and task update controls are present. |
| Content | Synthetic fixture only. Need named professional review, honest effort estimates, accessible learning resources, version publication/frozen-version resolution. |
| Privacy | Need provider disclosures/settings, published retention/backup schedules and verified cleanup/restore procedures. Production admission is closed. |
| Deployment | No host, domain, TLS/environment configuration or production database selected/deployed. |
| Assignment | Real professional evidence, connected live AI demonstrations, costs/adoption, evidence PDF, narrated video and repository access remain outstanding. |

Production authentication currently rejects admission and `/demo` is disabled under `NODE_ENV=production`. Removing these gates before implementing the missing controls would violate the specification. No real OpenAI key is used or required by this build.

## Actual AI-use record

Tool: ChatGPT/Codex. User instruction: “start to build the app.” Output used: initial Next.js project, UI, data models, services, tests and setup documentation. Verification: strict type check, lint, optimized build, 28 unit cases, 5 real PostgreSQL cases, 5 Chromium journeys, and screenshot review. Corrections included JSX syntax, lint compatibility, test selector scope, Unicode case folding, consent ordering and stale draft revisions. This records development assistance; it does not claim live AI features in the application or independent professional validation.
