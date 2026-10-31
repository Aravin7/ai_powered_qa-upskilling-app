import { AI_LIMITS } from './ai-config';
import { GROQ_MODEL, GROQ_NATIVE_TOOL_LIMIT } from './ai-execution';
import { ProviderFailure, type AIProvider, type ProviderInput } from './ai-provider';
import { providerRequest } from './ai-provider-request';
import { DomainError } from './domain';
import type { NativeResearchDiagnostic } from './groq-resource-research';
import { parseLLMResourceSuggestions } from './llm-resource-suggestions';


type Options = {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  maxRequestBytes?: number;
  fetchImpl?: typeof fetch;

  planningApprovalReference?: string;
  llmResourceApprovalReference?: string;

  nativeResearch?: {
    approvalReference: string;
    maxNativeToolCalls: number;
  };

  onResearchDiagnostic?: (
    event: NativeResearchDiagnostic
  ) => void;
};

const strings = { type: 'array', items: { type: 'string' } };

const pathwaySchema = { type: 'object', additionalProperties: false, required: ['suggestions'], properties: { suggestions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'why', 'capabilityIds', 'transferableSkillIds', 'practicalWork', 'uncertainty'], properties: { title: { type: 'string' }, why: { type: 'string' }, capabilityIds: strings, transferableSkillIds: strings, practicalWork: { type: 'string' }, uncertainty: { type: 'string' } } } } } };

const resourceSchema = { type: 'object', additionalProperties: false, required: ['documentationId', 'supportingId'], properties: { documentationId: { type: 'string' }, supportingId: { type: 'string' } } };

const checkedResourceSchema = { ...resourceSchema, required: [...resourceSchema.required, 'evidence'], properties: { ...resourceSchema.properties, evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['candidateId', 'topicExcerpt', 'access', 'accessExcerpt'], properties: { candidateId: { type: 'string' }, topicExcerpt: { type: 'string' }, access: { type: 'string', enum: ['public-page', 'sign-in', 'payment', 'unclear'] }, accessExcerpt: { type: 'string' } } } } } };

const llmResourceSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['outcome', 'results'],
    properties: {
        outcome: {
            type: 'string',
            enum: ['candidates', 'content_gap'],
        },
        results: {
            type: 'array',
            maxItems: 4,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'url', 'kind'],
                properties: {
                    title: { type: 'string' },
                    url: { type: 'string' },
                    kind: {
                        type: 'string',
                        enum: ['documentation', 'tutorial', 'course', 'video'],
                    },
                },
            },
        },
    },
};

const extractionSchema = {
    type: 'object', additionalProperties: false, required: ['skills'], properties: {
        skills: {
            type: 'array', items: {
                type: 'object', additionalProperties: false, required: ['skillId', 'label', 'evidenceExcerpt', 'sourceId'],
                properties: { skillId: { type: ['string', 'null'] }, label: { type: 'string' }, evidenceExcerpt: { type: 'string' }, sourceId: { type: ['string', 'null'] } },
            }
        }
    }
};

// Use a closed root object. Cross-field conditions and all size/business limits remain server validated.

const roadmapSchema = {
    type: 'object', additionalProperties: false, required: ['outcome', 'reason', 'constraintCode', 'deferredSkillIds', 'tasks'], properties: {
        outcome: { type: 'string', enum: ['plan', 'infeasible'] }, reason: { type: ['string', 'null'] },
        constraintCode: { type: ['string', 'null'], enum: ['duration_policy', 'capacity', 'prerequisite_or_content', 'undetermined', null] },
        deferredSkillIds: strings, tasks: {
            type: 'array', items: {
                type: 'object', additionalProperties: false,
                required: ['week', 'kind', 'title', 'activity', 'completionCriterion', 'skillIds', 'resourceIds', 'estimatedMinutes'], properties: {
                    week: { type: 'integer' }, kind: { type: 'string', enum: ['learning', 'practical'] }, title: { type: 'string' }, activity: { type: 'string' }, completionCriterion: { type: 'string' },
                    skillIds: strings, resourceIds: strings, estimatedMinutes: { type: 'integer' },
                }
            }
        },
    }
};

async function boundedBody(response: Response) {
    if (!response.body) throw new ProviderFailure('PROVIDER_INCOMPLETE');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read(); if (done) break; length += value.byteLength;
            if (length > AI_LIMITS.outputBytes * 2) throw new ProviderFailure('PROVIDER_INCOMPLETE', false); chunks.push(value);
        }
    } finally { await reader.cancel().catch(() => { }); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { throw new ProviderFailure('PROVIDER_INCOMPLETE'); }
}


