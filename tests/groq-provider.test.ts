import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';
import { validateExtraction, validateRoadmapOutput } from '../src/lib/ai-output';
import { catalogue } from '../src/lib/catalogue';
import { demoState } from '../src/lib/domain';
import { reviewedPlanContext, validateReviewedPlan, mockReviewedPlan } from '../src/lib/reviewed-roadmap';
import { syntheticReviewedLibrary } from './fixtures/reviewed-planning';
import { mockPathwayOutput, validatePathwaySuggestions, type PathwayProviderInput } from '../src/lib/pathways';
import { validateResearchEnvelope } from '../src/lib/resource-preview';
import { researchedSelectionSchema } from '../src/lib/resource-discovery';
import { timedProviderResponse, providerAttemptTimeout } from '../src/lib/ai-provider';

// All HTTP responses in this file are intercepted fixtures. No real Groq request.
const envelope = (output: unknown) => new Response(JSON.stringify({
  id: 'synthetic-intercepted-request',
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }],
}));
const create = (http: typeof fetch, options = {}) => createGroqProvider({
  apiKey: 'synthetic-test-key', model: GROQ_MODEL, fetchImpl: http, ...options,
});
const context = {
  pathwayId: 'synthetic-qa', pathwayTitle: 'Synthetic QA',
  topicId: 'ci', topicTitle: 'Continuous integration',
};
const suggestions = {
  outcome: 'candidates' as const,
  results: [
    { title: 'Synthetic CI documentation', url: 'https://docs.example.org/ci', kind: 'documentation' as const },
    { title: 'Synthetic CI lesson', url: 'https://lessons.example.org/ci', kind: 'tutorial' as const },
  ],
};
const approved = { llmResourceApprovalReference: 'Synthetic LLM-only approval for intercepted tests' };
const bodyOf = (http: { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } }) =>
  JSON.parse(String((http.mock.calls[0] as unknown as [string, RequestInit])[1].body));

