import { GROQ_MODEL } from './ai-execution';
import { resourceResearchPrompt } from './resource-discovery';

// Request preparation only. Deliberately not connected to dispatch until native
// tool usage/cost bounds, consent, shared reservations and provenance are wired.
// Groq documents browser_search as incompatible with response_format json_schema.
// A later structured extraction is a separate accounted attempt, not a free retry.
export function groqResourceResearchRequest(context: unknown) {
  const prompt = resourceResearchPrompt(context);
  return {
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
    tools: [{ type: 'browser_search' }],
    tool_choice: 'required',
    reasoning_effort: 'low',
    max_completion_tokens: 2048,
    stream: false,
  } as const;
}
