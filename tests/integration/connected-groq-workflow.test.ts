import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  admitGoogle, getState, patchTask, putConsent, putPathwayPreferences,
  putProfile, putSkills, type Claims,
} from '../../src/lib/store';
import { generateRoadmap, researchReviewedResources, suggestPathways } from '../../src/lib/ai-operations';
import { activateRequirementSnapshot, registerRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { getReviewedGaps, saveReviewedDirection } from '../../src/lib/reviewed-direction';
import { configurationVersion } from '../../src/lib/ai-execution';
import { catalogue } from '../../src/lib/catalogue';
import { inspectResourcePages } from '../../src/lib/resource-page-verifier';
import { mockReviewedPlan, type ReviewedPlanContext } from '../../src/lib/reviewed-roadmap';
import { syntheticLLMWorkflowConfiguration, syntheticWorkflowConfiguration } from '../fixtures/groq-configuration';
import { syntheticReviewedLibrary } from '../fixtures/reviewed-planning';

// Isolated real PostgreSQL; model HTTP, DNS and page bodies are intercepted.
// No real Groq request, Google OAuth or live website verification occurs.
const url = process.env.TEST_DATABASE_URL;
if (
  !url ||
  !/^qa_pathways_/.test(new URL(url).pathname.slice(1)) ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
) {
  throw new Error('Use an isolated local qa_pathways_* TEST_DATABASE_URL.');
}

const first = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const second = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
let claims: Claims;
let budgetId: string;
let oldPlanId: string;
let library = syntheticReviewedLibrary(2);
let pilot = syntheticLLMWorkflowConfiguration();

type Defect = 'insecure-url' | 'content-gap' | 'bad-excerpt' | 'unusable-extra';
type SuggestedResource = { title: string; url: string; kind: 'documentation' | 'tutorial' | 'video' };

const response = (output: unknown) => new Response(JSON.stringify({
  id: 'synthetic-intercepted-request',
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }],
}));

const inspector: typeof inspectResourcePages = (context, candidates, signal) =>
  inspectResourcePages(context, candidates, signal, {
    resolve: async () => [{ address: '93.184.215.14', family: 4 }],
    read: async () => ({
      status: 200,
      headers: { 'content-type': 'text/html' },
      body: `<main>${context.topicTitle} explains synthetic QA topic checks, setup, expected outcomes and documentation.</main>`,
    }),
  });

