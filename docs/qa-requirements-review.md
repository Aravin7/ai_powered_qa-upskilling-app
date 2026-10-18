# QA capability requirements — review draft

18 October 2026. **The user reports that Tharindu Perera supplied and approved the 16 amendments transcribed in [the evidence record](evidence/2026-10-18-v4-content-review/README.md).** That approval was recorded for v3 digest `8a9e457309ffbda0fdca1c8e5181df248dac92c1c3ec7b0c96cc54354a2d4a38`. Draft v4 adds the five direction-rule proposals below; its current digest is `746d9e94eb0d73396a283f17bc01518f28a583b6d65472857f20a1cf0c9f9b75`. This new version has `review:null` and cannot drive authoritative comparison until reviewed. It is not published or activated. Detailed boundaries and effort proposals are in `src/lib/requirement-content-draft.ts`.

The library contains capabilities, not a fixed menu of pathways. A learner-selected combination includes its prerequisite closure. For example, delivery quality gates draw on `ci`, `automation`, `test-design`, `api-testing`, `llm-evaluation` and, in the proposed delivery direction, `generated-test-review`; retrieval/grounding draws on response evaluation and its foundations. A later reviewed selection may combine these in other ways. None of this draft changes the app's currently blocked provisional-direction comparison or its existing plans.

## Proposed content for review

### Authorised rule amendments

Aravin authorised these behaviour amendments after reviewing this packet. Tharindu Perera supplied and approved the 16 amendment points, as reported by Aravin on 18 October 2026; that v3 content digest is recorded above. The five direction rules are a new v4 proposal and still need review. Direction-rule compilation, saved selection, deterministic comparison, mapping confirmation and immutable publication controls are connected and have synthetic unit/database/browser evidence. The content-detail contract and mock reviewed resource research/atomic roadmap activation are connected. Live research is unfinished. Learning activities are recommendations for external study. Bundled teaching fixtures and exercise runners have been removed at the product owner's direction.

1. **Direction-specific priorities.** Publish critical/important/nice priorities within reviewed direction requirement sets. Reuse capability meanings across directions. LLM-proposed combinations/priorities remain provisional until covered by reviewed rules; learners cannot submit authoritative priorities. Critical and Important are both mandatory; Nice is optional and may be explicitly deferred. Prerequisites inherit the highest priority of any retained dependent, transitively, regardless of a lower direct label. Optional-only prerequisites remain Nice. The compiler binds the highest-dependent policy into the requirement-set identity. Priority examples below remain review candidates.
2. **Optional prerequisite deferral.** Compute mandatory closure from the selected direction's mandatory requirements. Explicitly deferring optional work also defers prerequisites needed exclusively by that work. Keep prerequisites independently mandatory or needed by other retained topics. Schedule shared prerequisites once; confirmed prerequisites require no duplicate learning task. A global important label alone cannot make an optional-only prerequisite mandatory.
3. **Preserved skills and mapping review.** Preserve canonical/unmatched entries, source labels and explicit-removal rules. Use reviewed mappings to propose equivalence; explain the target meaning and require confirmation for uncertain or changed meanings. Missing legacy meaning provenance requires reconciliation, not deletion or silent equivalence. Display reconfirmation separately from new learning needs so the learner can resolve it before generation.
4. **Complete effort assumptions.** Record starting knowledge and reading/watching, setup, practice and result-review effort, including a stated troubleshooting allowance or limitation. Avoid duplicate shared setup. Estimates describe bounded activity completion, not mastery. Do not shorten effort to fit 4–12 weeks; disclose capacity/duration failure while preserving the old plan. The v3 draft contains explicit breakdowns; activity effort must be checked against the recommended external material.
5. **Clear capability boundaries.** Define included/excluded knowledge, audience/level, reviewed aliases, observable practical outcome and rationale for each prerequisite. Distinguish reviewing AI-generated tests from evaluating AI-application responses. Review whether load testing is genuinely required for each observability activity. Replace the original eight placeholder scope statements before publication.
6. **Immutable publication.** Publish explicit snapshots of definitions, direction rules, mappings, effort assumptions, sources and review evidence. Do not construct published versions from mutable catalogue imports. Content changes create a new version/digest; semantic changes require a new meaning version. Existing plans retain frozen requirement/resource snapshots and progress. Adopting updated requirements requires explicit planning action; failed replacement preserves the old plan, and stale workers cannot activate against changed revisions.

