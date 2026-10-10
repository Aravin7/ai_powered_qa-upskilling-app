import { catalogue } from './catalogue';
import { compare, DomainError } from './domain';
import { affirmativeEvidence, supportsCatalogueSkill } from './ai-output';
import { mockConfiguration } from './ai-config';
import type { Profile, SkillEntry } from './types';
export type ProviderInput={kind:'cv_extraction';text:string}|{kind:'roadmap_generation';profile:Pick<Profile,'hoursPerWeek'>;skills:Pick<SkillEntry,'canonicalSkillId'>[]};
export interface AIProvider {readonly model:string;respond(input:ProviderInput,signal:AbortSignal):Promise<unknown>}
export class ProviderFailure extends DomainError {
 constructor(code:'PROVIDER_REFUSED'|'PROVIDER_INCOMPLETE'|'PROVIDER_UNAVAILABLE',public retryable=true){super(code,'The AI provider could not supply a complete valid response. Existing data is preserved.',502)}
}
export const mockProvider:AIProvider={model:'mock-fixture-v1',async respond(input,signal){
 mockConfiguration();signal.throwIfAborted();
 if(input.kind==='cv_extraction'){
  const skills=catalogue.skills.flatMap(s=>{
   const evidence=input.text.split('\n').map(x=>x.trim()).find(line=>line.length<=400&&affirmativeEvidence(line)&&supportsCatalogueSkill(line,s));
   return evidence?[{skillId:s.id,label:s.label,evidenceExcerpt:evidence}]:[];
  });return {skills};
 }
 const known=input.skills.map(s=>({key:`id:${s.canonicalSkillId}`,canonicalSkillId:s.canonicalSkillId,label:'',source:'manual' as const}));
 const gaps=compare(known).gaps;
 if(gaps.length<4||gaps.some(s=>s.minutes>input.profile.hoursPerWeek*60))return {outcome:'infeasible',reason:'This mock scheduler has no valid proposal at this capacity/duration.',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
 return {outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks:gaps.map((s,i)=>({week:i+1,kind:i===gaps.length-1?'practical':'learning',title:s.label,activity:s.activity,completionCriterion:s.outcome,skillIds:[s.id],resourceIds:[...s.resourceIds],estimatedMinutes:s.minutes}))};
}};
