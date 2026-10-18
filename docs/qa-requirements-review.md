# QA capability requirements — review draft

18 October 2026. **Not approved or published.** A review contact and an earlier date were supplied in chat, but the reviewed document/version and scope are unknown. Approval of this revision remains unverified. Executable draft: `src/lib/requirement-draft.ts`, version `qa-capabilities-draft-v2`, `review:null`; detailed boundaries and effort proposals are in `src/lib/requirement-content-draft.ts`. This packet is concrete content-review input, not evidence of professional approval.

The library contains capabilities, not a fixed menu of pathways. A learner-selected combination includes its prerequisite closure. For example, delivery quality gates draw on CI, automation, test design, API testing and AI evaluation; retrieval/grounding draws on response evaluation and its foundations. A later reviewed selection may combine these in other ways. None of this draft changes the app's currently blocked provisional-direction comparison or its existing plans.

## Proposed content for review

### Authorised rule amendments

Aravin authorised these behaviour amendments after reviewing this packet. Capability content and effort still need professional review; approval of this revision remains unverified and `review:null`. Direction-rule compilation, saved selection, deterministic comparison, mapping confirmation and immutable publication controls are connected and have synthetic unit/database/browser evidence. The new content-detail contract below closes the missing scope/effort structure; mock reviewed resource research and atomic roadmap activation are now connected. Live research and actual content approval remain unfinished.

1. **Direction-specific priorities.** Publish critical/important/nice priorities within reviewed direction requirement sets. Reuse capability meanings across directions. LLM-proposed combinations/priorities remain provisional until covered by reviewed rules; learners cannot submit authoritative priorities. The table below contains baseline draft proposals, not universal priorities.
2. **Optional prerequisite deferral.** Compute mandatory closure from the selected direction's mandatory requirements. Explicitly deferring optional work also defers prerequisites needed exclusively by that work. Keep prerequisites independently mandatory or needed by other retained topics. Schedule shared prerequisites once; confirmed prerequisites require no duplicate learning task. A global important label alone cannot make an optional-only prerequisite mandatory.
3. **Preserved skills and mapping review.** Preserve canonical/unmatched entries, source labels and explicit-removal rules. Use reviewed mappings to propose equivalence; explain the target meaning and require confirmation for uncertain or changed meanings. Missing legacy meaning provenance requires reconciliation, not deletion or silent equivalence. Display reconfirmation separately from new learning needs so the learner can resolve it before generation.
4. **Complete effort assumptions.** Record starting knowledge and reading/watching, setup, practice and result-review effort, including a stated troubleshooting allowance or limitation. Avoid duplicate shared setup. Estimates describe bounded activity completion, not mastery. Do not shorten effort to fit 4–12 weeks; disclose capacity/duration failure while preserving the old plan. The v2 draft now contains explicit breakdowns, still unapproved.
5. **Clear capability boundaries.** Define included/excluded knowledge, audience/level, reviewed aliases, observable practical outcome and rationale for each prerequisite. Distinguish reviewing AI-generated tests from evaluating AI-application responses. Review whether load testing is genuinely required for each observability activity. Replace the original eight placeholder scope statements before publication.
6. **Immutable publication.** Publish explicit snapshots of definitions, direction rules, mappings, effort assumptions, sources and review evidence. Do not construct published versions from mutable catalogue imports. Content changes create a new version/digest; semantic changes require a new meaning version. Existing plans retain frozen requirement/resource snapshots and progress. Adopting updated requirements requires explicit planning action; failed replacement preserves the old plan, and stale workers cannot activate against changed revisions.

The general deferral rule is unchanged: prerequisites needed only by deferred optional work are deferred with it, while shared prerequisites remain. The v2 observability proposal uses supplied API/evaluation signals and therefore depends on API testing, not on running a load test. It does not justify the former load-testing dependency; the reviewer must assess this narrower scope. Synthetic compiler tests retain an optional branch with exclusive prerequisites to verify the general rule independently of this draft.

Minutes are **proposed task effort**, not time to proficiency. The original eight synthetic estimates/outcomes remain visible for scrutiny; the six new estimates are developer proposals. CI is proposed as important rather than the legacy sample's nice-to-have, reflecting the requested modern delivery focus. These numbers must not be used to promise a feasible 4–12-week plan before review. Learning resources will be researched separately; the requirement sources below are not a fixed resource inventory.

