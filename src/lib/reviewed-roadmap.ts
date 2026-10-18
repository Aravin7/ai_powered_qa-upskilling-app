import type { z } from 'zod';
import { DomainError, planSchema } from './domain';
import { roadmapOutputSchema } from './ai-output';
import { compareDirectionRequirements, directionWorkload, type RequirementLibrary } from './requirements';

export type ReviewedResourcePair={topicId:string;documentationId:string;supportingId:string};
type Plan=z.infer<typeof planSchema>;
type Task=Omit<Plan['tasks'][number],'week'>;
export type ReviewedActivity={id:string;dependencies:string[];task:Task};
export type ReviewedPlanContext={requirementSetId:string;libraryVersion:string;contentDigest:string;directionId:string;hoursPerWeek:number;confirmedSkillIds:string[];deferredSkillIds:string[];activities:ReviewedActivity[];totalMinutes:number};
export type ReviewedRoadmapProviderInput={kind:'reviewed_roadmap';context:ReviewedPlanContext;correction?:string};

/** Server-only compiler. Resource IDs come from owned, validated snapshots.
 * This does not attest page availability or professional resource review.
 * AI arranges exact reviewed activities without filler or duplicate setup. */
export function reviewedPlanContext(input:{library:RequirementLibrary;selection:{directionId:string;deferredCapabilityIds:string[]};inventory:{canonicalSkillId:string|null;label:string;meaningVersion:string|null}[];hoursPerWeek:number;resources:ReviewedResourcePair[];now?:Date}):ReviewedPlanContext{
 const {library,selection,inventory,resources}=input;const now=input.now??new Date();
 if(!Number.isInteger(input.hoursPerWeek)||input.hoursPerWeek<1||input.hoursPerWeek>40)throw new DomainError('INVALID_CAPACITY','Weekly availability must be a whole number from 1 to 40.');
 const comparison=compareDirectionRequirements(library,selection,inventory,now);
 if(comparison.reconfirmationIds.length)throw new DomainError('SKILL_REVIEW_REQUIRED','Confirm changed skill meanings before planning.',409);
 if(comparison.outcome==='no_gaps')throw new DomainError('NO_GAPS','No missing listed requirements. This does not certify competence.',409);
 const gaps=comparison.requirements.filter(item=>item.evidence==='not_established');
 const workload=directionWorkload(library,selection,comparison.strengthIds,now);
 const pairs=new Map<string,ReviewedResourcePair>();
 for(const pair of resources){
  if(pairs.has(pair.topicId)||!gaps.some(item=>item.id===pair.topicId)||!pair.documentationId||!pair.supportingId||pair.documentationId===pair.supportingId)
   throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Each learning topic needs a distinct documentation and supporting resource pair.',409);
  pairs.set(pair.topicId,pair);
 }
 const activities:ReviewedActivity[]=[];const setups=new Set<string>();
 for(const gap of gaps){
  const pair=pairs.get(gap.id);if(!pair)throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Research resources for every retained learning topic before generating a plan.',409);
  const resourceIds=[pair.documentationId,pair.supportingId];const effort=gap.effort!;
  const prerequisites=gap.prerequisites.filter(id=>!comparison.strengthIds.includes(id)).map(id=>`${id}:practice`);
  const setup=effort.sharedSetup;
  if(setup&&!setups.has(setup.id)){
   activities.push({id:`setup:${setup.id}`,dependencies:[],task:{kind:'learning',title:`Prepare ${gap.label}`,activity:setup.activity,completionCriterion:`Verify that the setup works for ${gap.label}.`,skillIds:[gap.id],resourceIds,estimatedMinutes:effort.setupMinutes}});
   setups.add(setup.id);
  }
  const dependencies=[...prerequisites,...(setup?[`setup:${setup.id}`]:[])];
  if(effort.readingMinutes>0)activities.push({id:`${gap.id}:read`,dependencies,task:{kind:'learning',title:`Study ${gap.label}`,activity:`Read the documentation and supporting material for ${gap.label}.`,completionCriterion:`Explain the included scope and starting knowledge for ${gap.label}.`,skillIds:[gap.id],resourceIds,estimatedMinutes:effort.readingMinutes}});
  activities.push({id:`${gap.id}:practice`,dependencies:[...dependencies,...(effort.readingMinutes>0?[`${gap.id}:read`]:[])],task:{kind:'practical',title:`Practise ${gap.label}`,activity:gap.activity,completionCriterion:gap.outcome,skillIds:[gap.id],resourceIds:effort.readingMinutes>0?[]:resourceIds,estimatedMinutes:effort.practiceMinutes+effort.reviewMinutes+effort.troubleshootingMinutes}});
 }
 // Validate content against the same bounded contract as provider proposals.
 if(!planSchema.safeParse({outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:comparison.deferredCapabilityIds,tasks:activities.map(item=>({...item.task,week:1}))}).success)
  throw new DomainError('CONTENT_PLAN_LIMIT','Reviewed activities exceed the configured task or field limits. Content review is required.',409);
 return {requirementSetId:comparison.requirementSetId,libraryVersion:comparison.libraryVersion,contentDigest:comparison.contentDigest,directionId:comparison.directionId,hoursPerWeek:input.hoursPerWeek,confirmedSkillIds:comparison.strengthIds,deferredSkillIds:comparison.deferredCapabilityIds,activities,totalMinutes:workload.totalMinutes};
}

