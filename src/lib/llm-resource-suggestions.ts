
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from './domain';
import { resourceCandidates } from './resource-discovery';

const suggestionSchema = z.object({
  outcome: z.enum(['candidates', 'content_gap']),
  results: z.array(z.object({
    title: z.string().trim().min(1).max(240),
    url: z.string().url().max(2048),
    kind: z.enum(['documentation', 'tutorial', 'course', 'video']),
  }).strict()).max(4),
}).strict();

/**
 * Convert LLM suggestions into candidate records.
 * These are NOT browser-verified sources.
 */
export function parseLLMResourceSuggestions(input: unknown) {
  const parsed = suggestionSchema.parse(input);

  if (parsed.outcome === 'content_gap') {
    if (parsed.results.length !== 0) {
      throw new DomainError('INVALID_OUTPUT', 'Invalid content-gap response.', 502);
    }
    throw new DomainError(
      'RESOURCE_CONTENT_GAP',
      'The AI could not suggest a suitable resource pair.',
      422
    );
  }

  if (
    parsed.results.length < 2 ||
    !parsed.results.some(item => item.kind === 'documentation') ||
    !parsed.results.some(item => item.kind !== 'documentation')
  ) {
    throw new DomainError(
      'RESOURCE_CONTENT_GAP',
      'A documentation page and supporting resource are required.',
      422
    );
  }

  const results = parsed.results.map(item => ({
    ...item,
    sourceId: `llm-${createHash('sha256').update(item.url).digest('hex')}`,
    publisher: new URL(item.url).hostname,
  }));

  const sources = results.map(item => ({
    id: item.sourceId,
    url: item.url,
  }));

  // Screens URL structure and duplicates.
  // This does not confirm page availability or relevance.
  resourceCandidates(results, sources);

  return { results, sources };
}