The general deferral rule is unchanged: prerequisites needed only by deferred optional work are deferred with it, while shared prerequisites remain. The v3 observability proposal uses supplied API/evaluation signals and therefore depends on API testing and LLM evaluation, not on running a load test. Synthetic compiler tests retain an optional branch with exclusive prerequisites to verify the general rule independently of this draft.

Minutes are **proposed task effort**, not time to proficiency. Learners using automation, CI, scripted response evaluation and k6 are assumed able to read and edit simple TypeScript/JavaScript, run npm/CLI commands and use Git on a tutorial practice project. That preparation is outside the estimates; a learner without it needs an introductory step and revised effort. The historical approval covers the reported v3 amendments. This revised draft recommends external learning activities and still needs exact-content review; the app provides no exercise lab or scorer. Learning resources will be researched separately; the requirement sources below are not a fixed resource inventory.

| Capability ID | Prerequisites | Draft minutes | Observable work to review |
| --- | --- | ---: | --- |
| test-design | None | 120 | Boundary/negative cases with expected outcomes and rationale |
| api-testing | test-design | 120 | Playwright request API: status and body assertions, including separate 401 and 403 cases |
| automation | test-design | 240 | Three Playwright tests, deliberate behavior failure and repeated runs for flakiness |
| ai-basics | None | 120 | Compare generated suggestions with a manual baseline and identify limits |
| prompt-design | test-design, ai-basics | 150 | Correct unsupported output; optional outside chat tool for observed live variability |
| generated-test-review | automation, prompt-design | 180 | Review generated-test examples from an external lesson; repair ineffective checks and verify deliberate failures in a learner-owned project |
| responsible-ai | ai-basics | 90 | Privacy, bias, transparency and human oversight exercise |
| ci | automation | 120 | Write GitHub Actions YAML; run the same npm commands locally and inspect exit codes/artifacts; hosted run optional |
| llm-evaluation | api-testing, ai-basics | 180 | Use external evaluation materials to define criteria and compare manual judgments with tutorial scoring tools |
| ai-security | api-testing, responsible-ai, llm-evaluation | 180 | Permitted synthetic prompt-injection and unsafe-output examples from an external lesson |
| retrieval-testing | llm-evaluation | 180 | Labelled documents, chunks and answers from an external retrieval lesson; compare claims with source evidence |
| load-testing | api-testing | 180 | External k6 tutorial on a permitted practice API; inspect thresholds and machine-noisy timings |
| observability | api-testing, llm-evaluation | 120 | Investigate non-sensitive example API/evaluation signals from external material |
| delivery-gates | ci, llm-evaluation | 195 | Execute YAML-template commands locally, including a failed gate and safe artifacts; hosted run optional |

Priorities belong to a direction rule, not to a capability universally. These five starter rules are review candidates, not a permanent pathway menu. AI may suggest other combinations from reviewed capabilities; a new combination stays provisional until a reviewed version adds its authoritative rule. `load-testing` is Important (mandatory) in `ai-application-reliability` and Nice in `ai-automation-delivery-gates`; it is not a universal requirement.

| Direction rule ID | Direct Critical roots | Direct Important roots | Direct Nice roots |
| --- | --- | --- | --- |
| ai-assisted-qa | test-design, automation, ai-basics, prompt-design, generated-test-review | responsible-ai, ci | None |
| genai-application-testing | ai-basics, llm-evaluation, test-design, api-testing | responsible-ai, ai-security, retrieval-testing | observability |
| ai-safety-security-testing | ai-basics, responsible-ai, llm-evaluation, ai-security, test-design, api-testing | retrieval-testing | None |
| ai-automation-delivery-gates | test-design, automation, ci, delivery-gates, llm-evaluation | generated-test-review | load-testing |
| ai-application-reliability | api-testing, observability, ai-basics, llm-evaluation | retrieval-testing, load-testing, responsible-ai | None |