| Capability ID | Proposed priority | Prerequisites | Draft minutes | Observable work to review |
| --- | --- | --- | --- | --- |
| test-design | Critical | None | 120 | Boundary/negative cases with expected outcomes and rationale |
| api-testing | Important | test-design | 120 | Success, invalid input, unauthenticated and missing-resource cases |
| automation | Important | test-design | 180 | Three repeatable Playwright tests and meaningful assertions |
| ai-basics | Critical | None | 120 | Compare generated suggestions with a manual baseline and identify limits |
| prompt-design | Critical | test-design, ai-basics | 150 | A constrained testing prompt, reviewed output and corrected unsupported assumptions |
| ai-evaluation | Important | automation, prompt-design | 180 | Execute/review generated tests and explain coverage errors; this is distinct from evaluating an AI application's answers |
| responsible-ai | Important | ai-basics | 90 | Synthetic privacy/injection risks, safe inputs and explicit limitations |
| ci | Important (proposal changed from legacy nice) | automation | 120 | A repeatable test workflow with explained triggers and failure reporting |
| llm-evaluation | Important | api-testing, ai-basics | 180 | Task-specific response criteria, expected outcomes and limits of automated judging |
| ai-security | Important | api-testing, responsible-ai | 180 | Safe synthetic injection/untrusted-output cases, boundaries and mitigation limits |
| retrieval-testing | Important | llm-evaluation | 180 | Separate retrieval misses, unsupported answers and wrong citations |
| load-testing | Important | api-testing | 180 | Bounded local workload, justified latency/error criteria and failure evidence |
| observability | Nice | api-testing | 120 | Investigation of supplied operational/evaluation signals and missing evidence; no load-test execution |
| delivery-gates | Important | ci, llm-evaluation | 150 | Automated tests plus saved evaluation fixtures in CI; explicit gate failures and artifact handling |

Every executable node has meaning version `draft-v2`, an explicit definition, inclusion/exclusion boundaries, starting knowledge, rationale for each prerequisite, aliases, level, source references, activity and outcome. The original eight placeholder meanings were replaced. CI now excludes continuous deployment and no longer treats `ci/cd` as an exact alias. Reviewing generated test code and evaluating AI-application answers have separate boundaries. Inspect all details before approval: schema checks do not establish alias accuracy, curriculum completeness or realistic effort.

### Proposed effort breakdown for reviewer correction

All values are minutes. The total is for one topic alone. Local QA fixture setup (20 minutes) and saved AI fixture setup (10 minutes) each have a stable ID and identical description wherever reused; retained work pays each setup once. No live model request or hosted account is assumed. Confirming a skill does not prove an environment is installed: any setup still needed by remaining topics is included. Baseline assumptions and troubleshooting limits are explicit per node. These proposals do not compress work to meet a four-week minimum.

| Topic | Read/watch | Setup | Practice | Review | Troubleshooting | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Test design | 25 | 0 | 65 | 20 | 10 | 120 |
| API testing | 20 | 20 | 50 | 20 | 10 | 120 |
| Automation | 30 | 20 | 90 | 25 | 15 | 180 |
| GenAI fundamentals | 30 | 10 | 50 | 20 | 10 | 120 |
| Prompt design | 30 | 10 | 70 | 25 | 15 | 150 |
| Generated-test evaluation | 30 | 20 | 90 | 25 | 15 | 180 |
| Responsible AI | 20 | 10 | 35 | 15 | 10 | 90 |
| CI | 25 | 20 | 50 | 15 | 10 | 120 |
| GenAI response evaluation | 40 | 10 | 85 | 30 | 15 | 180 |
| AI security | 40 | 10 | 85 | 30 | 15 | 180 |
| Retrieval/grounding testing | 40 | 10 | 85 | 30 | 15 | 180 |
| Load testing | 35 | 20 | 80 | 30 | 15 | 180 |
| Observability | 25 | 10 | 55 | 20 | 10 | 120 |
| Delivery gates | 30 | 20 | 65 | 20 | 15 | 150 |

New registration/activation rejects missing scope or effort metadata, inconsistent totals, missing/duplicate prerequisite rationales and conflicting shared setup definitions. Historical immutable snapshots remain readable; incomplete legacy snapshots cannot be newly activated. Changed inclusion/exclusion/starting-knowledge boundaries require a new meaning version. Effort changes require a new content version and review digest, even when the capability meaning stays the same.

## Evidence sources inspected

These are public documentation references opened on 17 October 2026. They support topic relevance, not the proposed skill priorities/minutes or a claim about employment demand. No provider/model requests were made and no training service was purchased.