function taskIdentity(task:Task){return JSON.stringify([task.kind,task.title,task.activity,task.completionCriterion,task.skillIds,task.resourceIds,task.estimatedMinutes]);}
export function validateReviewedPlan(context:ReviewedPlanContext,output:unknown):Plan{
 const proposal=roadmapOutputSchema.parse(output);
 if(proposal.outcome==='infeasible'){
  if(proposal.constraintCode==='capacity'&&(context.totalMinutes>context.hoursPerWeek*60*12||context.activities.some(item=>item.task.estimatedMinutes>context.hoursPerWeek*60)))throw new DomainError('CAPACITY','Reviewed work exceeds weekly or twelve-week capacity. The existing plan is preserved.',422);
  if(proposal.constraintCode==='duration_policy'&&context.activities.length<4)throw new DomainError('DURATION_POLICY','These reviewed activities cannot occupy four weeks without filler. The existing plan is preserved.',422);
  throw new DomainError('UNVERIFIED_INFEASIBLE','No valid plan was returned; this does not prove that a feasible schedule is impossible.',502);
 }
 const sameIds=(a:string[],b:string[])=>a.length===b.length&&[...a].sort().every((id,index)=>id===[...b].sort()[index]);
 if(!sameIds(proposal.deferredSkillIds,context.deferredSkillIds))throw new DomainError('INVALID_PLAN','Deferrals must match the learner’s saved reviewed selection.',502);
 const expected=new Map(context.activities.map(item=>[taskIdentity(item.task),item]));
 if(expected.size!==context.activities.length)throw new DomainError('CONTENT_PLAN_LIMIT','Reviewed activity identities must be distinct.',409);
 const seen=new Set<string>();const weekly=new Map<number,number>();let previousWeek=1;
 for(const task of proposal.tasks){
  const activity=expected.get(taskIdentity(task));
  if(!activity||seen.has(activity.id))throw new DomainError('INVALID_PLAN','Tasks must match reviewed activities, effort and resource bindings exactly once.',502);
  if(activity.dependencies.some(id=>!seen.has(id)))throw new DomainError('INVALID_PLAN','Setup, reading and unconfirmed prerequisites must precede dependent work.',502);
  if(task.week<previousWeek)throw new DomainError('INVALID_PLAN','Tasks must be ordered by relative week.',502);
  previousWeek=task.week;seen.add(activity.id);weekly.set(task.week,(weekly.get(task.week)??0)+task.estimatedMinutes);
 }
 if(seen.size!==context.activities.length||!proposal.tasks.some(task=>task.kind==='practical'))throw new DomainError('INVALID_PLAN','All retained reviewed activities and practical work must be covered.',502);
 const weeks=[...weekly.keys()];
 if(weeks.length<4||weeks.some((week,index)=>week!==index+1))throw new DomainError('INVALID_PLAN','Use four to twelve contiguous occupied weeks beginning at one.',502);
 if([...weekly.values()].some(minutes=>minutes>context.hoursPerWeek*60))throw new DomainError('INVALID_PLAN','A proposed week exceeds declared availability.',502);
 return proposal;
}

/** Synthetic response only; never substituted for failed live model output. */
export function mockReviewedPlan(context:ReviewedPlanContext){
 const capacity=context.hoursPerWeek*60;
 if(context.activities.length<4)return {outcome:'infeasible',reason:'Too few reviewed activities for four occupied weeks.',constraintCode:'duration_policy',deferredSkillIds:[],tasks:[]};
 if(context.totalMinutes>capacity*12||context.activities.some(item=>item.task.estimatedMinutes>capacity))return {outcome:'infeasible',reason:'Reviewed work exceeds capacity.',constraintCode:'capacity',deferredSkillIds:[],tasks:[]};
 let week=1;let minutes=0;
 const tasks=context.activities.map((item,index)=>{
  // Reserve enough remaining activities for the minimum four occupied weeks.
  if(minutes>0&&(minutes+item.task.estimatedMinutes>capacity||context.activities.length-index<=4-week)){week++;minutes=0;}
  minutes+=item.task.estimatedMinutes;return {...item.task,week};
 });
 if(week>12)return {outcome:'infeasible',reason:'The synthetic scheduler did not find a valid plan.',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
 return {outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:context.deferredSkillIds,tasks};
}