**Mandatory/optional rule:** Critical and Important are mandatory; Nice is optional. Every retained prerequisite inherits the highest of its direct priority and its dependent priorities, recursively. Shared prerequisites appear once. Deferring Nice work removes only its exclusive prerequisite work; it cannot remove foundations needed by mandatory work. Confirmed prerequisites remove learning work, not the underlying requirement. The source compiler enforces this policy.

### Full prerequisite closure and effort visibility

These are structural preview totals for an empty confirmed inventory, not an approved curriculum, generated schedule or feasibility result. Raw totals include per-topic setup; deduplicated totals count identical shared setup once. All fourteen raw topics total **2,175 minutes**. The removed `automation` prerequisite does not remove browser automation where a direction or `generated-test-review` independently requires it.

| Rule ID | Mandatory direct-list minutes | Prerequisites added to mandatory roots | Raw mandatory closure | Raw including Nice | Deduplicated mandatory / including Nice |
| --- | ---: | --- | ---: | ---: | ---: |
| ai-assisted-qa | 1,020 | None | 1,020 | 1,020 | 980 / 980 |
| genai-application-testing | 990 | None | 990 | 1,110 | 950 / 1,060 |
| ai-safety-security-testing | 990 | None | 990 | 990 | 950 / 950 |
| ai-automation-delivery-gates | 1,035 | api-testing (Critical), ai-basics (Critical), prompt-design (Important) | 1,425 | 1,605 | 1,365 / 1,545 |
| ai-application-reliability | 990 | test-design (Critical) | 1,110 | 1,110 | 1,070 / 1,070 |

All effective Critical/Important priorities follow the table plus the added priorities above. Nice observability in the GenAI direction keeps its exclusive work optional; its already-mandatory prerequisites retain their higher priorities. Responsible AI remains proposed Important in the performance direction because safe telemetry, privacy and human oversight apply to performance investigations; reviewer confirmation of that fit remains pending.

### Evaluation prerequisite and capability meanings

The external evaluation activity assumes basic TypeScript/npm/Git as a starting condition; it does not teach or require Playwright browser automation. Accordingly `llm-evaluation` now requires only `api-testing` and `ai-basics`. The API rationale is reusable request/response harness structure, not live provider calls. Prompt injection belongs to `ai-security`; `responsible-ai` is limited to privacy, bias, transparency and human oversight. These boundaries were inspected in the actual TypeScript definitions as part of this amendment.

Meaning versions belong to individual capabilities. The previous unapproved definitions had effective meaning `draft-v4`; unchanged definitions retain that value. The external-material scope revisions for API testing, automation, generated-test review, CI, LLM evaluation, AI security, retrieval testing, load testing, observability and delivery gates use `draft-v4-r3`. There is no blanket override tied to the library version. Changes to direction priorities or effort alone do not change capability meanings. The renamed `ai-evaluation` canonical ID requires an explicit reviewed mapping/reconfirmation rather than silent migration. Content changes still create a new digest and require exact-content review.

CI simulation means editing a GitHub Actions YAML template, explaining triggers by inspection, and executing its npm commands locally while recording exit codes/artifacts. It does **not** mean running `act`, Docker or a hosted Actions runner. A hosted run with a learner-provided free account is optional and separately evidenced. Existing estimates assume installed Node/Git/browser/k6 as applicable; installation failure or missing coding baseline requires extra preparation and revised effort.

### Proposed effort breakdown for reviewer correction

All values are minutes. The total is for one topic alone. API, Playwright browser, k6, CI repository and external AI example preparation have separate IDs. A shared ID is used only for identical setup; retained work pays it once. Live model requests and hosted accounts are optional, outside these estimates. Confirming a skill does not prove an environment is installed: any setup still needed by remaining topics is included. Baseline assumptions and troubleshooting limits are explicit per node. These proposals do not compress work to meet a four-week minimum. All estimates remain provisional and must be reviewed against the selected external materials before activation. Local k6 numbers vary by machine and cannot establish production capacity.

