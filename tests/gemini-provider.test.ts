import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGeminiProvider } from '../src/lib/gemini-provider';
import { validateExtraction, validateRoadmapOutput } from '../src/lib/ai-output';
import { mockProvider } from '../src/lib/ai-provider';
import { demoState } from '../src/lib/domain';

const envelope = (output: unknown) => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(output) }] } }] }), { status: 200 });
beforeEach(() => {
  vi.stubEnv('AI_MODE', 'mock');
  vi.stubEnv('AI_SIGNING_SECRET', 'synthetic-gemini-adapter-test-secret');
  vi.stubEnv('AI_BUDGET_ID', 'synthetic-budget');
});
afterEach(() => vi.unstubAllEnvs());

describe('Gemini REST adapter with intercepted fetch; no live AI', () => {
  it('sends minimized CV data with a JSON schema, then returns evidence for server validation', async () => {
    const text = 'I designed boundary and negative test cases for a synthetic sign-in form.';
    const fetchImpl = vi.fn(async () => envelope({ skills: [{ skillId: 'test-design', label: 'Test design', evidenceExcerpt: text }] }));
    const provider = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: fetchImpl as typeof fetch });
    const output = await provider.respond({ kind: 'cv_extraction', text }, new AbortController().signal);
    expect(validateExtraction(output, text).map(item => item.skillId)).toEqual(['test-design']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent');
    expect(options.headers).toMatchObject({ 'x-goog-api-key': 'synthetic-test-key' });
    const request = JSON.parse(options.body as string);
    expect(request.systemInstruction.parts[0].text).toContain('untrusted data');
    expect(request.contents[0].parts[0].text).toContain(text);
    expect(request.generationConfig.responseFormat.text.mimeType).toBe('application/json');
    expect(request.generationConfig.responseFormat.text.schema.required).toEqual(['skills']);
    expect(request.tools).toBeUndefined();
  });

  it('accepts a roadmap response only through existing server validation', async () => {
    const state = demoState();
    const input = { kind: 'roadmap_generation' as const, profile: { hoursPerWeek: state.profile.hoursPerWeek }, skills: state.skills.map(skill => ({ canonicalSkillId: skill.canonicalSkillId })) };
    const proposal = await mockProvider.respond(input, new AbortController().signal);
    const fetchImpl = vi.fn(async () => envelope(proposal));
    const provider = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: fetchImpl as typeof fetch });
    const output = await provider.respond(input, new AbortController().signal);
    expect(validateRoadmapOutput(output, state.profile, state.skills).tasks.length).toBeGreaterThanOrEqual(4);
    const request = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(request.contents[0].parts[0].text).not.toMatch(/minimizedCvText|userId|email|https?:\/\//);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry an invalid key or a refused response inside the adapter', async () => {
    const rejected = vi.fn(async () => new Response('', { status: 401 }));
    const authProvider = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: rejected as typeof fetch });
    await expect(authProvider.respond({ kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: false });
    expect(rejected).toHaveBeenCalledTimes(1);
    const refused = vi.fn(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    const refusalProvider = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: refused as typeof fetch });
    await expect(refusalProvider.respond({ kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_REFUSED', retryable: false });
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it('treats incomplete JSON and malformed response envelopes as controlled failures', async () => {
    const incomplete = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{' }] } }] }), { status: 200 }));
    const provider = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: incomplete as typeof fetch });
    await expect(provider.respond({ kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_INCOMPLETE' });
    expect(incomplete).toHaveBeenCalledTimes(1);
    const malformed = createGeminiProvider({ apiKey: 'synthetic-test-key', model: 'gemini-flash-latest', fetchImpl: vi.fn(async () => new Response('null')) as typeof fetch });
    await expect(malformed.respond({ kind: 'cv_extraction', text: 'I used Playwright.' }, new AbortController().signal)).rejects.toMatchObject({ code: 'PROVIDER_INCOMPLETE' });
  });
});
