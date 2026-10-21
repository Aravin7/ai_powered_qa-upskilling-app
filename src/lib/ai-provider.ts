import { catalogue } from './catalogue';
import { compare, DomainError } from './domain';
import { candidateEvidence, evidenceClauses } from './ai-output';
import type { CvBlock } from './cv-text';
import { AI_LIMITS, mockConfiguration } from './ai-config';
import type { Profile, SkillEntry } from './types';
import { mockPathwayOutput, type PathwayProviderInput } from './pathways';
import { mockResearchOutput, type ResearchProviderInput } from './resource-preview';
import { mockReviewedPlan, type ReviewedRoadmapProviderInput } from './reviewed-roadmap';
export type ProviderInput=ReviewedRoadmapProviderInput|ResearchProviderInput|PathwayProviderInput|{kind:'cv_extraction';text:string;blocks?:CvBlock[];correction?:string}|{kind:'roadmap_generation';profile:Pick<Profile,'hoursPerWeek'>;skills:Pick<SkillEntry,'canonicalSkillId'>[]};
export interface AIProvider {readonly model:string;checkInput?(input:ProviderInput):void;respond(input:ProviderInput,signal:AbortSignal):Promise<unknown>}
export class ProviderFailure extends DomainError {
 constructor(code:'PROVIDER_REFUSED'|'PROVIDER_INCOMPLETE'|'PROVIDER_UNAVAILABLE'|'PROVIDER_TIMEOUT'|'PROVIDER_CONNECTION_FAILED'|'PROVIDER_RESPONSE_INTERRUPTED',public retryable=true,public readonly providerStatus?:number){super(code,code==='PROVIDER_TIMEOUT'?'The AI request exceeded its time limit. Existing data is preserved.':code==='PROVIDER_CONNECTION_FAILED'?'Could not obtain an HTTP response from the AI provider. Existing data is preserved.':code==='PROVIDER_RESPONSE_INTERRUPTED'?'The AI response was interrupted while reading it. Existing data is preserved.':providerStatus===401?'Groq rejected the server API key (HTTP 401). Check GROQ_API_KEY and restart the application. Existing data is preserved.':'The AI provider could not supply a complete valid response. Existing data is preserved.',502)}
}
// Search leaves time for the 5s page check, 12s selection and 3s save margin.
export function providerAttemptTimeout(input:ProviderInput,remainingMs:number){
 const search=input.kind==='resource_research'&&input.phase==='search';
 const available=remainingMs-(search?5000+AI_LIMITS.providerMs+3000:3000);
 if(available<=0)throw new DomainError('DEADLINE','Insufficient time for processing and saving. Existing data is preserved.',504);
 return Math.min(search?AI_LIMITS.resourceSearchMs:AI_LIMITS.providerMs,available);
}
// One timed attempt; accounting and retry decisions remain with the caller.
export async function timedProviderResponse(provider:AIProvider,input:ProviderInput,timeoutMs:number){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([
  provider.respond(input,controller.signal),
  new Promise<never>((_,reject)=>{timer=setTimeout(()=>{
   const failure=new ProviderFailure('PROVIDER_TIMEOUT');
   reject(failure);controller.abort(failure);
  },Math.max(1,timeoutMs));}),
 ]);}finally{clearTimeout(timer);controller.abort();}
}
export const mockProvider:AIProvider={model:'mock-fixture-v1',async respond(input,signal){
 mockConfiguration();signal.throwIfAborted();
 if(input.kind==='reviewed_roadmap')return mockReviewedPlan(input.context);
 if(input.kind==='resource_research')return mockResearchOutput(input);
 if(input.kind==='pathway_suggestions')return mockPathwayOutput(input);
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
