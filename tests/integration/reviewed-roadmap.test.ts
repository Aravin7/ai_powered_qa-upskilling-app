import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, patchTask, putConsent, putProfile, putSkills, type Claims } from '../../src/lib/store';
import { activateRequirementSnapshot, registerRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { getReviewedGaps, saveReviewedDirection } from '../../src/lib/reviewed-direction';
import { generateRoadmap, researchReviewedResources } from '../../src/lib/ai-operations';
import { mockProvider, ProviderFailure, type AIProvider, type ProviderInput } from '../../src/lib/ai-provider';
import { mockResearchOutput, validateResearchEnvelope, validateMockResourcePreview } from '../../src/lib/resource-preview';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { syntheticReviewedLibrary } from '../fixtures/reviewed-planning';
import type { RequirementLibrary } from '../../src/lib/requirements';

const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Only an isolated local qa_pathways_* TEST_DATABASE_URL is permitted.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims;let library:RequirementLibrary;let planId:string;let budgetId:string;
const emailList:string[]=[];
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-reviewed-roadmap-signing-secret');
 budgetId=`reviewed-plan-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);
 await first.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:100,expiresAt:new Date(Date.now()+3600000)}});
 await first.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
 library=syntheticReviewedLibrary(2);await registerRequirementSnapshot(first,library,'synthetic reviewed planning test');await activateRequirementSnapshot(first,library.version);
 const email=`reviewed-plan-${crypto.randomUUID()}@example.invalid`;emailList.push(email);await first.invitation.create({data:{email}});
 const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Learner');claims={id:user.id,email,sessionVersion:0};
 await putProfile(first,claims,{currentRole:'Synthetic QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,claims,{expectedRevision:1,entries:[],removals:[]});
 await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION});
 await saveReviewedDirection(first,claims,{version:library.version,directionId:'qa',deferredCapabilityIds:[],expectedPlanningRevision:2});
 const plan=await first.roadmap.create({data:{userId:claims.id,inputRevision:2,catalogueVersion:catalogue.version,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:'Previous synthetic task',activity:'Previous work',completionCriterion:'Previous result',kind:'practical',skillIds:['automation'],resourceIds:[],estimatedMinutes:30,completed:true}))}}});planId=plan.id;
});
afterEach(async()=>{await first.user.deleteMany({where:{email:{in:emailList}}});await first.invitation.deleteMany({where:{email:{in:emailList}}});await first.fundingBudget.deleteMany({where:{id:budgetId}});vi.unstubAllEnvs();});
afterAll(async()=>{await first.requirementActivation.deleteMany({where:{id:'active'}});await first.$disconnect();await second.$disconnect();});
const request=(operationKey=crypto.randomUUID())=>({operationKey,expectedPlanningRevision:3,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:true});
const oldPlan=()=>first.roadmap.findUniqueOrThrow({where:{id:planId},include:{tasks:{orderBy:{position:'asc'}}}});
const attempts=()=>first.aIAttempt.count({where:{operation:{userId:claims.id}}});
async function seedResources(){
 // Controlled resource preconditions for transaction tests. This helper makes
 // no requests and does not claim live verification or exercise research dispatch.
 const comparison=(await getReviewedGaps(first,claims))!;
 const resourcePreviews=library.capabilities.map(topic=>{
  const context={pathwayId:'qa',pathwayTitle:'Synthetic QA direction',topicId:topic.id,topicTitle:topic.label};
  const envelope=validateResearchEnvelope(mockResearchOutput({kind:'resource_research',phase:'search',context}));
  const selection=mockResearchOutput({kind:'resource_research',phase:'select',context,candidates:envelope.candidates});
  return {...validateMockResourcePreview(context,envelope,selection),mode:'mock',model:'fixture-seed',inputRevision:3,libraryVersion:library.version,requirementSetId:comparison.requirementSetId,operationId:crypto.randomUUID()};
 });
 await first.reviewedDirection.update({where:{userId:claims.id},data:{resourcePreviews}});
}
function provider(respond:AIProvider['respond']):AIProvider{return {model:'synthetic-controlled-provider',respond};}

it('IT-RR01 R07/R08/R15: real resource operations then plan replacement preserve archived progress and reload frozen resources',async()=>{
 const calls:ProviderInput[]=[];const spy=provider(async(input,signal)=>{calls.push(input);return mockProvider.respond(input,signal);});
 for(const topic of library.capabilities)await researchReviewedResources(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:3,topicId:topic.id},spy);
 expect(await attempts()).toBe(4);
 const result=await generateRoadmap(first,claims,request(),spy);
 expect(result.code).toBe('MOCK_PLAN_SAVED');expect(await attempts()).toBe(5);expect(calls.map(call=>call.kind)).toEqual(['resource_research','resource_research','resource_research','resource_research','reviewed_roadmap']);
 expect(JSON.stringify(calls)).not.toContain(claims.email);expect(JSON.stringify(calls)).not.toContain(claims.id);
 const saved=(await getState(second,claims)).roadmap!;expect(saved.reviewed).toMatchObject({mode:'mock',libraryVersion:library.version});expect(saved.reviewed?.resources).toHaveLength(2);
 expect(saved.tasks).toHaveLength(5);expect(saved.tasks.every(task=>!task.completed&&task.revision===0)).toBe(true);
 expect((await oldPlan()).status).toBe('archived');expect((await oldPlan()).tasks.every(task=>task.completed)).toBe(true);
 await patchTask(first,claims,saved.tasks[0].id,{completed:true,expectedTaskRevision:0});expect((await getState(second,claims)).roadmap!.tasks[0].completed).toBe(true);
 await saveReviewedDirection(first,claims,{version:library.version,directionId:null,deferredCapabilityIds:[],expectedPlanningRevision:3});
 expect((await getState(second,claims)).roadmap!.reviewed?.resources).toEqual(saved.reviewed!.resources);
});
it('IT-RR10 R11: sixth attempt across resource research and planning is denied and uncertain attempts stay reserved',async()=>{
 for(const topic of library.capabilities)await researchReviewedResources(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:3,topicId:topic.id});
 await generateRoadmap(first,claims,request());const before=(await getState(first,claims)).roadmap;
 const spy=provider(vi.fn());await expect(generateRoadmap(second,claims,request(),spy)).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});
 expect(spy.respond).not.toHaveBeenCalled();expect(await attempts()).toBe(5);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(5);
 expect((await getState(first,claims)).roadmap).toEqual(before);
});
it('IT-RR02 R03/R07: missing resources, missing consent and empty-inventory acknowledgment prevent dispatch',async()=>{
 const spy=provider(vi.fn());const before=await oldPlan();
 await expect(generateRoadmap(first,claims,request(),spy)).rejects.toMatchObject({code:'RESOURCE_VERIFICATION_REQUIRED'});
 await seedResources();await expect(generateRoadmap(first,claims,{...request(),introductoryPlanAcknowledged:false},spy)).rejects.toMatchObject({code:'ACKNOWLEDGMENT_REQUIRED'});
 await putConsent(first,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});
 await expect(generateRoadmap(first,claims,request(),spy)).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect(spy.respond).not.toHaveBeenCalled();expect(await attempts()).toBe(0);expect(await oldPlan()).toEqual(before);
});
it('IT-RR03 R07/R11: invalid then valid response uses two attempts and a bounded correction',async()=>{
 await seedResources();let calls=0;let corrected=false;
 const result=await generateRoadmap(first,claims,request(),provider(async(input,signal)=>{calls++;if(calls===1)return {outcome:'plan',tasks:[]};corrected=input.kind==='reviewed_roadmap'&&input.correction==='INVALID_OUTPUT';return mockProvider.respond(input,signal);}));
 expect(result.code).toBe('MOCK_PLAN_SAVED');expect(corrected).toBe(true);expect(calls).toBe(2);expect(await attempts()).toBe(2);
});
it.each([false,true])('IT-RR11 R07/R11: unsupported infeasibility receives bounded correction; terminal=%s',async terminal=>{
 await seedResources();const before=await oldPlan();const inputs:ProviderInput[]=[];
 const spy=provider(async(input,signal)=>{
  inputs.push(input);
  if(inputs.length===1||terminal)return {outcome:'infeasible',reason:'Synthetic unsupported claim',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
  return mockProvider.respond(input,signal);
 });
 const result=generateRoadmap(first,claims,request(),spy);
 if(terminal){await expect(result).rejects.toMatchObject({code:'UNVERIFIED_INFEASIBLE'});expect(await oldPlan()).toEqual(before);}
 else expect((await result).code).toBe('MOCK_PLAN_SAVED');
 expect(inputs).toHaveLength(2);expect(inputs[1]).toMatchObject({kind:'reviewed_roadmap',correction:'UNVERIFIED_INFEASIBLE'});
 expect(await attempts()).toBe(2);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(2);
});
it('IT-RR04 R07/R11: terminal invalid output consumes only two attempts and preserves old plan/progress',async()=>{
 await seedResources();const before=await oldPlan();const spy=provider(vi.fn(async()=>({outcome:'plan',tasks:[]})));
 await expect(generateRoadmap(first,claims,request(),spy)).rejects.toMatchObject({code:'INVALID_OUTPUT'});
 expect(spy.respond).toHaveBeenCalledTimes(2);expect(await attempts()).toBe(2);expect(await oldPlan()).toEqual(before);
});
it('IT-RR05 R09: same-key replay has no dispatch; changed input conflicts and old snapshots remain frozen',async()=>{
 await seedResources();const body=request();const spy=provider(vi.fn(mockProvider.respond));
 const firstResult=await generateRoadmap(first,claims,body,spy);const replay=await generateRoadmap(second,claims,body,spy);
 expect(replay.code).toBe('REPLAY');expect(replay.state.roadmap?.id).toBe(firstResult.state.roadmap?.id);expect(spy.respond).toHaveBeenCalledTimes(1);
 await expect(generateRoadmap(first,claims,{...body,introductoryPlanAcknowledged:false},spy)).rejects.toMatchObject({code:'KEY_CONFLICT'});
 expect(await first.roadmap.count({where:{userId:claims.id,status:'active'}})).toBe(1);
});
it.each(['profile','withdrawal','catalogue','deadline','deletion'])('IT-RR06-%s R03/R09/R10/R11: late results cannot activate',async change=>{
 await seedResources();const before=await oldPlan();
 const spy=provider(async(input,signal)=>{
  const output=await mockProvider.respond(input,signal);
  if(change==='profile')await putProfile(second,claims,{currentRole:'Changed QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:3});
  if(change==='withdrawal')await putConsent(second,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});
  if(change==='catalogue'){const next=syntheticReviewedLibrary(2);await registerRequirementSnapshot(second,next,'synthetic newer version');await activateRequirementSnapshot(second,next.version);}
  if(change==='deadline')await second.aIOperation.updateMany({where:{userId:claims.id,state:'running'},data:{deadline:new Date(Date.now()-1)}});
  if(change==='deletion')await deleteAccount(second,claims);
  return output;
 });
 await expect(generateRoadmap(first,claims,request(),spy)).rejects.toBeDefined();
 if(change==='deletion'){expect(await first.user.count({where:{id:claims.id}})).toBe(0);expect(await first.roadmap.count({where:{userId:claims.id}})).toBe(0);}
 else{expect(await oldPlan()).toEqual(before);expect(await first.roadmap.count({where:{userId:claims.id,status:'active'}})).toBe(1);}
});
it('IT-RR07 R08/R09: failed activation transaction rolls back archive and new tasks',async()=>{
 await seedResources();const before=await oldPlan();
 await first.$executeRawUnsafe('ALTER TABLE "RoadmapTask" ADD CONSTRAINT "rr_synthetic_failure" CHECK (title <> \'Study Synthetic QA topic 1\') NOT VALID');
 try{await expect(generateRoadmap(first,claims,request())).rejects.toBeDefined();expect(await oldPlan()).toEqual(before);expect(await first.roadmap.count({where:{userId:claims.id}})).toBe(1);}
 finally{await first.$executeRawUnsafe('ALTER TABLE "RoadmapTask" DROP CONSTRAINT "rr_synthetic_failure"');}
 const result=await generateRoadmap(second,claims,request());expect(result.code).toBe('MOCK_PLAN_SAVED');
});
it('IT-RR08 R09/R11: two instances cannot dispatch or activate duplicate concurrent operations',async()=>{
 await seedResources();let release!:()=>void;let entered!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});const hold=new Promise<void>(resolve=>{release=resolve;});
 const body=request();const pending=generateRoadmap(first,claims,body,provider(async(input,signal)=>{entered();await hold;return mockProvider.respond(input,signal);}));
 await started;
 try{await expect(generateRoadmap(second,claims,request())).rejects.toMatchObject({code:'OPERATION_BUSY'});const replay=await generateRoadmap(second,claims,body);expect(replay.operation?.state).toBe('running');expect(await attempts()).toBe(1);}
 finally{release();}
 await pending;expect(await first.roadmap.count({where:{userId:claims.id,status:'active'}})).toBe(1);
});
it('IT-RR09 R11/R15: failed selection phase preserves earlier topic resources and plan without a third dispatch',async()=>{
 await seedResources();const before=await getState(first,claims);const spy=provider(vi.fn(async(input,signal)=>{if(input.kind==='resource_research'&&input.phase==='select')throw new ProviderFailure('PROVIDER_UNAVAILABLE');return mockProvider.respond(input,signal);}));
 await expect(researchReviewedResources(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:3,topicId:library.capabilities[0].id},spy)).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
 expect(spy.respond).toHaveBeenCalledTimes(2);expect(await attempts()).toBe(2);expect(await getState(second,claims)).toEqual(before);
});
