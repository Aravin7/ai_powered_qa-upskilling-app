import { afterAll,afterEach,beforeEach,expect,it,vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { admitGoogle,getState,putProfile,putSkills,putConsent,patchTask,type Claims } from '../../src/lib/store';
import { extractSkills,generateRoadmap } from '../../src/lib/ai-operations';
import { configurationVersion } from '../../src/lib/ai-execution';
import { syntheticWorkflowConfiguration } from '../fixtures/groq-configuration';
import { createHash } from 'node:crypto';
import { syntheticReviewedLibrary } from '../fixtures/reviewed-planning';
import { registerRequirementSnapshot, activateRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { saveReviewedDirection, getReviewedGaps, selectedDirectionPlanning } from '../../src/lib/reviewed-direction';
import { mockReviewedPlan, type ReviewedPlanContext } from '../../src/lib/reviewed-roadmap';
import { syntheticPdf } from '../synthetic-pdf';
const url=process.env.TEST_DATABASE_URL;
if(!url)throw new Error('BLOCKED: separate migrated TEST_DATABASE_URL required.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims;let budgetId:string;let policyVersion:string;
const emails:string[]=[];
let pilot=syntheticWorkflowConfiguration();
const request=()=>({operationKey:crypto.randomUUID(),expectedPlanningRevision:3,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});
let library=syntheticReviewedLibrary(2);
let context:ReviewedPlanContext;
const proposal=()=>mockReviewedPlan(context);
const response=(output:unknown)=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
async function learner(){
 const email=`groq-${crypto.randomUUID()}@example.invalid`;emails.push(email);
 await first.invitation.create({data:{email}});const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic API Learner');
 const c={id:user.id,email,sessionVersion:0};
 await putProfile(first,c,{currentRole:'QA engineer',yearsExperience:6,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,c,{entries:catalogue.skills.slice(0,3).map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:1});
 for(const purpose of ['cv_extraction','roadmap_generation'])await putConsent(first,c,{purpose,granted:true,policyVersion});
 await saveReviewedDirection(first,c,{version:library.version,directionId:'qa',deferredCapabilityIds:[],expectedPlanningRevision:2});
 const comparison=(await getReviewedGaps(first,c))!;
 // Persist synthetic resource preconditions only; no real source/page checks.
 const resourcePreviews=library.capabilities.map(topic=>({
  pathwayId:'qa',pathwayTitle:'Synthetic QA direction',topicId:topic.id,topicTitle:topic.label,
  professionalReview:null,mode:'groq',model:pilot.model,inputRevision:3,libraryVersion:library.version,requirementSetId:comparison.requirementSetId,operationId:crypto.randomUUID(),
  resources:['documentation','tutorial'].map((kind,index)=>{
   const url=`https://${index?'lessons':'docs'}.example.org/topics/${topic.id}`;
   const hash=createHash('sha256').update(url).digest('hex');
   return {id:`resource-${hash}`,sourceId:`groq-${hash}`,url,kind,title:'Synthetic resource fixture',publisher:'Synthetic publisher',accessNote:'Synthetic page evidence only',checkedAt:new Date().toISOString(),reviewStatus:'automatically_checked',citation:{requestId:'synthetic-fixture',toolIndex:0,resultIndex:index,resultType:'browser'}};
  }),
 }));
 await first.reviewedDirection.update({where:{userId:c.id},data:{resourcePreviews}});
 context=(await first.$transaction(tx=>selectedDirectionPlanning(tx,c.id)))!.context;
 return c;
}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','groq');vi.stubEnv('GROQ_FREE_PLAN_CONFIRMED','true');vi.stubEnv('AI_SIGNING_SECRET','synthetic-groq-control-signing-secret');vi.stubEnv('GROQ_API_KEY','synthetic-key-not-a-real-credential');
 budgetId=`groq-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);pilot=syntheticWorkflowConfiguration();
 const version=configurationVersion(pilot);policyVersion=`groq-disclosure-v1-${version}`;
 await first.fundingBudget.create({data:{id:budgetId,mode:'groq',currency:'REQUESTS',pricingVersion:version,ceiling:pilot.ceilingRequests,expiresAt:new Date(pilot.expiresAt),configuration:pilot}});
 await first.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
 library=syntheticReviewedLibrary(2);await registerRequirementSnapshot(first,library,'Synthetic control tests only');await activateRequirementSnapshot(first,library.version);
 claims=await learner();
 // Any unexpected outbound request fails locally; each executable case replaces this interceptor.
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Unexpected synthetic dispatch');}));
});
afterEach(async()=>{
 await first.user.deleteMany({where:{email:{in:emails}}});await first.invitation.deleteMany({where:{email:{in:emails}}});emails.length=0;
 await first.fundingBudget.deleteMany({where:{id:budgetId}});
 vi.unstubAllEnvs();vi.unstubAllGlobals();
});
afterAll(async()=>{await first.requirementActivation.deleteMany({where:{id:'active'}});await first.$disconnect();await second.$disconnect();});
it('GR-04 / R03/R11: old consent, missing free-plan confirmation/key and production block dispatch with zero attempts',async()=>{
 await expect(putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION})).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 vi.stubEnv('GROQ_FREE_PLAN_CONFIRMED','false');
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 vi.stubEnv('GROQ_FREE_PLAN_CONFIRMED','true');vi.stubEnv('GROQ_API_KEY','');
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'AI_CONFIGURATION'});
 expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);expect(fetch).not.toHaveBeenCalled();
 vi.stubEnv('NODE_ENV','production');
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect(fetch).not.toHaveBeenCalled();
});
it('GR-05 / R04/R07/R11: service selects Groq after shared request reservation; CV and roadmap share it',async()=>{
 expect(catalogue.reviewed).toBe(false); // Local synthetic demo, never forged professional review.
 const http=vi.fn(async(url:unknown,init?:RequestInit)=>{
  expect(String(url)).toBe('https://api.groq.com/openai/v1/chat/completions');
  const budget=await second.fundingBudget.findUniqueOrThrow({where:{id:budgetId}});expect(budget.reserved).toBeGreaterThanOrEqual(1);
  const body=JSON.parse(String(init?.body));expect(body.max_completion_tokens).toBe(pilot.maxOutputTokens);expect(body.tools).toBeUndefined();
  return response(body.messages[0].content.startsWith('Extract')?{skills:[{skillId:'api-testing',label:'API testing',evidenceExcerpt:'I performed API testing on a local service.'}]}:proposal());
 });vi.stubGlobal('fetch',http);
 const extraction=await extractSkills(first,claims,syntheticPdf(['I performed API testing on a local service.']),crypto.randomUUID());expect(extraction.candidates).toHaveLength(1);
 const saved=await generateRoadmap(first,claims,request());expect(saved.code).toBe('PLAN_SAVED');
 expect(http).toHaveBeenCalledTimes(2);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(2);
 expect((await first.roadmap.findUniqueOrThrow({where:{id:saved.state.roadmap!.id}})).modelVersion).toBe(pilot.model);
},15000);
it('GR-06 / R07/R11: invalid outputs consume both reservations and preserve old plan/progress; a new-key recovery succeeds',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const original=await generateRoadmap(first,claims,request());
 await patchTask(first,claims,original.state.roadmap!.tasks[0].id,{completed:true,expectedTaskRevision:0});
 const http=vi.fn(async()=>response({skills:[]}));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'INVALID_OUTPUT'});expect(http).toHaveBeenCalledTimes(2);
 const preserved=(await getState(first,claims)).roadmap!;expect(preserved.id).toBe(original.state.roadmap!.id);expect(preserved.tasks[0].completed).toBe(true);
 expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3);
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const recovered=await generateRoadmap(first,claims,request());expect(recovered.state.roadmap!.id).not.toBe(preserved.id);expect(recovered.state.roadmap!.tasks.every(task=>!task.completed)).toBe(true);
});
it('GR-16a / R07/R11: a false infeasibility claim gets one bounded correction attempt',async()=>{
 const infeasible={outcome:'infeasible',reason:'No schedule',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
 const http=vi.fn().mockResolvedValueOnce(response(infeasible)).mockResolvedValueOnce(response(proposal()));vi.stubGlobal('fetch',http);
 const saved=await generateRoadmap(first,claims,request());
 expect(saved.code).toBe('PLAN_SAVED');expect(saved.state.roadmap?.tasks).toHaveLength(context.activities.length);
 expect(http).toHaveBeenCalledTimes(2);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(2);
});
it('GR-16b / R07/R11: two false infeasibility claims retain the prior plan and progress',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const original=await generateRoadmap(first,claims,request());
 await patchTask(first,claims,original.state.roadmap!.tasks[0].id,{completed:true,expectedTaskRevision:0});
 const infeasible={outcome:'infeasible',reason:'No schedule',constraintCode:'undetermined',deferredSkillIds:[],tasks:[]};
 const http=vi.fn(async()=>response(infeasible));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'UNVERIFIED_INFEASIBLE'});
 expect(http).toHaveBeenCalledTimes(2);
 const preserved=(await getState(first,claims)).roadmap!;expect(preserved.id).toBe(original.state.roadmap!.id);expect(preserved.tasks[0].completed).toBe(true);
 expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3);
});
it('GR-07 / R11: revocation from another instance during dispatched work prevents late activation without refund',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{await second.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});return response(proposal());}));
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'FUNDING_STOP'});
 expect((await getState(first,claims)).roadmap).toBeNull();expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);expect(fetch).toHaveBeenCalledTimes(1);
});
it('GR-08 / R11: two instances/users race for one remaining request; only one dispatches',async()=>{
 const other=await learner();await first.fundingBudget.update({where:{id:budgetId},data:{reserved:pilot.ceilingRequests-1}});
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);
 const results=await Promise.allSettled([generateRoadmap(first,claims,request()),generateRoadmap(second,other,request())]);
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(http).toHaveBeenCalledTimes(1);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(pilot.ceilingRequests);
});
it('GR-09 / R03/R11: changed notice invalidates existing consent before any dispatch',async()=>{
 const changed={...pilot,privacyNotice:pilot.privacyNotice+' Changed provider terms.'};const version=configurationVersion(changed);
 await second.fundingBudget.update({where:{id:budgetId},data:{configuration:changed,pricingVersion:version}});
 expect((await getState(first,claims)).consents.roadmap_generation).toBe(false);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});expect(fetch).not.toHaveBeenCalled();
});
it('GR-10 / R04/R11: request above configured byte ceiling is rejected before reservation or dispatch',async()=>{
 const changed={...pilot,maxRequestBytes:1};const version=configurationVersion(changed);
 await first.fundingBudget.update({where:{id:budgetId},data:{configuration:changed,pricingVersion:version}});
 await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:`groq-disclosure-v1-${version}`});
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'PROVIDER_INPUT_LIMIT'});
 expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
it('GR-11 / R11: invalid credentials produce one dispatch/reservation and no hidden retry or refund',async()=>{
 const http=vi.fn(async()=>new Response('do not read private echoed error',{status:401}));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
 expect(http).toHaveBeenCalledTimes(1);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
});
it('GR-12 / R06/R11: no gaps bypasses revoked funding with zero extra calls and preserves the plan',async()=>{
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);const original=await generateRoadmap(first,claims,request());
 // Explicitly seed confirmed synthetic meanings for the reviewed no-gap case.
 const skills=await first.confirmedSkill.findMany({where:{userId:claims.id},orderBy:{id:'asc'}});
 await first.capabilityConfirmation.createMany({data:library.capabilities.map((topic,index)=>({skillId:skills[index].id,capabilityId:topic.id,meaningVersion:topic.meaningVersion,snapshotVersion:library.version}))});
 await first.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});
 const result=await generateRoadmap(first,claims,{...request(),expectedPlanningRevision:3});expect(result.code).toBe('NO_GAPS');expect(result.state.roadmap!.id).toBe(original.state.roadmap!.id);expect(http).toHaveBeenCalledTimes(1);
});
it('GR-13 / R11: Groq respects the shared five-attempt rolling quota',async()=>{
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);
 for(let attempt=0;attempt<5;attempt++)await generateRoadmap(attempt%2?second:first,claims,request());
 await expect(generateRoadmap(second,claims,request())).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});expect(http).toHaveBeenCalledTimes(5);
});
it('GR-14 / R07/R11: provider rate limit stops after one reservation and preserves saved progress',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const original=await generateRoadmap(first,claims,request());
 await patchTask(first,claims,original.state.roadmap!.tasks[0].id,{completed:true,expectedTaskRevision:0});
 const http=vi.fn(async()=>new Response('private error',{status:429}));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(second,claims,request())).rejects.toMatchObject({code:'PROVIDER_RATE_LIMIT'});
 expect(http).toHaveBeenCalledTimes(1);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(2);
 const preserved=(await getState(first,claims)).roadmap!;expect(preserved.id).toBe(original.state.roadmap!.id);expect(preserved.tasks[0].completed).toBe(true);
});
it('GR-15 / R03/R09/R11: changed configuration during processing prevents stale activation without refund',async()=>{
 const http=vi.fn(async()=>{
  const changed={...pilot,maxOutputTokens:2048};
  await second.fundingBudget.update({where:{id:budgetId},data:{configuration:changed,pricingVersion:configurationVersion(changed)}});
  return response(proposal());
 });vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect((await getState(first,claims)).roadmap).toBeNull();expect(http).toHaveBeenCalledTimes(1);
 expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
});