function interceptedProvider(defect?: Defect) {
  const http = vi.fn(async (_url: unknown, init?: RequestInit) => {
    expect(String(_url)).toBe('https://api.groq.com/openai/v1/chat/completions');
    const budget = await second.fundingBudget.findUniqueOrThrow({ where: { id: budgetId } });
    expect(budget.reserved).toBeGreaterThanOrEqual(http.mock.calls.length);

    const body = JSON.parse(String(init?.body));
    expect(body.tools).toBeUndefined();
    expect(body.response_format?.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    const prompt = JSON.parse(body.messages[1].content);
    expect(prompt).not.toHaveProperty('email');
    expect(prompt).not.toHaveProperty('cvText');

    if (body.response_format.json_schema.name === 'resource_research') {
      if (!('candidates' in prompt)) {
        // First dispatch: an ordinary LLM recommendation, not native Browser Search.
        expect(prompt.learningScope.includes).toEqual(
          library.capabilities.find(item => item.id === prompt.topicId)!.scope!.includes,
        );
        if (defect === 'content-gap') return response({ outcome: 'content_gap', results: [] });

        const results: SuggestedResource[] = [
          { title: `${prompt.topicTitle} documentation`, url: `https://docs.example.org/topics/${prompt.topicId}`, kind: 'documentation' },
          { title: `${prompt.topicTitle} lesson`, url: `https://lessons.example.org/topics/${prompt.topicId}`, kind: 'tutorial' },
        ];
        if (defect === 'insecure-url') results[0].url = `http://docs.example.org/topics/${prompt.topicId}`;
        if (defect === 'unusable-extra') results.push({
          title: 'Unavailable extra', url: `https://broken.example.org/topics/${prompt.topicId}`, kind: 'video',
        });
        return response({ outcome: 'candidates', results });
      }

      // Second dispatch: inspected pages and server-generated IDs only.
      expect(prompt.inspectedPages).toBeDefined();
      if (defect === 'unusable-extra') expect(prompt.candidates).toHaveLength(2);
      const docs = prompt.candidates.find((item: { kind: string }) => item.kind === 'documentation');
      const support = prompt.candidates.find((item: { kind: string }) => item.kind !== 'documentation');
      expect(docs).toBeDefined();
      expect(support).toBeDefined();
      return response({
        documentationId: docs.id,
        supportingId: support.id,
        evidence: [docs, support].map((candidate: { id: string }) => ({
          candidateId: candidate.id,
          topicExcerpt: defect === 'bad-excerpt'
            ? 'Invented unrelated topic evidence.'
            : prompt.inspectedPages.find((page: { candidateId: string }) => page.candidateId === candidate.id).text,
          access: 'public-page',
          accessExcerpt: '',
        })),
      });
    }

    if (body.response_format.json_schema.name === 'pathway_suggestions') {
      return response({ suggestions: [{
        title: 'Synthetic QA progression',
        why: 'Matches the supplied QA interests.',
        capabilityIds: prompt.library.directions[0].capabilityIds,
        transferableSkillIds: [],
        practicalWork: 'Plan a synthetic QA investigation.',
        uncertainty: 'Provisional suggestions do not demonstrate competence.',
      }] });
    }

    const { activities, ...context } = prompt;
    return response(mockReviewedPlan({
      ...context,
      activities: activities.map(({ id, dependencies, ...task }: { id: string; dependencies: string[] }) => ({ id, dependencies, task })),
    } as ReviewedPlanContext));
  });
  vi.stubGlobal('fetch', http);
  return http;
}

const research = (topicId = library.capabilities[0].id, key = crypto.randomUUID()) => ({
  operationKey: key, expectedPlanningRevision: 3, topicId,
});
const planRequest = (key = crypto.randomUUID()) => ({
  operationKey: key, expectedPlanningRevision: 3,
  expectedCatalogueVersion: catalogue.version, introductoryPlanAcknowledged: true,
});
async function renewConsent() {
  const state = await getState(first, claims);
  await putConsent(first, claims, {
    purpose: 'roadmap_generation', granted: true, policyVersion: state.processing!.policyVersion,
  });
}

beforeEach(async () => {
  vi.stubEnv('AI_MODE', 'groq');
  vi.stubEnv('GROQ_FREE_PLAN_CONFIRMED', 'true');
  vi.stubEnv('GROQ_API_KEY', 'synthetic-not-a-credential');
  vi.stubEnv('AI_SIGNING_SECRET', 'synthetic-connected-workflow-signing-secret');
  budgetId = `connected-${crypto.randomUUID()}`;
  vi.stubEnv('AI_BUDGET_ID', budgetId);
  pilot = syntheticLLMWorkflowConfiguration();
  await first.fundingBudget.create({ data: {
    id: budgetId, mode: 'groq', currency: 'REQUESTS',
    pricingVersion: configurationVersion(pilot),
    ceiling: pilot.ceilingRequests, expiresAt: new Date(pilot.expiresAt), configuration: pilot,
  } });
  await first.catalogueRevision.upsert({
    where: { id: 'active' }, create: { id: 'active', version: catalogue.version }, update: {},
  });
  library = syntheticReviewedLibrary(2);
  await registerRequirementSnapshot(first, library, 'synthetic connected workflow review fixture');
  await activateRequirementSnapshot(first, library.version);
  const email = `connected-${crypto.randomUUID()}@example.invalid`;
  await first.invitation.create({ data: { email } });
  const user = await admitGoogle(first, crypto.randomUUID(), email, 'Synthetic Workflow Learner');
  claims = { id: user.id, email, sessionVersion: 0 };
  await putProfile(first, claims, { currentRole: 'Synthetic QA', yearsExperience: 7, hoursPerWeek: 5, expectedRevision: 0 });
  await putSkills(first, claims, { entries: [], removals: [], expectedRevision: 1 });
  await renewConsent();
  await saveReviewedDirection(first, claims, {
    version: library.version, directionId: 'qa', deferredCapabilityIds: [], expectedPlanningRevision: 2,
  });
  const old = await first.roadmap.create({ data: {
    userId: claims.id, inputRevision: 2, catalogueVersion: catalogue.version,
    tasks: { create: [1, 2, 3, 4].map(week => ({
      position: week - 1, week, kind: 'practical', title: 'Prior synthetic activity',
      activity: 'Prior work', completionCriterion: 'Prior result',
      skillIds: [], resourceIds: [], estimatedMinutes: 15, completed: true,
    })) },
  } });
  oldPlanId = old.id;
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected outbound request'); }));
});

afterEach(async () => {
  await first.user.deleteMany({ where: { id: claims.id } });
  await first.invitation.deleteMany({ where: { email: claims.email } });
  await first.fundingBudget.deleteMany({ where: { id: budgetId } });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await first.requirementActivation.deleteMany({ where: { id: 'active' } });
  await first.$disconnect();
  await second.$disconnect();
});

it('CW-01: catalogue references and one mocked Groq plan preserve archived progress', async () => {
  const http = interceptedProvider();
  const result = await generateRoadmap(first, claims, planRequest());
  expect(result.code).toBe('PLAN_SAVED');
  expect(http).toHaveBeenCalledTimes(1);
  expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(1);
  expect((await second.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
  expect(result.state.roadmap!.reviewed!.resources).toHaveLength(2);
  for(const topic of result.state.roadmap!.reviewed!.resources){
    expect(topic.resources.length).toBeGreaterThanOrEqual(1);
    expect(topic.resources.every(item=>item.reviewStatus==='catalogue_reference')).toBe(true);
  }
  const old=await second.roadmap.findUniqueOrThrow({where:{id:oldPlanId},include:{tasks:true}});
  expect(old.status).toBe('archived');expect(old.tasks.every(task=>task.completed)).toBe(true);
  expect(result.state.roadmap!.tasks.every(task=>!task.completed)).toBe(true);
  const task=result.state.roadmap!.tasks[0];
  await patchTask(first,claims,task.id,{completed:true,expectedTaskRevision:0});
  expect((await getState(second,claims)).roadmap!.tasks[0].completed).toBe(true);
  expect((await generateRoadmap(second,claims,planRequest(result.operation!.key))).code).toBe('REPLAY');
  expect(http).toHaveBeenCalledTimes(1);
});

it('CW-02: missing LLM approval rejects before any operation, even if native Browser Search approval exists', async () => {
  // A previously valid native-search approval cannot enable the new LLM-only provider.
  const legacy = { ...syntheticWorkflowConfiguration(), expiresAt: pilot.expiresAt };
  await first.fundingBudget.update({ where: { id: budgetId }, data: {
    configuration: legacy,
    pricingVersion: configurationVersion(legacy),
  } });
  await renewConsent();
  await expect(researchReviewedResources(first, claims, research(), undefined, inspector))
    .rejects.toMatchObject({ code: 'RESOURCE_LIVE_DISABLED' });
  expect(await first.aIOperation.count({ where: { userId: claims.id } })).toBe(0);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([false, true])('CW-08: no reviewed direction prevents legacy live fallback; full mock inventory=%s', async fullInventory => {
  await saveReviewedDirection(first, claims, {
    version: library.version, directionId: null, deferredCapabilityIds: [], expectedPlanningRevision: 3,
  });
  let revision = 4;
  if (fullInventory) {
    await putSkills(first, claims, {
      entries: catalogue.skills.map(skill => ({ canonicalSkillId: skill.id, label: skill.label })),
      removals: [], expectedRevision: revision,
    });
    revision++;
  }
  const before = (await getState(first, claims)).roadmap;
  await expect(generateRoadmap(first, claims, { ...planRequest(), expectedPlanningRevision: revision }))
    .rejects.toMatchObject({ code: 'DIRECTION_REQUIRED' });
  expect(fetch).not.toHaveBeenCalled();
  expect(await first.aIOperation.count({ where: { userId: claims.id } })).toBe(0);
  expect((await first.fundingBudget.findUniqueOrThrow({ where: { id: budgetId } })).reserved).toBe(0);
  expect((await getState(second, claims)).roadmap).toEqual(before);
  const task = before!.tasks[0];
  await patchTask(first, claims, task.id, { completed: false, expectedTaskRevision: task.revision });
  expect((await getState(second, claims)).roadmap!.tasks[0].completed).toBe(false);
});

it.each(['insecure-url', 'content-gap', 'bad-excerpt'] as const)(
  'CW-03-%s: failed LLM resource research preserves saved pair and existing plan', async defect => {
    interceptedProvider();
    await researchReviewedResources(first, claims, research(), undefined, inspector);
    const before = await getState(first, claims);
    const http = interceptedProvider(defect);
    await expect(researchReviewedResources(first, claims, research(), undefined, inspector))
      .rejects.toMatchObject({ code: defect === 'insecure-url' ? 'INVALID_RESOURCE_URL' : defect === 'content-gap' ? 'RESOURCE_CONTENT_GAP' : 'RESOURCE_VERIFICATION_REQUIRED' });
    const after = await getState(second, claims);
    expect(after.reviewedDirection!.resourcePreviews).toEqual(before.reviewedDirection!.resourcePreviews);
    expect(after.roadmap).toEqual(before.roadmap);
    expect(http).toHaveBeenCalledTimes(defect === 'bad-excerpt' ? 2 : 1);
  },
);

it('CW-04: consent withdrawal after LLM suggestions prevents selection and late save', async () => {
  const http = interceptedProvider();
  const withdraw: typeof inspectResourcePages = async (context, candidates, signal) => {
    await putConsent(second, claims, {
      purpose: 'roadmap_generation', granted: false,
      policyVersion: (await getState(second, claims)).processing!.policyVersion,
    });
    return inspector(context, candidates, signal);
  };
  await expect(researchReviewedResources(first, claims, research(), undefined, withdraw))
    .rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
  expect(http).toHaveBeenCalledTimes(1);
  expect((await getState(second, claims)).roadmap!.id).toBe(oldPlanId);
  expect((await getState(second, claims)).reviewedDirection!.resourcePreviews).toEqual([]);
});

it('CW-05: profile change after resource suggestions blocks second model call', async () => {
  const http = interceptedProvider();
  const change: typeof inspectResourcePages = async (context, candidates, signal) => {
    await putProfile(second, claims, {
      currentRole: 'Synthetic QA', yearsExperience: 7, hoursPerWeek: 6, expectedRevision: 3,
    });
    return inspector(context, candidates, signal);
  };
  await expect(researchReviewedResources(first, claims, research(), undefined, change))
    .rejects.toMatchObject({ code: 'STALE_INPUT' });
  expect(http).toHaveBeenCalledTimes(1);
  expect((await getState(second, claims)).roadmap!.id).toBe(oldPlanId);
});

it('CW-06: structured QA direction suggestions lead to reviewed gap comparison', async () => {
  await saveReviewedDirection(first, claims, {
    version: library.version, directionId: null, deferredCapabilityIds: [], expectedPlanningRevision: 3,
  });
  await putPathwayPreferences(first, claims, {
    preferences: { interests: ['ai-quality'], preferredWork: 'analysis', codingPreference: 'some' },
    expectedPlanningRevision: 4,
  });
  const http = interceptedProvider();
  const result = await suggestPathways(first, claims, {
    operationKey: crypto.randomUUID(), expectedPlanningRevision: 5,
  });
  const suggestion = result.state.pathwayExploration!.suggestions[0];
  expect(suggestion).toMatchObject({
    libraryVersion: library.version, reviewedDirectionId: 'qa', generationMode: 'groq',
  });
  expect(suggestion.capabilityIds).toEqual(library.capabilities.map(item => item.id));
  expect(result.state.pathwayExploration!.current).toBe(true);
  await saveReviewedDirection(first, claims, {
    version: suggestion.libraryVersion, directionId: suggestion.reviewedDirectionId,
    deferredCapabilityIds: [], expectedPlanningRevision: 5,
  });
  expect((await getReviewedGaps(second, claims))!.mandatoryGapIds).toHaveLength(2);
  expect(http).toHaveBeenCalledTimes(1);
});

it('CW-07: unusable extra suggestion is discarded before model selection', async () => {
  const http = interceptedProvider('unusable-extra');
  const inspect: typeof inspectResourcePages = (context, candidates, signal) =>
    inspectResourcePages(context, candidates, signal, {
      resolve: async () => [{ address: '93.184.215.14', family: 4 }],
      read: async pageUrl => ({
        status: pageUrl.hostname === 'broken.example.org' ? 403 : 200,
        headers: { 'content-type': 'text/html' },
        body: `<main>${context.topicTitle} explains synthetic checks and expected results.</main>`,
      }),
    });
  const result = await researchReviewedResources(first, claims, research(), undefined, inspect);
  expect(result.code).toBe('RESOURCES_READY');
  expect(http).toHaveBeenCalledTimes(2);
  expect(await first.aIAttempt.count({ where: { operation: { userId: claims.id } } })).toBe(2);
  expect(result.state.reviewedDirection!.resourcePreviews[0].resources).toHaveLength(2);
  expect(result.state.roadmap!.id).toBe(oldPlanId);
});
