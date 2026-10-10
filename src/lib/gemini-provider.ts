import { AI_LIMITS } from './ai-config';
import { ProviderFailure, type AIProvider, type ProviderInput } from './ai-provider';
import { providerRequest } from './ai-provider-request';

type Fetch = typeof fetch;
type GeminiOptions = { apiKey: string; model: string; fetchImpl?: Fetch };

const text = (maxLength: number) => ({ type: 'string', description: `At most ${maxLength} characters.` });
const stringArray = (maxItems: number) => ({ type: 'array', items: { type: 'string' }, maxItems });
const extractionFormat = {
  type: 'object', additionalProperties: false, required: ['skills'],
  properties: { skills: { type: 'array', maxItems: AI_LIMITS.candidates, items: {
    type: 'object', additionalProperties: false, required: ['skillId', 'label', 'evidenceExcerpt'],
    properties: { skillId: { type: ['string', 'null'] }, label: text(100), evidenceExcerpt: text(400) },
  } } },
};
const task = {
  type: 'object', additionalProperties: false,
  required: ['week', 'kind', 'title', 'activity', 'completionCriterion', 'skillIds', 'resourceIds', 'estimatedMinutes'],
  properties: {
    week: { type: 'integer', minimum: 1, maximum: 12 }, kind: { type: 'string', enum: ['learning', 'practical'] },
    title: text(120), activity: text(600), completionCriterion: text(400),
    skillIds: stringArray(8), resourceIds: stringArray(8), estimatedMinutes: { type: 'integer', minimum: 1 },
  },
};
const roadmapFormat = { anyOf: [
  { type: 'object', additionalProperties: false, required: ['outcome', 'reason', 'constraintCode', 'deferredSkillIds', 'tasks'],
    properties: { outcome: { type: 'string', enum: ['plan'] }, reason: { type: ['null'] }, constraintCode: { type: ['null'] },
      deferredSkillIds: stringArray(8), tasks: { type: 'array', minItems: 1, maxItems: 60, items: task } } },
  { type: 'object', additionalProperties: false, required: ['outcome', 'reason', 'constraintCode', 'deferredSkillIds', 'tasks'],
    properties: { outcome: { type: 'string', enum: ['infeasible'] }, reason: text(600),
      constraintCode: { type: 'string', enum: ['duration_policy', 'capacity', 'prerequisite_or_content', 'undetermined'] },
      deferredSkillIds: { type: 'array', maxItems: 0, items: { type: 'string' } },
      tasks: { type: 'array', maxItems: 0, items: task } } },
] };

async function boundedBody(response: Response) {
  if (!response.body) throw new ProviderFailure('PROVIDER_INCOMPLETE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > AI_LIMITS.outputBytes * 2) throw new ProviderFailure('PROVIDER_INCOMPLETE', false);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new ProviderFailure('PROVIDER_INCOMPLETE'); }
}

export function createGeminiProvider({ apiKey, model, fetchImpl = fetch }: GeminiOptions): AIProvider {
  if (!apiKey || !/^gemini-[a-z0-9.-]+$/.test(model)) throw new Error('Gemini provider needs a key and valid model ID.');
  return { model, async respond(input: ProviderInput, signal: AbortSignal) {
    signal.throwIfAborted();
    const prompt = providerRequest(input);
    let response: Response;
    try {
      response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', cache: 'no-store', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: { maxOutputTokens: 4096, responseFormat: { text: {
            mimeType: 'application/json', schema: input.kind === 'cv_extraction' ? extractionFormat : roadmapFormat,
          } } },
        }),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderFailure('PROVIDER_UNAVAILABLE');
    }
    // Do not read or log error bodies: providers may echo private input.
    if (!response.ok) throw new ProviderFailure('PROVIDER_UNAVAILABLE', response.status === 429 || response.status >= 500);
    let raw: unknown;
    try { raw = await boundedBody(response); }
    catch (error) {
      if (error instanceof ProviderFailure || signal.aborted) throw error;
      throw new ProviderFailure('PROVIDER_UNAVAILABLE');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ProviderFailure('PROVIDER_INCOMPLETE');
    const envelope = raw as { promptFeedback?: { blockReason?: string };
      candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[] };
    if (envelope.promptFeedback?.blockReason || envelope.candidates?.[0]?.finishReason === 'SAFETY')
      throw new ProviderFailure('PROVIDER_REFUSED', false);
    const candidate = Array.isArray(envelope.candidates) ? envelope.candidates[0] : undefined;
    if (!candidate || candidate.finishReason !== 'STOP') throw new ProviderFailure('PROVIDER_INCOMPLETE');
    const parts = candidate.content?.parts;
    if (!Array.isArray(parts) || parts.some(part => !part || typeof part.text !== 'string')) throw new ProviderFailure('PROVIDER_INCOMPLETE');
    const output = parts.map(part => part.text).join('');
    if (!output || Buffer.byteLength(output) > AI_LIMITS.outputBytes) throw new ProviderFailure('PROVIDER_INCOMPLETE');
    try { return JSON.parse(output) as unknown; }
    catch { throw new ProviderFailure('PROVIDER_INCOMPLETE'); }
  } };
}