// Provider/validation checks. The independent page verifier is tested separately.
describe('Groq adapter — LLM-only resource mode with intercepted HTTP', () => {
  it('GR-A14: retains the existing attempt time allocation', () => {
    const search = { kind: 'resource_research' as const, phase: 'search' as const, context };
    expect(providerAttemptTimeout(search, 45000)).toBe(20000);
    expect(providerAttemptTimeout(search, 35000)).toBe(15000);
    expect(() => providerAttemptTimeout(search, 20000)).toThrow(expect.objectContaining({ code: 'DEADLINE' }));
    expect(providerAttemptTimeout({ kind: 'resource_research', phase: 'select', context, candidates: [] }, 45000)).toBe(12000);
    expect(providerAttemptTimeout({ kind: 'cv_extraction', text: 'Synthetic' }, 45000)).toBe(12000);
    expect(providerAttemptTimeout({ kind: 'cv_extraction', text: 'Synthetic' }, 8000)).toBe(5000);
  });

  it('GR-A11: distinguishes connection errors from interrupted responses', async () => {
    const input = { kind: 'cv_extraction' as const, text: 'Synthetic experience.' };
    const failed = vi.fn(async () => { throw new Error('private network details'); });
    await expect(create(failed).respond(input, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_CONNECTION_FAILED' });
    expect(failed).toHaveBeenCalledTimes(1);
    const interrupted = vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.error(new Error('private body details')); },
    })));
    await expect(create(interrupted).respond(input, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_RESPONSE_INTERRUPTED' });
    expect(interrupted).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('GR-A12: timeout stays distinct across abort races (%s)', async rejectOnAbort => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const respond = vi.fn((_input: unknown, current: AbortSignal) => {
        signal = current;
        return new Promise<never>((_, reject) => {
          if (rejectOnAbort) current.addEventListener('abort', () => reject(new Error('transport details')), { once: true });
        });
      });
      const result = timedProviderResponse({ model: 'synthetic', respond }, { kind: 'cv_extraction', text: 'Synthetic' }, 12000);
      const check = expect(result).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
      await vi.advanceTimersByTimeAsync(12000);
      await check;
      expect(signal!.aborted).toBe(true);
      expect(respond).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('GR-A13: successful timed request clears the timer', async () => {
    vi.useFakeTimers();
    try {
      const respond = vi.fn(async () => ({ skills: [] }));
      await expect(timedProviderResponse({ model: 'synthetic', respond }, { kind: 'cv_extraction', text: 'Synthetic' }, 12000))
        .resolves.toEqual({ skills: [] });
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('GR-LLM-01: missing LLM approval rejects before dispatch, even with legacy approval', async () => {
    const http = vi.fn(async () => envelope(suggestions));
    const provider = create(http, {
      nativeResearch: { approvalReference: 'Legacy fixture', maxNativeToolCalls: 2 },
      planningApprovalReference: 'Legacy fixture',
    });
    const input = { kind: 'resource_research' as const, phase: 'search' as const, context };
    expect(() => provider.checkInput!(input)).toThrow(expect.objectContaining({ code: 'RESOURCE_LIVE_DISABLED' }));
    await expect(provider.respond(input, new AbortController().signal)).rejects.toMatchObject({ code: 'RESOURCE_LIVE_DISABLED' });
    expect(http).not.toHaveBeenCalled();
  });

  it('GR-LLM-02: structured LLM suggestions require no browser tools and do not claim citations', async () => {
    const http = vi.fn(async () => envelope(suggestions));
    const found = validateResearchEnvelope(await create(http, approved).respond(
      { kind: 'resource_research', phase: 'search', context }, new AbortController().signal,
    ));
    expect(found.candidates).toHaveLength(2);
    expect(found.sources).toHaveLength(2);
    expect(found.candidates.map(candidate => candidate.url)).toEqual(suggestions.results.map(result => result.url));
    for (const candidate of found.candidates) {
      const digest = createHash('sha256').update(candidate.url).digest('hex');
      expect(candidate.sourceId).toBe(`llm-${digest}`);
      expect(candidate.id).toBe(`resource-${digest}`);
      expect(candidate.citation).toBeUndefined();
    }
    const request = bodyOf(http);
    expect(request.model).toBe(GROQ_MODEL);
    expect(request.tools).toBeUndefined();
    expect(request.tool_choice).toBeUndefined();
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.response_format.json_schema.schema.required).toEqual(['outcome', 'results']);
    expect(request.messages[0].content).toContain('Do not use Browser Search');
    expect(request.messages[1].content).not.toMatch(/email|cvText|confirmedSkillIds/);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('GR-LLM-03: tool-free selection uses inspected passages and an independent schema', async () => {
    const found = validateResearchEnvelope(await create(vi.fn(async () => envelope(suggestions)), approved).respond(
      { kind: 'resource_research', phase: 'search', context }, new AbortController().signal,
    ));
    const passages = found.candidates.map(candidate => ({
      candidateId: candidate.id,
      url: candidate.url,
      finalUrl: candidate.url,
      text: 'Continuous integration lets QA teams run checks on every change.',
      checkedAt: new Date().toISOString(),
      partial: false,
    }));
    const selected = {
      documentationId: found.candidates[0].id,
      supportingId: found.candidates[1].id,
      evidence: found.candidates.map(candidate => ({
        candidateId: candidate.id,
        topicExcerpt: 'Continuous integration lets QA teams run checks on every change.',
        access: 'public-page' as const,
        accessExcerpt: '',
      })),
    };
    const http = vi.fn(async () => envelope(selected));
    const output = await create(http, approved).respond(
      { kind: 'resource_research', phase: 'select', context, candidates: found.candidates, pages: passages },
      new AbortController().signal,
    );
    expect(researchedSelectionSchema.parse(output)).toEqual(selected);
    const request = bodyOf(http);
    expect(request.tools).toBeUndefined();
    expect(request.response_format.json_schema.schema.required).toContain('evidence');
    expect(JSON.parse(request.messages[1].content).inspectedPages).toHaveLength(2);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no documentation', { outcome: 'candidates', results: [suggestions.results[1], suggestions.results[1]] }, 'RESOURCE_CONTENT_GAP'],
    ['content gap', { outcome: 'content_gap', results: [] }, 'RESOURCE_CONTENT_GAP'],
    ['duplicate page via fragment', { outcome: 'candidates', results: [suggestions.results[0], { ...suggestions.results[1], url: 'https://docs.example.org/ci#section' }] }, 'DUPLICATE_RESOURCE'],
    ['insecure URL', { outcome: 'candidates', results: [suggestions.results[0], { ...suggestions.results[1], url: 'http://lessons.example.org/ci' }] }, 'INVALID_RESOURCE_URL'],
  ])('GR-LLM-04: rejects %s with one provider response', async (_label, output, expectedCode) => {
    const http = vi.fn(async () => envelope(output));
    await expect(create(http, approved).respond(
      { kind: 'resource_research', phase: 'search', context }, new AbortController().signal,
    )).rejects.toMatchObject({ code: expectedCode });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('GR-LLM-05: unknown LLM output fields are rejected by the strict parser', async () => {
    const http = vi.fn(async () => envelope({ ...suggestions, privateText: 'unexpected' }));
    await expect(create(http, approved).respond(
      { kind: 'resource_research', phase: 'search', context }, new AbortController().signal,
    )).rejects.toMatchObject({ name: 'ZodError' });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('GR-A1: CV extraction preserves minimized input and strict JSON-schema processing', async () => {
    const text = 'I designed boundary and negative test cases for a synthetic sign-in form.';
    const http = vi.fn(async () => envelope({ skills: [{ skillId: 'test-design', label: 'Test design', evidenceExcerpt: text }] }));
    const result = await create(http).respond({ kind: 'cv_extraction', text }, new AbortController().signal);
    expect(validateExtraction(result, text).map(skill => skill.skillId)).toEqual(['test-design']);
    expect(http).toHaveBeenCalledTimes(1);
    const [url, options] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer synthetic-test-key' });
    const request = bodyOf(http);
    expect(request.response_format.json_schema.schema.required).toEqual(['skills']);
    expect(request.messages[0].content).toContain('untrusted data');
    expect(request.messages[1].content).toContain(text);
    expect(request.tools).toBeUndefined();
    expect(request.stream).toBe(false);
  });

  it('GR-A2: existing legacy mock roadmap validator remains covered', async () => {
    const state = demoState();
    const output = {
      outcome: 'plan', reason: null, constraintCode: null, deferredSkillIds: [],
      tasks: catalogue.skills.slice(3).map((skill, index) => ({
        week: index + 1, kind: index === 4 ? 'practical' : 'learning',
        title: skill.label, activity: skill.activity, completionCriterion: skill.outcome,
        skillIds: [skill.id], resourceIds: [...skill.resourceIds], estimatedMinutes: skill.minutes,
      })),
    };
    const http = vi.fn(async () => envelope(output));
    const result = await create(http).respond(
      { kind: 'roadmap_generation', profile: { hoursPerWeek: 5 }, skills: state.skills }, new AbortController().signal,
    );
    expect(validateRoadmapOutput(result, { ...state.profile, hoursPerWeek: 5 }, state.skills).tasks).toHaveLength(5);
    expect(bodyOf(http).messages[1].content).not.toMatch(/minimizedCvText|userId|email|https?:\/\//);
  });

  it('GR-A6: reviewed roadmap uses only server-compiled activities', async () => {
    const library = syntheticReviewedLibrary(4, true);
    const planning = reviewedPlanContext({
      library, selection: { directionId: 'qa', deferredCapabilityIds: [] }, inventory: [], hoursPerWeek: 5,
      resources: library.capabilities.map(item => ({ topicId: item.id, documentationId: `${item.id}-doc`, supportingId: `${item.id}-lesson` })),
    });
    const http = vi.fn(async () => envelope(mockReviewedPlan(planning)));
    const output = await create(http, { planningApprovalReference: 'Synthetic planning test fixture' }).respond(
      { kind: 'reviewed_roadmap', context: planning }, new AbortController().signal,
    );
    expect(validateReviewedPlan(planning, output).tasks).toHaveLength(planning.activities.length);
    const request = bodyOf(http);
    const prompt = JSON.parse(request.messages[1].content);
    expect(request.response_format.json_schema.strict).toBe(true);
    expect(request.tools).toBeUndefined();
    expect(prompt.activities).toHaveLength(planning.activities.length);
    expect(prompt.activities[0].resourceIds).toEqual(planning.activities[0].task.resourceIds);
    expect(request.messages[0].content).toMatch(/exactly once/);
    expect(request.messages[1].content).not.toMatch(/email|cvText|https?:\/\//);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('GR-A7: QA-direction response stays subject to validated IDs', async () => {
    const input: PathwayProviderInput = {
      kind: 'pathway_suggestions', preferences: { interests: ['delivery'], preferredWork: 'automation', codingPreference: 'some' },
      confirmedSkillIds: ['automation'], hoursPerWeek: 5,
    };
    const http = vi.fn(async () => envelope(mockPathwayOutput(input)));
    const output = await create(http, { planningApprovalReference: 'Synthetic planning test fixture' }).respond(input, new AbortController().signal);
    expect(validatePathwaySuggestions(output, input.confirmedSkillIds)).toHaveLength(1);
    expect(bodyOf(http).response_format.json_schema.schema.required).toEqual(['suggestions']);
    expect(bodyOf(http).tools).toBeUndefined();
  });

  it.each([401, 429])('GR-A3: HTTP %i makes one attempt without a hidden retry', async status => {
    const http = vi.fn(async () => new Response('private echoed error must not surface', { status }));
    await expect(create(http).respond({ kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal))
      .rejects.toMatchObject({ code: status === 429 ? 'PROVIDER_RATE_LIMIT' : 'PROVIDER_UNAVAILABLE' });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it.each([400, 401, 429, 500])('logs only operation and HTTP status for rejected roadmap request %i', async status => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const http = vi.fn(async () => new Response('synthetic private response and credentials', { status }));
      const library = syntheticReviewedLibrary(2);
      const context = reviewedPlanContext({library, selection:{directionId:'qa',deferredCapabilityIds:[]},inventory:[],hoursPerWeek:6,resources:library.capabilities.map(item=>({topicId:item.id,documentationId:`${item.id}-doc`}))});
      await expect(create(http, { planningApprovalReference: 'Synthetic planning test fixture' }).respond(
        { kind: 'reviewed_roadmap', context }, new AbortController().signal,
      )).rejects.toBeDefined();
      expect(log).toHaveBeenCalledExactlyOnceWith('[groq-http-error]', { operation: 'reviewed_roadmap', status });
      expect(http).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it.each([
    [{ choices: [{ finish_reason: 'content_filter', message: { content: null } }] }, 'PROVIDER_REFUSED'],
    [{ choices: [{ finish_reason: 'stop', message: { refusal: 'refused', content: null } }] }, 'PROVIDER_REFUSED'],
    [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, 'PROVIDER_INCOMPLETE'],
    [{ choices: [{ finish_reason: 'stop', message: { content: '{' } }] }, 'PROVIDER_INCOMPLETE'],
    [null, 'PROVIDER_INCOMPLETE'],
  ])('GR-A4: rejects malformed/refused completion %#', async (raw, code) => {
    await expect(create(vi.fn(async () => new Response(JSON.stringify(raw)))).respond(
      { kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal,
    )).rejects.toMatchObject({ code });
  });

  it('GR-A5: oversized provider request and cancellation prevent dispatch', async () => {
    const http = vi.fn(async () => envelope({ skills: [] }));
    expect(() => create(http, { maxRequestBytes: 1 }).checkInput!({ kind: 'cv_extraction', text: 'Synthetic text' })).toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(create(http).respond({ kind: 'cv_extraction', text: 'Synthetic text' }, controller.signal)).rejects.toThrow();
    expect(http).not.toHaveBeenCalled();
  });
});