| Source | Relevance and limitation |
| --- | --- |
| [Playwright: Writing tests](https://playwright.dev/docs/writing-tests) | Test actions, assertions and isolation; does not establish a complete test-design curriculum |
| [MDN: HTTP overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview) | Request/response foundations; a reviewer must assess practical API-security and business-case completeness |
| [Playwright: Continuous integration](https://playwright.dev/docs/ci) | Automated browser tests in CI; does not alone establish complete CI/CD or deployment competence |
| [OWASP: LLM/GenAI risks](https://genai.owasp.org/llm-top-10/) | Application security concerns including prompt injection; not an exhaustive responsible-AI or prompt-design curriculum |
| [Google Cloud: Gen AI evaluation overview](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview?hl=en) | Generative-AI evaluation concepts; vendor-specific service access/cost is not required or approved for this MVP |
| [Grafana k6: Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) | Explicit performance pass/fail criteria; does not prove production AI capacity or a complete observability curriculum |

## How the comparison will work

1. The server loads an exact professionally reviewed library version. A learner request cannot supply the library, reviewer, priorities or gaps.
2. Load reviewed direction-specific priorities and explicit optional selections/deferrals. Compile retained requirements and prerequisites using the amended closure rules. Reject missing nodes, source references, cycles and duplicates. Bind the resulting set, mappings and deferrals to a content digest and version; equivalent input ordering does not change the digest.
3. Compare confirmed canonical IDs **and meaning versions**. Matching text/aliases alone cannot silently create a canonical match. A stable ID with an older/unknown meaning version is marked **reconfirmation required**, not counted automatically.
4. Return confirmed self-report, reconfirmation needs, mandatory gaps and optional/deferred needs separately. Prerequisites of mandatory work remain mandatory; optional-exclusive prerequisites are deferred with their topic. Preserve confirmed skills outside this direction.
5. No missing requirements gives `no_gaps`; this does not certify competence. Empty inventory says evidence is not established. Plan generation remains a separate consent-bound, validated operation.

For a synthetic example: choose CI, with confirmed Test design and Test automation at the reviewed meaning versions. The compiled set contains Test design → Test automation → CI. The first two are strengths by self-report; CI is a learning need under the proposed important priority. A confirmed SQL entry remains in inventory. A stale automation meaning version instead produces a reconfirmation requirement as well as the CI gap. These are illustrative inputs, not a run against a person's CV.

## Decisions and sign-off needed

- Name the QA/content reviewer and their review date or provide a declared review identity. Do not add invented names or treat generated JSON as review permission.
- Confirm capability scope, aliases, meaning version and prerequisite rationale; approve priority within each applicable direction rule rather than globally.
- Assess task effort, audience/level and observable outcomes. Reject or revise tasks that understate the work or overlap substantially.
- Confirm source applicability and identify missing QA/security/privacy/reliability topics. New capabilities can be added as another reviewed version; these fourteen are not a product-wide permanent limit.
- After corrections, bind review to the exact content digest. The digest is an integrity check, **not a digital signature or proof that the named person approved it**. Trusted publication and review evidence must be handled separately.

`npm run requirements:validate` checks draft structure and prints its digest plus whether all content details exist. `npm run requirements:validate -- --reviewed` must currently stop with CONTENT_REVIEW_REQUIRED (exit 1). Neither command publishes content or writes a database. Review metadata and actual direction rules remain absent. Internal snapshot registration/activation, learner mapping and selected-direction comparison are implemented; frozen synthetic resource/plan integration and scheduling against this effort contract are implemented for local mock mode.

Focused synthetic tests cover direction priorities/deferral, digest binding, mapping confirmation, immutable snapshots, selected-direction routes, stale versions and preservation of saved plans. The new detail/workload tests cover arithmetic, prerequisite rationale and shared setup. They do not establish professional content quality or live research. Additional reviewed-roadmap tests cover exact activity effort, resource binding, replacement, rollback and late-result fences.

Follow-up implementation: immutable snapshot registration and authenticated mapping preview/confirmation/comparison services have real isolated PostgreSQL tests. Registration takes detached validated content and does not retain a live catalogue reference. Database triggers prevent snapshot edits/deletion; a new version is required. Mapping review preserves original labels/source and requires explicit confirmation with expiring revision-bound references. The original draft still has no approved direction rules or professional review. Actual effort/scope approval and provider research gates remain. Later implementation connects selected-direction mock plan activation. See `docs/evidence/2026-10-17-skill-reconciliation/README.md` for observed results.

Current UI: an operator activation pointer gates signed-in mapping and direction panels. Private routes accept current-version confirmations and explicit direction/deferral selections. The existing draft remains inactive; browser tests activate synthetic fixtures only in the isolated database. Learners cannot publish content or submit authoritative priorities/gaps. See `docs/evidence/2026-10-18-reviewed-direction/README.md`; mock reviewed roadmap activation is connected; actual draft activation and live research remain gated.
