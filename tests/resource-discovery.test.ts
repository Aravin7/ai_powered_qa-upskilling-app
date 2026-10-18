import { describe, expect, it } from 'vitest';
import { resourceCandidates, resourceResearchPrompt, validateDiscoveredPair } from '../src/lib/resource-discovery';
import { groqResourceResearchRequest } from '../src/lib/groq-resource-research';

const context = { pathwayId: 'synthetic-qa-ci', pathwayTitle: 'QA automation with CI/CD', topicId: 'synthetic-ci', topicTitle: 'Run browser tests in CI' };
const results = [
  { sourceId: 'native-source-1', title: 'Synthetic CI documentation', url: 'https://docs.example.org/testing/ci', publisher: 'Synthetic Docs', kind: 'documentation' },
  { sourceId: 'native-source-2', title: 'Synthetic CI lesson', url: 'https://courses.example.org/lessons/browser-ci', publisher: 'Synthetic Lessons', kind: 'tutorial' },
];
const now = new Date('2026-10-17T09:00:00.000Z');
const sources = results.map(result => ({ id: result.sourceId, url: result.url }));
const candidates = resourceCandidates(results, sources);
const selection = { documentationId: candidates[0].id, supportingId: candidates[1].id };
const checks = candidates.map(candidate => ({ candidateId: candidate.id, url: candidate.url, topicId: context.topicId, available: true, topicRelevant: true, officialDocumentation: candidate.kind === 'documentation', detectedKind: candidate.kind, accessNote: 'Synthetic free lesson; no account.', checkedAt: now.toISOString() }));

describe('US15 / dynamic resource contracts - synthetic search and verification only, no network or live AI', () => {
  it('RS-01: uses the selected direction/topic and accepts new publishers outside the old catalogue', () => {
    const request = groqResourceResearchRequest(context);
    expect(JSON.parse(request.messages[1].content)).toEqual(context);
    expect(request.tools).toEqual([{ type: 'browser_search' }]);
    expect(request.tool_choice).toBe('required');
    expect(request).not.toHaveProperty('response_format');
    const pair = validateDiscoveredPair(context, results, selection, checks, sources, now);
    expect(pair.resources.map(resource => resource.url)).toEqual(results.map(result => result.url));
    expect(pair.resources.every(resource => resource.reviewStatus === 'automatically_checked')).toBe(true);
    expect(pair.professionalReview).toBeNull();
  });
  it('RS-02: rejects raw-CV/contact fields in the search context', () => {
    expect(() => resourceResearchPrompt({ ...context, cvText: 'synthetic private text', email: 'synthetic@example.org' })).toThrow();
  });
  it('RS-03: rejects model-invented IDs and URL fields rather than accepting hallucinated resources', () => {
    expect(() => validateDiscoveredPair(context, results, { ...selection, supportingId: 'invented' }, checks, sources, now)).toThrow(/returned by search/);
    expect(() => validateDiscoveredPair(context, results, { ...selection, url: 'https://invented.example.org' }, checks, sources, now)).toThrow();
  });
  it('RS-04: requires a distinct documentation page and supporting material', () => {
    expect(() => validateDiscoveredPair(context, results, { ...selection, supportingId: selection.documentationId }, checks, sources, now)).toThrow();
    expect(() => validateDiscoveredPair(context, results, { documentationId: selection.supportingId, supportingId: selection.documentationId }, checks, sources, now)).toThrow();
  });
  it.each(['http://docs.example.org/ci', 'https://127.0.0.1/ci', 'https://[::1]/ci', 'https://localhost/ci', 'https://metadata.internal/ci', 'https://user:secret@docs.example.org/ci', 'https://docs.example.org:8443/ci'])('RS-05: screens unsupported URL %s without fetching it', url => {
    expect(() => resourceCandidates([{ ...results[0], url }], [{ id: results[0].sourceId, url }])).toThrow(/unsupported resource URL/);
  });
  it('RS-06: rejects duplicate pages disguised with different fragments', () => {
    const duplicates = [results[0], { ...results[1], url: `${results[0].url}#another-section` }];
    expect(() => resourceCandidates(duplicates, duplicates.map(result => ({ id: result.sourceId, url: result.url })))).toThrow(/duplicate/);
  });
  it.each([
    { available: false }, { topicRelevant: false }, { topicId: 'different-topic' },
    { url: 'https://unrelated.example.org/page' }, { detectedKind: 'documentation' },
    { checkedAt: '2026-10-17T08:59:14.999Z' }, { checkedAt: '2026-10-17T09:00:00.001Z' },
  ])('RS-07: fails the whole pair for unavailable, irrelevant, unbound or stale checks %#', change => {
    expect(() => validateDiscoveredPair(context, results, selection, [checks[0], { ...checks[1], ...change }], sources, now)).toThrow();
  });
  it('RS-10: a documentation label alone cannot establish official documentation', () => {
    expect(() => validateDiscoveredPair(context, results, selection, [{ ...checks[0], officialDocumentation: false }, checks[1]], sources, now)).toThrow();
  });
  it('RS-08: rejects duplicate verification evidence', () => {
    expect(() => validateDiscoveredPair(context, results, selection, [checks[0], checks[0]], sources, now)).toThrow();
  });
  it('RS-09: rejects oversized search output instead of silently truncating it', () => {
    expect(() => resourceCandidates(Array.from({ length: 21 }, (_, index) => ({ ...results[0], url: `https://docs.example.org/ci/${index}` })), sources)).toThrow();
  });
  it('RS-11: rejects missing native-tool sources rather than trusting model citations', () => {
    expect(() => resourceCandidates(results, [])).toThrow(/native research tool/);
  });
  it('RS-12: rejects a source ID used for a different URL', () => {
    expect(() => resourceCandidates([{ ...results[0], url: 'https://invented.example.org/page' }], sources)).toThrow(/native research tool/);
  });
});
