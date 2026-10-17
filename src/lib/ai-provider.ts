import { catalogue } from './catalogue';
import { compare, DomainError } from './domain';
import { candidateEvidence, evidenceClauses } from './ai-output';
import type { CvBlock } from './cv-text';
import { mockConfiguration } from './ai-config';
import type { Profile, SkillEntry } from './types';
export type ProviderInput={kind:'cv_extraction';text:string;blocks?:CvBlock[];correction?:string}|{kind:'roadmap_generation';profile:Pick<Profile,'hoursPerWeek'>;skills:Pick<SkillEntry,'canonicalSkillId'>[]};
export interface AIProvider {readonly model:string;checkInput?(input:ProviderInput):void;respond(input:ProviderInput,signal:AbortSignal):Promise<unknown>}
export class ProviderFailure extends DomainError {
 constructor(code:'PROVIDER_REFUSED'|'PROVIDER_INCOMPLETE'|'PROVIDER_UNAVAILABLE',public retryable=true,public readonly providerStatus?:number){super(code,providerStatus===401?'Groq rejected the server API key (HTTP 401). Check GROQ_API_KEY and restart the application. Existing data is preserved.':'The AI provider could not supply a complete valid response. Existing data is preserved.',502)}
}
export const mockProvider:AIProvider={model:'mock-fixture-v1',async respond(input,signal){
 mockConfiguration();signal.throwIfAborted();
 if(input.kind==='cv_extraction'){
  const skills=catalogue.skills.flatMap(s=>{
   const blocks=input.blocks??input.text.split('\n').map((text,i)=>({id:`cv-${i+1}`,section:'uncertain' as const,text}));
   for(const block of blocks)for(const excerpt of evidenceClauses(block.text)){
    if(excerpt.length<=400&&candidateEvidence(block,excerpt,s))return [{skillId:s.id,label:s.label,evidenceExcerpt:excerpt,sourceId:block.id}];
   }
   return [];
  });return {skills};
 }
 const known=input.skills.map(s=>({key:`id:${s.canonicalSkillId}`,canonicalSkillId:s.canonicalSkillId,label:'',source:'manual' as const}));
 const gaps=compare(known).gaps;
 if(gaps.length<4||gaps.some(s=>s.minutes>input.profile.hoursPerWeek*60))return {outcome:'infeasible',reason:'This mock scheduler has no valid proposal at this capacity/duration.',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
 return {outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks:gaps.map((s,i)=>({week:i+1,kind:i===gaps.length-1?'practical':'learning',title:s.label,activity:s.activity,completionCriterion:s.outcome,skillIds:[s.id],resourceIds:[...s.resourceIds],estimatedMinutes:s.minutes}))};
}};
