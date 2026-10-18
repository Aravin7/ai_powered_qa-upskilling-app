import type { RequirementLibrary } from './requirements';
import { draftContentDetails } from './requirement-content-draft';

// Review draft only. Existing synthetic estimates are retained for inspection;
// none of these values are a professionally approved curriculum or labour-market claim.
const sourceIds:Record<string,string[]>={
 'test-design':['pw-tests'],'api-testing':['http'],'automation':['pw-tests'],
 'ai-basics':['genai-risks'],'prompt-design':['genai-risks'],'generated-test-review':['pw-tests','genai-evaluation'],
 'responsible-ai':['genai-risks'],'ci':['pw-ci'],
};
const draft:RequirementLibrary={
 version:'qa-capabilities-draft-v4',audience:'experienced-qa',createdOn:'2026-10-18',review:null,
 // Initial review candidates, not a fixed product menu. New combinations
 // remain provisional until a later reviewed version adds their rule.
 directionRules:[
  {id:'ai-assisted-qa',label:'AI-assisted QA engineering',requirements:[
   {capabilityId:'test-design',priority:'critical'},{capabilityId:'automation',priority:'critical'},
   {capabilityId:'ai-basics',priority:'critical'},{capabilityId:'prompt-design',priority:'critical'},
   {capabilityId:'generated-test-review',priority:'critical'},{capabilityId:'responsible-ai',priority:'important'},
   {capabilityId:'ci',priority:'important'},
  ]},
  {id:'genai-application-testing',label:'Testing GenAI applications',requirements:[
   {capabilityId:'ai-basics',priority:'critical'},{capabilityId:'llm-evaluation',priority:'critical'},
   {capabilityId:'test-design',priority:'critical'},{capabilityId:'api-testing',priority:'critical'},
   {capabilityId:'responsible-ai',priority:'important'},{capabilityId:'ai-security',priority:'important'},
   {capabilityId:'retrieval-testing',priority:'important'},{capabilityId:'observability',priority:'nice'},
  ]},
  {id:'ai-safety-security-testing',label:'AI safety and security testing',requirements:[
   {capabilityId:'ai-basics',priority:'critical'},{capabilityId:'responsible-ai',priority:'critical'},
   {capabilityId:'llm-evaluation',priority:'critical'},{capabilityId:'ai-security',priority:'critical'},
   {capabilityId:'test-design',priority:'critical'},{capabilityId:'api-testing',priority:'critical'},
   {capabilityId:'retrieval-testing',priority:'important'},
  ]},
  {id:'ai-automation-delivery-gates',label:'AI-assisted automation and delivery gates',requirements:[
   {capabilityId:'test-design',priority:'critical'},{capabilityId:'automation',priority:'critical'},
   {capabilityId:'ci',priority:'critical'},{capabilityId:'delivery-gates',priority:'critical'},
   {capabilityId:'generated-test-review',priority:'important'},{capabilityId:'llm-evaluation',priority:'critical'},
   {capabilityId:'load-testing',priority:'nice'},
  ]},
  {id:'ai-application-reliability',label:'AI application performance and reliability',requirements:[
   {capabilityId:'api-testing',priority:'critical'},{capabilityId:'observability',priority:'critical'},
   {capabilityId:'ai-basics',priority:'critical'},{capabilityId:'llm-evaluation',priority:'critical'},
   {capabilityId:'retrieval-testing',priority:'important'},{capabilityId:'load-testing',priority:'important'},
   {capabilityId:'responsible-ai',priority:'important'},
  ]},
 ],
 sources:[
  {id:'pw-tests',title:'Playwright: Writing tests',url:'https://playwright.dev/docs/writing-tests',checkedOn:'2026-10-17'},
  {id:'http',title:'MDN: HTTP overview',url:'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview',checkedOn:'2026-10-17'},
  {id:'pw-ci',title:'Playwright: Continuous integration',url:'https://playwright.dev/docs/ci',checkedOn:'2026-10-17'},
  {id:'genai-risks',title:'OWASP: LLM and GenAI risks',url:'https://genai.owasp.org/llm-top-10/',checkedOn:'2026-10-17'},
  {id:'genai-evaluation',title:'Google Cloud: Gen AI evaluation overview',url:'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/evaluation-overview?hl=en',checkedOn:'2026-10-17'},
  {id:'k6-thresholds',title:'Grafana k6: Thresholds',url:'https://grafana.com/docs/k6/latest/using-k6/thresholds/',checkedOn:'2026-10-17'},
 ],
 capabilities:[
  {id:'test-design',label:'Test design',meaningVersion:'draft-v4',meaning:'Design and explain expected-result-based test cases from bounded requirements, including boundary and negative partitions.',aliases:['test case design'],level:'foundation',priority:'critical',prerequisites:[],sourceIds:sourceIds['test-design'],minutes:120,activity:'Create boundary and negative test cases for a sample sign-in form.',outcome:'Record ten cases with expected results and explain two boundary choices.'},
  {id:'api-testing',label:'API testing',meaningVersion:'draft-v4-r3',meaning:'Test HTTP request/response behavior and errors against explicit API expectations.',aliases:['rest testing'],level:'foundation',priority:'important',prerequisites:['test-design'],sourceIds:sourceIds['api-testing'],minutes:120,activity:'Use the Playwright request API with a permitted tutorial JSON API: assert status and response body for success, invalid input, 401 unauthenticated, 403 forbidden and missing-resource cases.',outcome:'Record the request, expected and observed status and body for each case; explain the difference between 401 and 403.'},
  {id:'automation',label:'Test automation',meaningVersion:'draft-v4-r3',meaning:'Implement and diagnose repeatable automated browser checks with fixtures, stable locators and meaningful assertions.',aliases:['playwright'],level:'foundation',priority:'important',prerequisites:['test-design'],sourceIds:sourceIds.automation,minutes:240,activity:'Build three Playwright tests against a tutorial sample application; deliberately break one behavior and confirm its test fails, then restore it and repeat the suite to inspect flaky outcomes.',outcome:'Submit the tests, the observed deliberate failure, restored pass and repeated-run results with an explanation of any flakiness.'},
  {id:'ai-basics',label:'Generative AI fundamentals',meaningVersion:'draft-v4',meaning:'Explain task-relevant generative-model behavior, variability, unsupported claims and data-handling limits.',aliases:['llm fundamentals'],level:'foundation',priority:'critical',prerequisites:[],sourceIds:sourceIds['ai-basics'],minutes:120,activity:'Compare saved generated test suggestions with a manually written baseline.',outcome:'Identify three useful suggestions and three limitations with examples.'},
  {id:'prompt-design',label:'Prompt design for testing',meaningVersion:'draft-v4',meaning:'Express and revise test-generation instructions with explicit context, constraints and review of unsupported output.',aliases:['prompt engineering'],level:'foundation',priority:'critical',prerequisites:['test-design','ai-basics'],sourceIds:sourceIds['prompt-design'],minutes:150,activity:'Write a constrained test-generation prompt using a synthetic specification. Revise unsupported claims in non-sensitive example responses; optionally repeat with the learner’s own approved AI chat tool outside the app.',outcome:'Record the prompt and corrected unsupported assumption. Compare repeated live outputs only if the learner used an outside tool; saved fixtures alone cannot demonstrate live variability.'},
  {id:'generated-test-review',label:'Reviewing AI-generated tests',meaningVersion:'draft-v4-r3',meaning:'Inspect and execute generated test code to identify coverage errors, false assumptions and ineffective assertions; this differs from evaluating AI application answers.',aliases:[],level:'foundation',priority:'important',prerequisites:['automation','prompt-design'],sourceIds:sourceIds['generated-test-review'],minutes:180,activity:'Follow a selected external lesson to review generated Playwright tests for ineffective assertions, invented selectors or fields and missing negative cases; execute repairs in your practice project.',outcome:'Record suspected defects with expected and observed behavior, repair checks and verify that they detect deliberate behavior changes.'},
  {id:'responsible-ai',label:'Responsible AI in QA',meaningVersion:'draft-v4',meaning:'Apply privacy, bias, transparency and human-oversight boundaries to a bounded AI-assisted QA workflow.',aliases:['ai privacy'],level:'foundation',priority:'important',prerequisites:['ai-basics'],sourceIds:sourceIds['responsible-ai'],minutes:90,activity:'Review a synthetic testing workflow for personal-data exposure, biased examples, disclosure of AI assistance and human review before use.',outcome:'Record privacy safeguards, one bias check, a transparency note and a human-approval point.'},
  {id:'ci',label:'Continuous integration',meaningVersion:'draft-v4-r3',meaning:'Run repeatable tests in an integration workflow with defined triggers, failures and artifacts; continuous deployment is outside this capability.',aliases:['continuous integration'],level:'foundation',priority:'important',prerequisites:['automation'],sourceIds:sourceIds.ci,minutes:120,activity:'Draft a GitHub Actions YAML template; inspect triggers and execute its npm commands locally, recording exit codes and artifacts. No act or Docker is required.',outcome:'Explain the trigger by inspection, failed local command and artifact handling; a hosted run requires a learner-provided free GitHub account and is optional.'},
  {id:'llm-evaluation',label:'Evaluating GenAI application responses',meaningVersion:'draft-v4-r3',meaning:'Design repeatable, task-specific evaluation cases and compare manual judgments with tutorial evaluation tools to examine errors and limits of automated judging.',aliases:[],level:'intermediate',priority:'important',prerequisites:['api-testing','ai-basics'],sourceIds:['genai-evaluation'],minutes:180,activity:'Follow a selected external evaluation lesson: define task-specific criteria, judge non-sensitive example responses before comparing a tutorial scorer, and document disagreements and limitations.',outcome:'Record expected outcomes, criterion-level results, scorer disagreement and limits of automated judging without live model calls.'},
  {id:'ai-security',label:'AI application security testing',meaningVersion:'draft-v4-r3',meaning:'Test application-level prompt injection and unsafe handling of model output in a permitted synthetic environment.',aliases:[],level:'intermediate',priority:'important',prerequisites:['api-testing','responsible-ai','llm-evaluation'],sourceIds:['genai-risks'],minutes:180,activity:'Follow a selected external security lesson using synthetic injection and untrusted-output cases in a permitted practice environment.',outcome:'Record the threat, expected boundary, observed behavior, evaluation result and mitigation limits.'},
  {id:'retrieval-testing',label:'Testing retrieval and grounding',meaningVersion:'draft-v4-r3',meaning:'Separate retrieval relevance from answer grounding and citation correctness using synthetic documents.',aliases:[],level:'intermediate',priority:'important',prerequisites:['llm-evaluation'],sourceIds:['genai-evaluation','genai-risks'],minutes:180,activity:'Inspect labelled example documents, retrieved chunks and answers from the selected external retrieval lesson.',outcome:'Report retrieval misses, unsupported answer claims and incorrect source citations separately against the labelled source evidence.'},
  {id:'load-testing',label:'Performance and load testing',meaningVersion:'draft-v4-r3',meaning:'Use reproducible workload and pass/fail criteria on a permitted local system; local timings vary by machine and cannot establish real AI-service capacity.',aliases:[],level:'intermediate',priority:'nice',prerequisites:['api-testing'],sourceIds:['k6-thresholds'],minutes:180,activity:'Follow the selected external k6 tutorial with a permitted practice API and explicit error/latency thresholds; repeat to inspect machine noise.',outcome:'Record workload, threshold rationale, repeated timings, failure evidence and limits of extrapolation.'},
  {id:'observability',label:'Quality observability',meaningVersion:'draft-v4-r3',meaning:'Connect saved test results, API indicators and evaluation signals to failure investigation; sensitive prompts and personal inputs are excluded. Operating a load test is not required.',aliases:[],level:'intermediate',priority:'nice',prerequisites:['api-testing','llm-evaluation'],sourceIds:['k6-thresholds','genai-evaluation'],minutes:120,activity:'Investigate non-sensitive tutorial latency/error results and a scored evaluation regression.',outcome:'Describe signals, a possible cause, missing evidence and a follow-up test without logging sensitive input.'},
  {id:'delivery-gates',label:'Automated delivery quality gates',meaningVersion:'draft-v4-r3',meaning:'Run reproducible QA and saved AI-evaluation fixtures through a simulated CI gate with explicit failure criteria and no real credentials in source.',aliases:[],level:'intermediate',priority:'important',prerequisites:['ci','llm-evaluation'],sourceIds:['pw-ci','genai-evaluation'],minutes:195,activity:'Write a CI YAML template and run its npm commands locally for automated tests and saved synthetic evaluation cases; inspect exit codes and safe artifacts. No act or Docker is required.',outcome:'Explain triggers, failed-gate behavior, artifact handling and why passing fixtures do not prove live AI quality; a hosted run is optional with a learner-provided free account.'},
 ],
};
export const requirementDraft:RequirementLibrary={...draft,capabilities:draft.capabilities.map(item=>({...item,...draftContentDetails[item.id]}))};
