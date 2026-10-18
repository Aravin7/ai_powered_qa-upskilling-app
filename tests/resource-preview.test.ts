import { describe, expect, it } from 'vitest';
import { mockResearchOutput, resourcePreviewRequestSchema, validateMockResourcePreview, validateResearchEnvelope } from '../src/lib/resource-preview';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';
const context={pathwayId:'direction-1',pathwayTitle:'Synthetic QA direction',topicId:'ci',topicTitle:'Continuous integration'};
describe('T15 resource preview contracts - synthetic only, no network',()=>{
 it('RP-01: preserves a grounded pair but labels every mock check synthetic, with no professional review',()=>{
  const envelope=validateResearchEnvelope(mockResearchOutput({kind:'resource_research',phase:'search',context}));
  const selection=mockResearchOutput({kind:'resource_research',phase:'select',context,candidates:envelope.candidates});
  const pair=validateMockResourcePreview(context,envelope,selection);
  expect(pair.resources).toHaveLength(2);expect(pair.resources.every(resource=>resource.reviewStatus==='synthetic_only')).toBe(true);
  expect(pair.professionalReview).toBeNull();
 });
 it('RP-02: mock page checks cannot be used as verification for real websites',()=>{
  const response=mockResearchOutput({kind:'resource_research',phase:'search',context}) as {results:{url:string}[];sources:{url:string}[]};
  response.results[0].url='https://docs.real-publisher.org/ci';response.sources[0].url=response.results[0].url;
  const envelope=validateResearchEnvelope(response);
  expect(()=>validateMockResourcePreview(context,envelope,{documentationId:envelope.candidates[0].id,supportingId:envelope.candidates[1].id})).toThrow(/synthetic fixture hosts/);
 });
 it('RP-03: missing sources, insufficient results and forged client context are rejected',()=>{
  expect(()=>validateResearchEnvelope({results:[],sources:[]})).toThrow(/pair/);
  expect(()=>validateResearchEnvelope({results:[{}],sources:[]})).toThrow();
  expect(()=>resourcePreviewRequestSchema.parse({operationKey:crypto.randomUUID(),suggestionId:'direction-1',topicId:'ci',expectedPlanningRevision:4,topicTitle:'forged',cvText:'private'})).toThrow();
 });
 it('RP-04: Groq native research stays disabled before network dispatch',()=>{
  let calls=0;const provider=createGroqProvider({apiKey:'synthetic-only',model:GROQ_MODEL,fetchImpl:async()=>{calls++;throw new Error('Unexpected network call');}});
  expect(()=>provider.checkInput!({kind:'resource_research',phase:'search',context})).toThrow(/approved native-tool/);
  expect(calls).toBe(0);
 });
});
