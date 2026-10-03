import { z } from 'zod';
import { caseFold } from 'unicode-case-folding';
import { catalogue, validateCatalogue } from './catalogue';
import type { AppState, Profile, Roadmap, SkillEntry } from './types';
export const POLICY_VERSION = 'development-disclosure-v1';
export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const profileSchema = z.object({currentRole:z.string().trim().min(2).max(100),yearsExperience:z.number().int().min(0).max(60),hoursPerWeek:z.number().int().min(1).max(40),expectedRevision:z.number().int().nonnegative()}).strict();
export const skillInput = z.object({canonicalSkillId:z.string().max(80).nullable(),label:z.string().trim().min(1).max(100)}).strict();
export const inventorySchema = z.object({entries:z.array(skillInput).max(100),removals:z.array(z.string().max(120)).max(100),expectedRevision:z.number().int().nonnegative()}).strict();
export const consentSchema = z.object({purpose:z.enum(['cv_extraction','roadmap_generation']),granted:z.boolean(),policyVersion:z.literal(POLICY_VERSION)}).strict();
export const taskSchema = z.object({completed:z.boolean(),expectedTaskRevision:z.number().int().nonnegative()}).strict();
export const generateSchema = z.object({operationKey:z.string().uuid(),expectedPlanningRevision:z.number().int().nonnegative(),expectedCatalogueVersion:z.string().max(100),introductoryPlanAcknowledged:z.boolean()}).strict();
export const planSchema = z.object({
 outcome:z.literal('plan'),reason:z.null(),constraintCode:z.null(),deferredSkillIds:z.array(z.string()).max(100),
 tasks:z.array(z.object({week:z.number().int().min(1).max(12),kind:z.enum(['learning','practical']),title:z.string().trim().min(1).max(160),activity:z.string().trim().min(1).max(1200),completionCriterion:z.string().trim().min(1).max(600),skillIds:z.array(z.string()).min(1).max(10),resourceIds:z.array(z.string()).max(10),estimatedMinutes:z.number().int().positive().max(2400)}).strict()).min(1).max(60)
}).strict();
// Unicode default case folding, preserving significant punctuation.
export function normalizeLabel(label:string) { return caseFold(label.normalize('NFKC')).trim().replace(/\s+/gu,' '); }
export function canonicalize(input:z.infer<typeof skillInput>):SkillEntry {
 const label=input.label.trim();
 const matched = input.canonicalSkillId ? catalogue.skills.find(s=>s.id===input.canonicalSkillId) : catalogue.skills.find(s=>[s.label,...s.aliases].some(a=>normalizeLabel(a)===normalizeLabel(label)));
 if(input.canonicalSkillId && !matched) throw new DomainError('UNKNOWN_SKILL','Choose a listed skill or add an unmatched label.');
 return matched ? {key:`id:${matched.id}`,canonicalSkillId:matched.id,label:matched.label,source:'manual'} : {key:`label:${normalizeLabel(label)}`,canonicalSkillId:null,label,source:'manual'};
}
export function reviewInventory(old:SkillEntry[],body:z.infer<typeof inventorySchema>) {
 const next = [...new Map(body.entries.map(e=>{const s=canonicalize(e);return [s.key,s] as const})).values()];
 const keys=new Set(next.map(s=>s.key));
 const oldKeys=new Set(old.map(s=>s.key));
 if(body.removals.some(k=>!oldKeys.has(k)||keys.has(k))) throw new DomainError('INVALID_REMOVAL','Removals must identify existing entries omitted from the final inventory.');
 if(old.some(s=>!keys.has(s.key)&&!body.removals.includes(s.key))) throw new DomainError('EXPLICIT_REMOVAL_REQUIRED','Confirm each removed skill before saving.',409);
 return next.map(s=>old.find(o=>o.key===s.key)||s).sort((a,b)=>a.key.localeCompare(b.key));
}
export function compare(skills:SkillEntry[]) {
 validateCatalogue();
 const ids = new Set(skills.map(s=>s.canonicalSkillId));
 const matched = catalogue.skills.filter(s=>ids.has(s.id));
 const gaps = catalogue.skills.filter(s=>!ids.has(s.id));
 return { matched, gaps, noGaps:gaps.length===0, evidenceEstablished:skills.length>0, catalogueVersion:catalogue.version };
}
export function sameInventory(a:SkillEntry[],b:SkillEntry[]) {return JSON.stringify([...a].sort((x,y)=>x.key.localeCompare(y.key)))===JSON.stringify([...b].sort((x,y)=>x.key.localeCompare(y.key)));}
export function saveProfile(state:AppState, input:unknown):AppState {
 const body=profileSchema.parse(input);
 assertRevision(state.profile.planningRevision,body.expectedRevision);
 const changed=!state.profile.confirmed || ['currentRole','yearsExperience','hoursPerWeek'].some(k=>state.profile[k as keyof Profile]!==body[k as keyof typeof body]);
 return {...state,profile:{...state.profile,currentRole:body.currentRole,yearsExperience:body.yearsExperience,hoursPerWeek:body.hoursPerWeek,confirmed:true,planningRevision:state.profile.planningRevision+(changed?1:0)}};
}
export function assertRevision(actual:number,expected:number) {if(actual!==expected)throw new DomainError('STALE_INPUT','Your saved data changed. Refresh before saving these edits.',409);}
export function validatePlan(input:unknown,profile:Profile,skills:SkillEntry[]) {
 const plan=planSchema.parse(input);
 const {gaps}=compare(skills); const gapIds=new Set<string>(gaps.map(s=>s.id));
 const known = new Set<string>(skills.flatMap(s=>s.canonicalSkillId?[s.canonicalSkillId]:[]));
 const coverage = new Set<string>();const byWeek=new Map<number,number>();let lastWeek=1;
 for(const task of plan.tasks){
  if(task.week<lastWeek)throw new DomainError('INVALID_PLAN','Tasks must be ordered.');lastWeek=task.week;
  if(new Set(task.skillIds).size!==task.skillIds.length||new Set(task.resourceIds).size!==task.resourceIds.length)throw new DomainError('INVALID_PLAN','Duplicate mappings.');
  for(const id of task.skillIds){
   const s=catalogue.skills.find(x=>x.id===id);
   if(!s||!gapIds.has(id))throw new DomainError('INVALID_PLAN','Unknown or unnecessary skill.');
   if(s.prerequisites.some(p=>!known.has(p)))throw new DomainError('INVALID_PLAN','A prerequisite must be satisfied before dependent work.');
  }
  for(const id of task.resourceIds){const r=catalogue.resources.find(x=>x.id===id);if(!r || !(r.skillIds as readonly string[]).some(s=>task.skillIds.includes(s)))throw new DomainError('INVALID_PLAN','Invalid resource mapping.');}
  if(task.kind==='learning'&&!task.resourceIds.length)throw new DomainError('INVALID_PLAN','Learning tasks need resources.');
  task.skillIds.forEach(id=>{coverage.add(id);known.add(id)});
  byWeek.set(task.week,(byWeek.get(task.week)||0)+task.estimatedMinutes);
 }
 const weeks=[...byWeek.keys()];
 if(weeks.length<4||weeks.length>12||weeks.some((w,i)=>w!==i+1))throw new DomainError('DURATION_POLICY','A plan must occupy 4–12 consecutive relative weeks.',422);
 if([...byWeek.values()].some(n=>n>profile.hoursPerWeek*60))throw new DomainError('CAPACITY','Work exceeds your weekly capacity.',422);
 if(!plan.tasks.some(t=>t.kind==='practical'))throw new DomainError('INVALID_PLAN','Practical activity is required.');
 const deferred=new Set(plan.deferredSkillIds);
 if(deferred.size!==plan.deferredSkillIds.length)throw new DomainError('INVALID_PLAN','Duplicate deferrals.');
 for(const id of deferred)if(!gaps.some(s=>s.id===id&&s.priority==='nice')||coverage.has(id))throw new DomainError('INVALID_PLAN','Invalid deferred skill.');
 for(const s of gaps)if(!coverage.has(s.id)&&!(s.priority==='nice'&&deferred.has(s.id)))throw new DomainError('INVALID_PLAN','Required gap is not covered.');
 return plan;
}
export function syntheticRoadmap(state:AppState):Roadmap {
 if(!state.profile.confirmed||!state.profile.inventoryConfirmed)throw new DomainError('ONBOARDING_REQUIRED','Save your profile and confirm your skills first.');
 if(!state.consents.roadmap_generation)throw new DomainError('CONSENT_REQUIRED','Enable roadmap consent in Privacy & settings.',403);
 const gaps=compare(state.skills).gaps;
 if(!gaps.length)throw new DomainError('NO_GAPS','No missing listed requirements. This does not certify competence.');
 if(gaps.length<4)throw new DomainError('DURATION_POLICY','This fixture cannot honestly occupy four weeks with these gaps. Your existing plan is preserved.',422);
 const capacity=state.profile.hoursPerWeek*60;
 if(gaps.some(s=>s.minutes>capacity))throw new DomainError('CAPACITY','A sample activity exceeds your weekly availability. Increase availability or retain the current plan.',422);
 // One independently meaningful activity per week: no inflated estimates or filler.
 const tasks=gaps.map((s,i)=>({week:i+1,kind:i===gaps.length-1?'practical' as const:'learning' as const,title:s.label,activity:s.activity,completionCriterion:s.outcome,skillIds:[s.id],resourceIds:[...s.resourceIds],estimatedMinutes:s.minutes}));
 const validated=validatePlan({outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks},state.profile,state.skills);
 return {id:crypto.randomUUID(),inputRevision:state.profile.planningRevision,catalogueVersion:catalogue.version,createdAt:new Date().toISOString(),deferredSkillIds:[],tasks:validated.tasks.map(t=>({...t,id:crypto.randomUUID(),completed:false,revision:0}))};
}
export function progress(plan:Roadmap|null){return !plan||!plan.tasks.length?null:Math.round(plan.tasks.filter(t=>t.completed).length/plan.tasks.length*100);}
export function emptyState(name='Learner'):AppState {return {name,profile:{currentRole:'',yearsExperience:0,hoursPerWeek:5,confirmed:false,inventoryConfirmed:false,planningRevision:0},skills:[],consents:{cv_extraction:false,roadmap_generation:false},roadmap:null,archivedRoadmaps:[]};}
export function demoState():AppState {const s=emptyState('Alex');s.profile={currentRole:'Senior QA Engineer',yearsExperience:7,hoursPerWeek:5,confirmed:true,inventoryConfirmed:true,planningRevision:1};s.skills=['test-design','api-testing','automation'].map(id=>canonicalize({canonicalSkillId:id,label:id}));return s;}
