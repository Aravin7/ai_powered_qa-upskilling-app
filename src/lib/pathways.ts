import { z } from 'zod';
import { catalogue } from './catalogue';
import { DomainError } from './domain';
import { compileDirectionRequirements, publicationReadyLibrary, type RequirementLibrary } from './requirements';

export const interestLabels = {
  'ai-assistance': 'AI-assisted testing', 'ai-quality': 'Testing AI applications',
  security: 'AI security and safety', delivery: 'Automation and CI/CD', reliability: 'Performance and reliability',
} as const;
export const preferenceSchema = z.object({
  interests: z.array(z.enum(['ai-assistance', 'ai-quality', 'security', 'delivery', 'reliability'])).min(1).max(5),
  preferredWork: z.enum(['exploration', 'automation', 'analysis', 'delivery']),
  codingPreference: z.enum(['open', 'some', 'low-code']),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.interests).size !== value.interests.length) ctx.addIssue({ code: 'custom', path: ['interests'], message: 'Choose each interest once.' });
});
export type PathwayPreferences = z.infer<typeof preferenceSchema>;
export const savePreferencesSchema = z.object({ preferences: preferenceSchema, expectedPlanningRevision: z.number().int().nonnegative() }).strict();
export const suggestPathwaysSchema = z.object({ operationKey: z.string().uuid(), expectedPlanningRevision: z.number().int().nonnegative() }).strict();
export const selectPathwaySchema = z.object({ suggestionId: z.string().max(80).nullable(), expectedPlanningRevision: z.number().int().nonnegative() }).strict();

