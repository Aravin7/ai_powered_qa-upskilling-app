import { z } from 'zod';
import { DomainError } from './domain';
import { resourceCandidates, resourceContextSchema, resourceSelectionSchema, searchResultsSchema, providerSourcesSchema, nativeCitationSchema, validateDiscoveredPair, type ResourceCandidate, type ResourceContext } from './resource-discovery';

export const resourcePreviewRequestSchema=z.object({
 operationKey:z.string().uuid(),expectedPlanningRevision:z.number().int().nonnegative(),
 suggestionId:z.string().min(1).max(80),topicId:z.string().min(1).max(100),
}).strict();
export type ResearchProviderInput=
 |{kind:'resource_research';phase:'search';context:ResourceContext}
 |{kind:'resource_research';phase:'select';context:ResourceContext;candidates:ResourceCandidate[];pages?:import('./resource-page-verifier').InspectedPage[]};
const envelopeSchema=z.object({results:searchResultsSchema,sources:providerSourcesSchema}).strict();
export function validateResearchEnvelope(output:unknown){
 const envelope=envelopeSchema.parse(output);
 const candidates=resourceCandidates(envelope.results,envelope.sources);
 if(candidates.length<2)throw new DomainError('RESOURCE_CONTENT_GAP','No substantiated documentation/supporting pair is available.',422);
 return {...envelope,candidates};
}

const storedResourceSchema=z.object({
 id:z.string().min(1).max(80),sourceId:z.string().min(1).max(120),title:z.string().min(1).max(240),
 url:z.string().url().max(2048),publisher:z.string().min(1).max(160),
 kind:z.enum(['documentation','tutorial','course','video']),accessNote:z.string().min(1).max(400),
 checkedAt:z.string().datetime(),reviewStatus:z.enum(['synthetic_only','automatically_checked']),
 citation:nativeCitationSchema.optional(),
}).strict();
export const storedResourcePreviewSchema=resourceContextSchema.extend({
 resources:z.array(storedResourceSchema).length(2),professionalReview:z.null(),
 mode:z.enum(['mock','groq']),model:z.string().min(1).max(120),inputRevision:z.number().int().nonnegative(),
 libraryVersion:z.string().min(1).max(100),operationId:z.string().uuid(),
}).strict();
export type ResourcePreview=z.infer<typeof storedResourcePreviewSchema>;
export const storedResourcePreviewsSchema=z.array(storedResourcePreviewSchema).max(12);

/** Synthetic native-tool boundary only. No web requests or page checks occur.
 * Live adapters cannot use these assertions as verification of real pages. */
export function mockResearchOutput(input:ResearchProviderInput){
 if(input.phase==='select')return resourceSelectionSchema.parse({
  documentationId:input.candidates.find(candidate=>candidate.kind==='documentation')?.id,
  supportingId:input.candidates.find(candidate=>candidate.kind!=='documentation')?.id,
 });
 const topic=encodeURIComponent(input.context.topicId);
 const results=[
  {sourceId:'mock-source-doc',title:`Synthetic documentation fixture: ${input.context.topicTitle}`,url:`https://docs.example.org/topics/${topic}`,publisher:'Synthetic documentation fixture',kind:'documentation'},
  {sourceId:'mock-source-lesson',title:`Synthetic lesson fixture: ${input.context.topicTitle}`,url:`https://lessons.example.org/topics/${topic}`,publisher:'Synthetic lesson fixture',kind:'tutorial'},
 ];
 return {results,sources:results.map(result=>({id:result.sourceId,url:result.url}))};
}

export function validateMockResourcePreview(context:ResourceContext,envelope:ReturnType<typeof validateResearchEnvelope>,selection:unknown,now=new Date()){
 const selected=resourceSelectionSchema.parse(selection);
 const ids=[selected.documentationId,selected.supportingId];
 const candidates=ids.map(id=>envelope.candidates.find(candidate=>candidate.id===id));
 if(candidates.some(candidate=>!candidate||!['docs.example.org','lessons.example.org'].includes(new URL(candidate.url).hostname)))
  throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Mock checks are restricted to synthetic fixture hosts; no real page availability was verified.',502);
 const checks=candidates.map(candidate=>({candidateId:candidate!.id,url:candidate!.url,topicId:context.topicId,available:true,topicRelevant:true,
  officialDocumentation:candidate!.kind==='documentation',detectedKind:candidate!.kind,
  accessNote:'Synthetic fixture only. Access, prerequisites, availability and relevance were mocked; this is not a learning recommendation.',checkedAt:now.toISOString()}));
 const pair=validateDiscoveredPair(context,envelope.results,selected,checks,envelope.sources,now);
 return {...pair,resources:pair.resources.map(resource=>({...resource,reviewStatus:'synthetic_only' as const}))};
}