| Topic | Read/watch | Setup | Practice | Review | Troubleshooting | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| test-design | 25 | 0 | 65 | 20 | 10 | 120 |
| api-testing | 20 | 20 | 50 | 20 | 10 | 120 |
| automation | 30 | 20 | 150 | 25 | 15 | 240 |
| ai-basics | 30 | 10 | 50 | 20 | 10 | 120 |
| prompt-design | 30 | 10 | 70 | 25 | 15 | 150 |
| generated-test-review | 30 | 20 | 90 | 25 | 15 | 180 |
| responsible-ai | 20 | 10 | 35 | 15 | 10 | 90 |
| ci | 25 | 20 | 50 | 15 | 10 | 120 |
| llm-evaluation | 40 | 10 | 85 | 30 | 15 | 180 |
| ai-security | 40 | 10 | 85 | 30 | 15 | 180 |
| retrieval-testing | 40 | 10 | 85 | 30 | 15 | 180 |
| load-testing | 35 | 20 | 80 | 30 | 15 | 180 |
| observability | 25 | 10 | 55 | 20 | 10 | 120 |
| delivery-gates | 30 | 20 | 110 | 20 | 15 | 195 |

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

For a synthetic example, select `ai-assisted-qa` with confirmed `test-design` and `automation` at the exact reviewed meaning versions. The full retained set is `test-design`, `automation`, `ai-basics`, `prompt-design`, `generated-test-review`, `responsible-ai` and `ci`. The first two count as confirmed self-report; `ci` is an Important learning need alongside the remaining AI topics. SQL stays in the inventory. An unknown automation meaning instead requires reconfirmation, which is returned separately from learning gaps. This is an illustration, not a run on a person's CV.

## External learning boundary

The roadmap recommends one topic documentation page and one supporting lesson/video, with a practical activity completed outside the app. The app does not supply cases, answer keys, scorers, practice servers or hosted exercise execution. Saved completion is learner-reported progress, not assessed proficiency. Resource relevance, availability and honest workload still require validation.

## Decisions and remaining sign-off

- Tharindu Perera's approval of the 16 amendment points is recorded for v3. Review the exact five v4 direction rules and their priority assignments before activation.
- Confirm whether the starter directions cover the desired learner choices. Additional directions can be added in later reviewed versions; the five are not a product limit.
- Recommend an official topic documentation page and one supporting lesson/video per topic. Learners perform practical activities outside the app and record completion inside it.
- Review requirements, resource relevance and honest effort assumptions before content activation. A timed pilot of app-authored exercises is not an MVP gate: building and running those exercises is outside scope.
- Confirm source applicability and identify missing QA/security/privacy/reliability topics. New capabilities can be added as another reviewed version; these fourteen are not a product-wide permanent limit.
- If direction rules or capability content change, obtain review of that new content and bind it to a new exact content digest. The digest is an integrity check, **not a digital signature**; the approval recorded here is based on Aravin's report of Tharindu's approval.

`npm run requirements:validate` checks draft structure and prints its digest plus whether all content details exist. `npm run requirements:validate -- --reviewed` must stop with CONTENT_REVIEW_REQUIRED for v4 until its new direction rules receive exact-content review. Tharindu's reported approval applies to v3's amendment digest, not these v4 rules. Neither command publishes content or writes a database. Internal snapshot registration/activation, learner mapping and selected-direction comparison are implemented; frozen synthetic resource/plan integration and scheduling against this effort contract are implemented for local mock mode.

Focused synthetic tests cover direction priorities/deferral, digest binding, mapping confirmation, immutable snapshots, selected-direction routes, stale versions and preservation of saved plans. The new detail/workload tests cover arithmetic, prerequisite rationale and shared setup. They do not establish professional content quality or live research. Additional reviewed-roadmap tests cover exact activity effort, resource binding, replacement, rollback and late-result fences.

Historical status at time of entry: immutable snapshot registration and authenticated mapping preview/confirmation/comparison services had real isolated PostgreSQL tests. Current draft review and later mock plan activation are described at the top of this packet. Live research remains pending. See `docs/evidence/2026-10-17-skill-reconciliation/README.md` for observed results.

Current UI: an operator activation pointer gates signed-in mapping and direction panels. Private routes accept current-version confirmations and explicit direction/deferral selections. The actual v4 draft remains inactive because exact-content review is pending; browser tests activate synthetic fixtures only in the isolated database. Learners cannot publish content or submit authoritative priorities/gaps. See `docs/evidence/2026-10-18-reviewed-direction/README.md`; mock reviewed roadmap activation is connected; live research remains gated.