// Capabilities, not a fixed menu of career paths. All are synthetic draft content.
// Publication must advance the shared catalogue revision before changing this library.
export const capabilityLibrary = {
  version: catalogue.version, reviewed: false,
  provenance: 'Synthetic development capability fixture; no professional approval or labour-market claim.',
  capabilities: [
    ...catalogue.skills.map(skill => ({ id: skill.id, label: skill.label, canonicalSkillId: skill.id as string | null })),
    { id: 'llm-evaluation', label: 'Evaluating GenAI application responses', canonicalSkillId: null },
    { id: 'ai-security', label: 'AI application security testing', canonicalSkillId: null },
    { id: 'retrieval-testing', label: 'Testing retrieval and grounding', canonicalSkillId: null },
    { id: 'load-testing', label: 'Performance and load testing', canonicalSkillId: null },
    { id: 'observability', label: 'Quality observability', canonicalSkillId: null },
    { id: 'delivery-gates', label: 'Automated delivery quality gates', canonicalSkillId: null },
  ],
} as const;
const boundedText = (max: number) => z.string().trim().min(1).max(max).refine(value => !/https?:\/\/|www\.|guaranteed|job.ready|employab|certified expert/i.test(value), 'Unsupported link or capability/employment claim.');
export const pathwayOutputSchema = z.object({ suggestions: z.array(z.object({
  title: boundedText(140), why: boundedText(600), capabilityIds: z.array(z.string().max(80)).min(2).max(12),
  transferableSkillIds: z.array(z.string().max(80)).max(20), practicalWork: boundedText(600), uncertainty: boundedText(500),
}).strict()).min(1).max(6) }).strict();
export const storedSuggestionsSchema = z.array(pathwayOutputSchema.shape.suggestions.element.extend({
  id:z.string().min(1).max(80), provisional:z.literal(true), libraryVersion:z.string().min(1).max(100),
  capabilityLabels:z.array(z.object({id:z.string().max(80),label:z.string().max(140)}).strict()).max(100).optional(),
  reviewedDirectionId:z.string().max(80).optional(),sourceNote:z.string().max(300).optional(),generationMode:z.enum(['mock','groq']).optional(),
}).strict()).max(6);
export type PathwaySuggestion=z.infer<typeof storedSuggestionsSchema>[number];
export type PathwayVocabulary={version:string;reviewed:boolean;provenance:string;capabilities:readonly {id:string;label:string;canonicalSkillId:string|null}[];directions?:{id:string;label:string;capabilityIds:string[]}[]};
export function reviewedPathwayVocabulary(input:RequirementLibrary):PathwayVocabulary{
 const library=publicationReadyLibrary(input);
 return {version:library.version,reviewed:true,provenance:'Active reviewed QA capability requirements; suggestions are provisional until the learner saves a reviewed direction.',
  capabilities:library.capabilities.map(item=>({id:item.id,label:item.label,canonicalSkillId:item.id})),
  directions:library.directionRules.map(rule=>({id:rule.id,label:rule.label,capabilityIds:compileDirectionRequirements(library,{directionId:rule.id,deferredCapabilityIds:[]}).capabilities.map(item=>item.id)}))};
}
export type PathwayExploration = {
  preferences: PathwayPreferences; suggestions: PathwaySuggestion[]; inputRevision: number;
  libraryVersion: string; selectedSuggestionId: string | null;
  resourcePreviews?:import('./resource-preview').ResourcePreview[];current?:boolean;
};
export type PathwayProviderInput = {
  kind: 'pathway_suggestions'; preferences: PathwayPreferences; confirmedSkillIds: string[]; hoursPerWeek: number;library?:PathwayVocabulary;
};
export function validatePathwaySuggestions(output: unknown, confirmedSkillIds: readonly string[],library:PathwayVocabulary=capabilityLibrary): PathwaySuggestion[] {
  const parsed = pathwayOutputSchema.parse(output);
  const known = new Set(confirmedSkillIds);
  const combinations = new Set<string>();
  return parsed.suggestions.map((suggestion, index) => {
    const key = [...suggestion.capabilityIds].sort().join('|');
    if (new Set(suggestion.capabilityIds).size !== suggestion.capabilityIds.length || combinations.has(key) ||
        suggestion.capabilityIds.some(id => !library.capabilities.some(capability => capability.id === id)) ||
        new Set(suggestion.transferableSkillIds).size !== suggestion.transferableSkillIds.length ||
        suggestion.transferableSkillIds.some(id => !known.has(id) || !suggestion.capabilityIds.includes(id)))
      throw new DomainError('INVALID_OUTPUT', 'Pathway suggestions contain unsupported capabilities or experience claims.', 502);
    combinations.add(key);
    const reviewedDirection=library.directions?.find(rule=>rule.capabilityIds.length===suggestion.capabilityIds.length&&rule.capabilityIds.every(id=>suggestion.capabilityIds.includes(id)));
    return { ...suggestion, id: `direction-${index + 1}`, provisional: true, libraryVersion: library.version,
     capabilityLabels:library.capabilities.filter(item=>suggestion.capabilityIds.includes(item.id)).map(({id,label})=>({id,label})),
     sourceNote:library.provenance,...(reviewedDirection?{reviewedDirectionId:reviewedDirection.id}:{}) };
  });
}
export function mockPathwayOutput(input: PathwayProviderInput) {
  const anchors: Record<PathwayPreferences['interests'][number], string[]> = {
    'ai-assistance': ['test-design', 'ai-basics', 'prompt-design'],
    'ai-quality': ['api-testing', 'ai-basics', 'llm-evaluation', 'retrieval-testing'],
    security: ['test-design', 'responsible-ai', 'ai-security'],
    delivery: ['automation', 'ci', 'delivery-gates'],
    reliability: ['api-testing', 'load-testing', 'observability'],
  };
  return { suggestions: input.preferences.interests.map(interest => {
    const ids = [...anchors[interest]];
    const workCapability = input.preferences.preferredWork === 'automation' ? 'automation' : input.preferences.preferredWork === 'delivery' ? 'ci' : 'test-design';
    if (!ids.includes(workCapability)) ids.push(workCapability);
    const labels = ids.slice(-2).map(id => capabilityLibrary.capabilities.find(capability => capability.id === id)!.label);
    return { title: labels.join(' + '), why: `An exploratory combination for your stated interest in ${interestLabels[interest].toLowerCase()} and ${input.preferences.preferredWork} work.`,
      capabilityIds: ids, transferableSkillIds: input.confirmedSkillIds.filter(id => ids.includes(id)),
      practicalWork: `Design a synthetic QA experiment combining ${labels.join(' and ')}. Document expected behavior, failures and limitations.`,
      uncertainty: `Synthetic mock suggestion, not live AI advice. Coding preference: ${input.preferences.codingPreference}. Requirements, suitability and effort need review; no proficiency is inferred.` };
  }) };
}
