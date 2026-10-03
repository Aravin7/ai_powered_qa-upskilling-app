import { describe, expect, it } from 'vitest';
import { catalogue, validateCatalogue } from '../src/lib/catalogue';
import { canonicalize, compare, demoState, emptyState, inventorySchema, normalizeLabel, profileSchema, progress, reviewInventory, saveProfile, syntheticRoadmap, validatePlan } from '../src/lib/domain';
const ready=()=>{const state=demoState();state.consents.roadmap_generation=true;return state;};
const output=()=>{const state=ready();const plan=syntheticRoadmap(state);return {state,plan,input:{outcome:'plan' as const,reason:null,constraintCode:null,deferredSkillIds:[],tasks:plan.tasks.map(({id,completed,revision,...t})=>{void id;void completed;void revision;return t})}}};
describe('T02 profile boundaries and revisions',()=>{
 it.each([1,40])('accepts whole weekly hours %s',hours=>expect(profileSchema.parse({currentRole:'QA',yearsExperience:7,hoursPerWeek:hours,expectedRevision:0}).hoursPerWeek).toBe(hours));
 it.each([0,41,1.5,'5',NaN])('rejects invalid hours %s',hours=>expect(()=>profileSchema.parse({currentRole:'QA',yearsExperience:7,hoursPerWeek:hours,expectedRevision:0})).toThrow());
 it('does not advance revision on a no-op; rejects stale writes',()=>{const s=ready();const body={currentRole:s.profile.currentRole,yearsExperience:7,hoursPerWeek:5,expectedRevision:1};expect(saveProfile(s,body).profile.planningRevision).toBe(1);expect(()=>saveProfile(s,{...body,expectedRevision:0})).toThrow('saved data changed');expect(saveProfile(s,{...body,hoursPerWeek:6}).profile.planningRevision).toBe(2)});
 it('rejects overlong role and hidden additional fields',()=>{expect(()=>profileSchema.parse({currentRole:'a'.repeat(101),yearsExperience:7,hoursPerWeek:5,expectedRevision:0})).toThrow();expect(()=>profileSchema.parse({currentRole:'QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:0,userId:'other'})).toThrow()});
});
describe('T05 inventory integrity',()=>{
 it('normalizes Unicode, spaces and reviewed aliases without losing punctuation',()=>{expect(normalizeLabel('  Ｃ++  ')).toBe('c++');expect(normalizeLabel('Straße')).toBe('strasse');expect(new Set(['C','C++','C#'].map(normalizeLabel)).size).toBe(3);expect(canonicalize({canonicalSkillId:null,label:' PLAYWRIGHT '}).canonicalSkillId).toBe('automation')});
 it('keeps unmatched labels separate from canonical evidence',()=>{const x=canonicalize({canonicalSkillId:null,label:'advanced wizardry'});expect(x.canonicalSkillId).toBeNull();expect(compare([x]).matched).toHaveLength(0)});
 it('rejects foreign IDs and client-supplied CV origin',()=>{expect(()=>canonicalize({canonicalSkillId:'injected',label:'QA'})).toThrow();expect(()=>inventorySchema.parse({entries:[{canonicalSkillId:null,label:'QA',source:'cv'}],removals:[],expectedRevision:0})).toThrow()});
 it('requires explicit removals and never lets upload-like additions erase saved skills',()=>{const old=ready().skills;expect(()=>reviewInventory(old,{entries:[],removals:[],expectedRevision:1})).toThrow('Confirm each removed');expect(reviewInventory(old,{entries:[],removals:old.map(s=>s.key),expectedRevision:1})).toEqual([])});
 it('deduplicates reviewed aliases and preserves existing origin',()=>{const old=ready().skills.map(s=>({...s,source:'cv' as const}));const entries=[...old.map(s=>({canonicalSkillId:s.canonicalSkillId,label:s.label})),{canonicalSkillId:null,label:'Playwright'}];const next=reviewInventory(old,{entries,removals:[],expectedRevision:1});expect(next).toHaveLength(old.length);expect(next.every(s=>s.source==='cv')).toBe(true)});
});
describe('T06 deterministic comparison',()=>{
 it('validates synthetic catalogue structure without claiming review',()=>{expect(validateCatalogue()).toEqual({version:catalogue.version,skills:8,reviewed:false})});
 it('empty inventory means not established',()=>expect(compare([]).evidenceEstablished).toBe(false));
 it('all listed skills yield no gaps, without a competence score',()=>{const skills=catalogue.skills.map(s=>canonicalize({canonicalSkillId:s.id,label:s.label}));expect(compare(skills).noGaps).toBe(true);expect(compare(skills)).not.toHaveProperty('proficiency')});
});
describe('T07 roadmap validation and preservation',()=>{
 it('accepts the explicitly synthetic sample with honest capacity and practical activity',()=>{const {state,input}=output();expect(validatePlan(input,state.profile,state.skills).tasks).toHaveLength(5)});
 it.each(['week','minutes','blank','unknown','prerequisite','missing','deferral'])('rejects invalid %s without modifying active state',kind=>{
  const {state,plan,input}=output();state.roadmap=plan;const before=JSON.stringify(state);
  if(kind==='week')input.tasks[0].week=99;
  if(kind==='minutes')input.tasks[0].estimatedMinutes=1800;
  if(kind==='blank')input.tasks[0].title=' ';
  if(kind==='unknown')input.tasks[0].skillIds=['foreign'];
  if(kind==='prerequisite'){const a=input.tasks[0];input.tasks[0]={...input.tasks[1],week:1};input.tasks[1]={...a,week:2};}
  if(kind==='missing')input.tasks=input.tasks.slice(0,-1);
  if(kind==='deferral')Object.assign(input,{deferredSkillIds:['ai-basics']});
  expect(()=>validatePlan(input,state.profile,state.skills)).toThrow();expect(JSON.stringify(state)).toBe(before);
 });
 it('distinguishes too-small duration policy from capacity',()=>{
  const s=ready();s.profile.hoursPerWeek=1;expect(()=>syntheticRoadmap(s)).toThrow('exceeds your weekly');
  s.profile.hoursPerWeek=5;s.skills=catalogue.skills.slice(0,7).map(x=>canonicalize({canonicalSkillId:x.id,label:x.label}));expect(()=>syntheticRoadmap(s)).toThrow('four weeks');
 });
 it('requires consent and confirmed onboarding',()=>{const s=demoState();expect(()=>syntheticRoadmap(s)).toThrow('consent');expect(()=>syntheticRoadmap(emptyState())).toThrow('Save your profile')});
 it('progress is nullable without tasks and counts only the selected active plan',()=>{expect(progress(null)).toBeNull();const p=syntheticRoadmap(ready());p.tasks[0].completed=true;expect(progress(p)).toBe(20)});
});