export function createGroqProvider({
  apiKey,
  model,
  maxOutputTokens = 4096,
  maxRequestBytes = 64000,
  fetchImpl = fetch,
  nativeResearch,
  planningApprovalReference,
  llmResourceApprovalReference,
  onResearchDiagnostic,
}: Options): AIProvider {
    if (!apiKey || model !== GROQ_MODEL) throw new Error('Groq needs a server key and the configured fixed model.');
    function requestBody(input: ProviderInput) {
        if ((input.kind === 'pathway_suggestions' || input.kind === 'reviewed_roadmap') && !planningApprovalReference?.trim()) throw new DomainError('PATHWAY_LIVE_DISABLED', 'Live direction planning requires reviewed content and an updated approved disclosure.', 503);
        if (
            input.kind === 'resource_research' &&
            !llmResourceApprovalReference?.trim()
        ) {
            throw new DomainError(
                'RESOURCE_LIVE_DISABLED',
                'LLM-only resource recommendations require an approved workflow and updated disclosure.',
                503
            );
        }
        const prompt = providerRequest(input);
        const schema =
            input.kind === 'cv_extraction' ? extractionSchema :
                input.kind === 'pathway_suggestions' ? pathwaySchema :
                    input.kind === 'resource_research'
                        ? input.phase === 'search'
                            ? llmResourceSchema
                            : input.pages
                                ? checkedResourceSchema
                                : resourceSchema
                        : roadmapSchema;
        // Resource suggestions use ordinary structured generation, not Browser Search.
        // The existing live-workflow approval gate stays unchanged until a separate
        // LLM-only approval policy is implemented and reviewed.
        const body = JSON.stringify({
            model, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
            max_completion_tokens: input.kind === 'resource_research' && input.phase === 'search' ? Math.min(maxOutputTokens, 2048) : maxOutputTokens,
            reasoning_effort: 'low', include_reasoning: false, stream: false,
            response_format: { type: 'json_schema', json_schema: { name: input.kind, strict: true, schema } }
        });
        if (Buffer.byteLength(body) > maxRequestBytes) throw new DomainError('PROVIDER_INPUT_LIMIT', 'Minimized provider request exceeds the byte ceiling. Use manual entry or a smaller CV.', 422);
        return body;
    }
    return {
        model, checkInput(input) { requestBody(input); }, async respond(input, signal) {
            signal.throwIfAborted(); const body = requestBody(input); let response: Response;
            try {
                response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST', cache: 'no-store', redirect: 'error', signal,
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body
                });
            } catch { if (signal.aborted) throw signal.reason; throw new ProviderFailure('PROVIDER_CONNECTION_FAILED'); }
            // Never expose echoed provider error bodies. Rate limits require a deliberate later retry.
            if (response.status === 429) throw new DomainError('PROVIDER_RATE_LIMIT', 'Groq rate limit reached. Wait before a deliberate retry; existing data is preserved.', 429);
            if (!response.ok) throw new ProviderFailure('PROVIDER_UNAVAILABLE', response.status >= 500, response.status);
            let raw: unknown;
            try { raw = await boundedBody(response); } catch (error) { if (signal.aborted) throw signal.reason; if (error instanceof ProviderFailure) throw error; throw new ProviderFailure('PROVIDER_RESPONSE_INTERRUPTED'); }
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ProviderFailure('PROVIDER_INCOMPLETE');
            const envelope = raw as { id?: unknown; choices?: { finish_reason?: string; message?: { content?: unknown; refusal?: unknown; tool_calls?: unknown } }[] };
            const choice = Array.isArray(envelope.choices) ? envelope.choices[0] : undefined;
            if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new ProviderFailure('PROVIDER_REFUSED', false);
            if (!choice || choice.finish_reason !== 'stop' || choice.message?.tool_calls) throw new ProviderFailure('PROVIDER_INCOMPLETE');
            const output = choice.message?.content;
            if (typeof output !== 'string' || !output || Buffer.byteLength(output) > AI_LIMITS.outputBytes) throw new ProviderFailure('PROVIDER_INCOMPLETE');
            let parsed: unknown;
            try { parsed = JSON.parse(output) as unknown; } catch { throw new ProviderFailure('PROVIDER_INCOMPLETE'); }
            if (input.kind === 'resource_research' && input.phase === 'search') return parseLLMResourceSuggestions(parsed);
            return parsed;
        }
    };
}
