// Synthetic development fixture. No content-review or learning-feasibility claim.
export const catalogue = {
  version: 'qa-synthetic-v1', pathwayId: 'qa-ai-assisted-testing',
  title: 'QA → AI-assisted testing', reviewed: false,
  resources: [
    { id: 'pw-intro', title: 'Playwright documentation', url: 'https://playwright.dev/docs/intro', skillIds: ['automation'] },
    { id: 'mdn-http', title: 'MDN: HTTP overview', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview', skillIds: ['api-testing'] },
    { id: 'gh-actions', title: 'GitHub Actions documentation', url: 'https://docs.github.com/en/actions', skillIds: ['ci'] },
    { id: 'owasp-llm', title: 'OWASP GenAI Security Project', url: 'https://genai.owasp.org/', skillIds: ['ai-basics','prompt-design','ai-evaluation','responsible-ai'] },
    { id: 'istqb', title: 'ISTQB testing foundations', url: 'https://www.istqb.org/', skillIds: ['test-design'] }
  ],
  skills: [
    { id:'test-design', label:'Test design', category:'QA foundations', priority:'critical', aliases:['test case design'], prerequisites:[], resourceIds:['istqb'], minutes:120, activity:'Create boundary and negative test cases for a sample sign-in form.', outcome:'Record ten cases with expected results and explain two boundary choices.' },
    { id:'api-testing', label:'API testing', category:'QA foundations', priority:'important', aliases:['rest testing'], prerequisites:['test-design'], resourceIds:['mdn-http'], minutes:120, activity:'Design a request and response test matrix for a sample JSON API.', outcome:'Document success, invalid input, unauthenticated and missing-resource cases.' },
    { id:'automation', label:'Test automation', category:'QA foundations', priority:'important', aliases:['playwright'], prerequisites:['test-design'], resourceIds:['pw-intro'], minutes:180, activity:'Build a small Playwright suite against a local sample application.', outcome:'Run three repeatable tests and explain how their assertions detect failure.' },
    { id:'ai-basics', label:'Generative AI fundamentals', category:'AI-assisted testing', priority:'critical', aliases:['llm fundamentals'], prerequisites:[], resourceIds:['owasp-llm'], minutes:120, activity:'Compare generated test suggestions with a manually written baseline.', outcome:'Identify three useful suggestions and three limitations with examples.' },
    { id:'prompt-design', label:'Prompt design for testing', category:'AI-assisted testing', priority:'critical', aliases:['prompt engineering'], prerequisites:['test-design','ai-basics'], resourceIds:['owasp-llm'], minutes:150, activity:'Write a constrained test-generation prompt using a synthetic feature specification.', outcome:'Record the prompt, review its output and correct at least one unsupported assumption.' },
    { id:'ai-evaluation', label:'Evaluating AI-generated tests', category:'AI-assisted testing', priority:'important', aliases:[], prerequisites:['automation','prompt-design'], resourceIds:['owasp-llm'], minutes:180, activity:'Review and execute a synthetic AI-assisted test suite.', outcome:'Produce a review with coverage gaps, false assumptions and corrected assertions.' },
    { id:'responsible-ai', label:'Responsible AI in QA', category:'AI-assisted testing', priority:'important', aliases:['ai privacy'], prerequisites:['ai-basics'], resourceIds:['owasp-llm'], minutes:90, activity:'Review a synthetic testing workflow for privacy and prompt-injection risks.', outcome:'Write a safe-input checklist and demonstrate rejection of an embedded instruction.' },
    { id:'ci', label:'Continuous integration', category:'Delivery practices', priority:'nice', aliases:['ci/cd'], prerequisites:['automation'], resourceIds:['gh-actions'], minutes:120, activity:'Draft a CI workflow that runs the local automated suite.', outcome:'Explain its trigger, test command and failure reporting.' }
  ]
} as const;
export type Catalogue = typeof catalogue;
export type CatalogueSkill = typeof catalogue.skills[number];
export function validateCatalogue() {
  const ids = new Set<string>();
  for (const s of catalogue.skills) {
    if (ids.has(s.id)) throw new Error('Duplicate skill');
    ids.add(s.id);
    for (const p of s.prerequisites) if (!ids.has(p)) throw new Error('Prerequisite must be earlier in the topological catalogue');
    for (const r of s.resourceIds) if (!catalogue.resources.some(x => x.id === r && (x.skillIds as readonly string[]).includes(s.id))) throw new Error('Invalid resource mapping');
  }
  return { version: catalogue.version, skills: ids.size, reviewed: catalogue.reviewed };
}
