import { describe, expect, it } from 'vitest';
import { capabilityLibrary, mockPathwayOutput, preferenceSchema, validatePathwaySuggestions, type PathwayProviderInput } from '../src/lib/pathways';
import { providerRequest } from '../src/lib/ai-provider-request';
import { demoState, syntheticRoadmap } from '../src/lib/domain';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';

const input:PathwayProviderInput={kind:'pathway_suggestions',preferences:{interests:['ai-quality','delivery','security','reliability'],preferredWork:'automation',codingPreference:'some'},confirmedSkillIds:['test-design','api-testing','automation'],hoursPerWeek:5};
describe('US15/T15 provisional QA direction contracts - synthetic/mock only',()=>{
 it('PX-01: combines capabilities from stated interests; no fixed pathway ID is required',()=>{
  const suggestions=validatePathwaySuggestions(mockPathwayOutput(input),input.confirmedSkillIds);
  expect(suggestions).toHaveLength(4);
  expect(suggestions.every(s=>s.provisional&&s.libraryVersion===capabilityLibrary.version)).toBe(true);
  expect(suggestions.some(s=>s.capabilityIds.includes('ci'))).toBe(true);
  expect(suggestions.some(s=>s.capabilityIds.includes('llm-evaluation'))).toBe(true);
  expect(suggestions.some(s=>s.capabilityIds.includes('load-testing'))).toBe(true);
 });
 it('PX-02: rejects unknown capabilities, duplicate combinations and invented transferable experience',()=>{
  const output=mockPathwayOutput(input);
  const first=output.suggestions[0];
  expect(()=>validatePathwaySuggestions({suggestions:[{...first,capabilityIds:['invented','ai-basics']}]},input.confirmedSkillIds)).toThrow();
  expect(()=>validatePathwaySuggestions({suggestions:[first,first]},input.confirmedSkillIds)).toThrow();
  expect(()=>validatePathwaySuggestions({suggestions:[{...first,transferableSkillIds:['llm-evaluation']}]},input.confirmedSkillIds)).toThrow();
 });
 it('PX-03: rejects links, unsupported claims, duplicate interests and arbitrary CV fields',()=>{
  const first=mockPathwayOutput(input).suggestions[0];
  expect(()=>validatePathwaySuggestions({suggestions:[{...first,why:'Guaranteed job-ready expert.'}]},input.confirmedSkillIds)).toThrow();
  expect(()=>validatePathwaySuggestions({suggestions:[{...first,practicalWork:'Visit https://untrusted.example.org'}]},input.confirmedSkillIds)).toThrow();
  expect(()=>preferenceSchema.parse({...input.preferences,interests:['security','security']})).toThrow();
  expect(()=>preferenceSchema.parse({...input.preferences,cv:'synthetic private text'})).toThrow();
 });
 it('PX-04: passes bounded preferences, canonical IDs and capacity without role, age, contact or CV content',()=>{
  const request=JSON.parse(providerRequest(input).user);
  expect(request.preferences).toEqual(input.preferences);
  expect(request.confirmedSkillIds).toEqual(input.confirmedSkillIds);
  expect(request).not.toHaveProperty('currentRole');
  expect(JSON.stringify(request)).not.toMatch(/email|cvText|yearsExperience|userId/);
 });
 it('PX-05: provisional selection cannot drive the legacy sample roadmap',()=>{
  const state=demoState();
  state.pathwayExploration={preferences:input.preferences,suggestions:validatePathwaySuggestions(mockPathwayOutput(input),input.confirmedSkillIds),inputRevision:1,libraryVersion:capabilityLibrary.version,selectedSuggestionId:'direction-1'};
  expect(()=>syntheticRoadmap(state)).toThrow(/no reviewed requirements/);
 });
 it('PX-06: live adapter rejects a pathway request before dispatch',()=>{
  const provider=createGroqProvider({apiKey:'synthetic-not-a-key',model:GROQ_MODEL,fetchImpl:async()=>{throw new Error('Unexpected dispatch');}});
  expect(()=>provider.checkInput!(input)).toThrow(/updated approved disclosure/);
 });
});
