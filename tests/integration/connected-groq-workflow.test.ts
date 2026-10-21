import { afterAll,afterEach,beforeEach,expect,it,vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle,getState,patchTask,putConsent,putPathwayPreferences,putProfile,putSkills,type Claims } from '../../src/lib/store';
import { generateRoadmap,researchReviewedResources,suggestPathways } from '../../src/lib/ai-operations';
import { activateRequirementSnapshot,registerRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { getReviewedGaps,saveReviewedDirection } from '../../src/lib/reviewed-direction';
import { configurationVersion } from '../../src/lib/ai-execution';
import { catalogue } from '../../src/lib/catalogue';
import { inspectResourcePages } from '../../src/lib/resource-page-verifier';
import { mockReviewedPlan,type ReviewedPlanContext } from '../../src/lib/reviewed-roadmap';
import { syntheticWorkflowConfiguration } from '../fixtures/groq-configuration';
import { syntheticReviewedLibrary } from '../fixtures/reviewed-planning';

// Real isolated PostgreSQL; HTTP, DNS and page bodies are intercepted synthetic
// fixtures. No provider request, Google OAuth or real page validity is tested.
const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw new Error('Use an isolated local qa_pathways_* TEST_DATABASE_URL.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims,budgetId:string,oldPlanId:string;
let library=syntheticReviewedLibrary(2),pilot=syntheticWorkflowConfiguration();
const response=(output:unknown)=>new Response(JSON.stringify({id:'synthetic-intercepted-request',choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
const inspector:typeof inspectResourcePages=(context,candidates,signal)=>inspectResourcePages(context,candidates,signal,{
 resolve:async()=>[{address:'93.184.215.14',family:4}],
 read:async()=>({status:200,headers:{'content-type':'text/html'},body:`<main>${context.topicTitle} explains synthetic QA topic checks, setup, expected outcomes and documentation.</main>`}),
});
function interceptedProvider(change?:'missing-sources'|'bad-excerpt'|'unusable-extra'){
 const http=vi.fn(async(_url:unknown,init?:RequestInit)=>{
  const budget=await second.fundingBudget.findUniqueOrThrow({where:{id:budgetId}});expect(budget.reserved).toBeGreaterThanOrEqual(http.mock.calls.length);
  const body=JSON.parse(String(init?.body));const prompt=JSON.parse(body.messages[1].content);
  expect(prompt).not.toHaveProperty('email');expect(prompt).not.toHaveProperty('cvText');
  if(body.tools){
   expect(body.tools).toEqual([{type:'browser_search'}]);expect(body.response_format).toBeUndefined();
   expect(prompt.learningScope.includes).toEqual(library.capabilities.find(item=>item.id===prompt.topicId)!.scope!.includes);
   const pages=[{url:`https://docs.example.org/topics/${prompt.topicId}`,title:`${prompt.topicTitle} documentation`,kind:'documentation'},
    {url:`https://lessons.example.org/topics/${prompt.topicId}`,title:`${prompt.topicTitle} lesson`,kind:'tutorial'}];
   if(change==='unusable-extra')pages.push({url:`https://broken.example.org/topics/${prompt.topicId}`,title:'Unavailable extra',kind:'video'});
   return new Response(JSON.stringify({id:'synthetic-intercepted-request',choices:[{finish_reason:'stop',message:{content:JSON.stringify({results:pages.map(({url,kind})=>({url,kind}))}),
    ...(change==='missing-sources'?{}:{executed_tools:[{type:'browser_search',arguments:'{}',index:0,browser_results:pages.map(({url,title})=>({url,title,content:'Native synthetic source text.'}))}]})}}]}));
  }
  if(body.response_format.json_schema.name==='resource_research'){
   if(change==='unusable-extra')expect(prompt.candidates).toHaveLength(2);
   const docs=prompt.candidates.find((item:{kind:string})=>item.kind==='documentation'),support=prompt.candidates.find((item:{kind:string})=>item.kind!=='documentation');
   return response({documentationId:docs.id,supportingId:support.id,evidence:[docs,support].map(candidate=>({candidateId:candidate.id,topicExcerpt:change==='bad-excerpt'?'Invented unrelated topic evidence.':prompt.inspectedPages.find((page:{candidateId:string})=>page.candidateId===candidate.id).text,access:'public-page',accessExcerpt:''}))});
  }
  if(body.response_format.json_schema.name==='pathway_suggestions')return response({suggestions:[{title:'Synthetic QA progression',why:'Matches the supplied QA interests.',capabilityIds:prompt.library.directions[0].capabilityIds,transferableSkillIds:[],practicalWork:'Plan a synthetic QA investigation.',uncertainty:'Provisional suggestions do not demonstrate competence.'}]});
  const {activities,...context}=prompt;
  return response(mockReviewedPlan({...context,activities:activities.map(({id,dependencies,...task}:{id:string;dependencies:string[]})=>({id,dependencies,task}))} as ReviewedPlanContext));
 });vi.stubGlobal('fetch',http);return http;
}
const research=(topicId=library.capabilities[0].id,key=crypto.randomUUID())=>({operationKey:key,expectedPlanningRevision:3,topicId});
const planRequest=(key=crypto.randomUUID())=>({operationKey:key,expectedPlanningRevision:3,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:true});
async function renewConsent(){const state=await getState(first,claims);await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:state.processing!.policyVersion});}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','groq');vi.stubEnv('GROQ_FREE_PLAN_CONFIRMED','true');vi.stubEnv('GROQ_API_KEY','synthetic-not-a-credential');vi.stubEnv('AI_SIGNING_SECRET','synthetic-connected-workflow-signing-secret');
 budgetId=`connected-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);pilot=syntheticWorkflowConfiguration();
 await first.fundingBudget.create({data:{id:budgetId,mode:'groq',currency:'REQUESTS',pricingVersion:configurationVersion(pilot),ceiling:pilot.ceilingRequests,expiresAt:new Date(pilot.expiresAt),configuration:pilot}});
 await first.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
 library=syntheticReviewedLibrary(2);await registerRequirementSnapshot(first,library,'synthetic connected workflow review fixture');await activateRequirementSnapshot(first,library.version);
 const email=`connected-${crypto.randomUUID()}@example.invalid`;await first.invitation.create({data:{email}});const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Workflow Learner');claims={id:user.id,email,sessionVersion:0};
 await putProfile(first,claims,{currentRole:'Synthetic QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});await putSkills(first,claims,{entries:[],removals:[],expectedRevision:1});await renewConsent();
 await saveReviewedDirection(first,claims,{version:library.version,directionId:'qa',deferredCapabilityIds:[],expectedPlanningRevision:2});
 const old=await first.roadmap.create({data:{userId:claims.id,inputRevision:2,catalogueVersion:catalogue.version,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,kind:'practical',title:'Prior synthetic activity',activity:'Prior work',completionCriterion:'Prior result',skillIds:[],resourceIds:[],estimatedMinutes:15,completed:true}))}}});oldPlanId=old.id;
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Unexpected outbound request');}));
});
afterEach(async()=>{await first.user.deleteMany({where:{id:claims.id}});await first.invitation.deleteMany({where:{email:claims.email}});await first.fundingBudget.deleteMany({where:{id:budgetId}});vi.unstubAllGlobals();vi.unstubAllEnvs();});
afterAll(async()=>{await first.requirementActivation.deleteMany({where:{id:'active'}});await first.$disconnect();await second.$disconnect();});

it('CW-01 / T07/T09/T11/T15: two native-source pairs and a reviewed plan use five shared reservations; frozen resources and progress survive reload',async()=>{
 const http=interceptedProvider();
 for(const topic of library.capabilities)expect((await researchReviewedResources(first,claims,research(topic.id),undefined,inspector)).code).toBe('RESOURCES_READY');
 const body=planRequest();const result=await generateRoadmap(first,claims,body);expect(result.code).toBe('PLAN_SAVED');
 expect(http).toHaveBeenCalledTimes(5);expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(5);
 expect((await second.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(5);
 expect(result.state.roadmap!.reviewed).toMatchObject({mode:'groq',libraryVersion:library.version});
 expect(result.state.roadmap!.reviewed!.resources.every(pair=>pair.resources.length===2&&pair.resources.every(item=>item.reviewStatus==='automatically_checked'))).toBe(true);
 const old=await second.roadmap.findUniqueOrThrow({where:{id:oldPlanId},include:{tasks:true}});expect(old.status).toBe('archived');expect(old.tasks.every(task=>task.completed)).toBe(true);expect(result.state.roadmap!.tasks.every(task=>!task.completed)).toBe(true);
 const task=result.state.roadmap!.tasks[0];await patchTask(first,claims,task.id,{completed:true,expectedTaskRevision:0});expect((await getState(second,claims)).roadmap!.tasks[0].completed).toBe(true);
 expect((await generateRoadmap(second,claims,body)).code).toBe('REPLAY');expect(http).toHaveBeenCalledTimes(5);
 await expect(researchReviewedResources(second,claims,research(),undefined,inspector)).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});expect(http).toHaveBeenCalledTimes(5);
});
it('CW-02 / T03/T11: absent workflow approval rejects before any operation or request',async()=>{
 const {workflow:_,...old}=pilot;void _;await first.fundingBudget.update({where:{id:budgetId},data:{configuration:old,pricingVersion:configurationVersion(old)}});await renewConsent();
 await expect(researchReviewedResources(first,claims,research(),undefined,inspector)).rejects.toMatchObject({code:'RESOURCE_LIVE_DISABLED'});
 expect(await first.aIOperation.count({where:{userId:claims.id}})).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
it.each(['missing-sources','bad-excerpt'] as const)('CW-03-%s / T09/T15: ungrounded research preserves the previously saved pair and active progress',async defect=>{
 interceptedProvider();await researchReviewedResources(first,claims,research(),undefined,inspector);const before=await getState(first,claims);
 const http=interceptedProvider(defect);await expect(researchReviewedResources(first,claims,research(),undefined,inspector)).rejects.toMatchObject({code:defect==='missing-sources'?'INVALID_OUTPUT':'RESOURCE_VERIFICATION_REQUIRED'});
 const after=await getState(second,claims);expect(after.reviewedDirection!.resourcePreviews).toEqual(before.reviewedDirection!.resourcePreviews);expect(after.roadmap).toEqual(before.roadmap);expect(http).toHaveBeenCalledTimes(defect==='missing-sources'?1:2);
});
it('CW-04 / T03: withdrawal after native search prevents structured selection and late saving',async()=>{
 const http=interceptedProvider();
 const withdraw:typeof inspectResourcePages=async(context,candidates,signal)=>{await putConsent(second,claims,{purpose:'roadmap_generation',granted:false,policyVersion:(await getState(second,claims)).processing!.policyVersion});return inspector(context,candidates,signal);};
 await expect(researchReviewedResources(first,claims,research(),undefined,withdraw)).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect(http).toHaveBeenCalledTimes(1);expect((await getState(second,claims)).roadmap!.id).toBe(oldPlanId);expect((await getState(second,claims)).reviewedDirection!.resourcePreviews).toEqual([]);
});
it('CW-05 / T09: profile change after search fences the second dispatch',async()=>{
 const http=interceptedProvider();const change:typeof inspectResourcePages=async(context,candidates,signal)=>{await putProfile(second,claims,{currentRole:'Synthetic QA',yearsExperience:7,hoursPerWeek:6,expectedRevision:3});return inspector(context,candidates,signal);};
 await expect(researchReviewedResources(first,claims,research(),undefined,change)).rejects.toMatchObject({code:'STALE_INPUT'});expect(http).toHaveBeenCalledTimes(1);expect((await getState(second,claims)).roadmap!.id).toBe(oldPlanId);
});
it('CW-06 / T15: live-adapter direction suggestions use active reviewed IDs and lead to an authoritative selected comparison',async()=>{
 await saveReviewedDirection(first,claims,{version:library.version,directionId:null,deferredCapabilityIds:[],expectedPlanningRevision:3});
 await putPathwayPreferences(first,claims,{preferences:{interests:['ai-quality'],preferredWork:'analysis',codingPreference:'some'},expectedPlanningRevision:4});
 const http=interceptedProvider();const result=await suggestPathways(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:5});
 const suggestion=result.state.pathwayExploration!.suggestions[0];expect(suggestion).toMatchObject({libraryVersion:library.version,reviewedDirectionId:'qa',generationMode:'groq'});
 expect(suggestion.capabilityIds).toEqual(library.capabilities.map(item=>item.id));expect(result.state.pathwayExploration!.current).toBe(true);
 await saveReviewedDirection(first,claims,{version:suggestion.libraryVersion,directionId:suggestion.reviewedDirectionId,deferredCapabilityIds:[],expectedPlanningRevision:5});
 expect((await getReviewedGaps(second,claims))!.mandatoryGapIds).toHaveLength(2);expect(http).toHaveBeenCalledTimes(1);
});
it('CW-07 / T11/T15: a failed extra page is excluded before selection without a third dispatch',async()=>{
 const http=interceptedProvider('unusable-extra');
 const inspect:typeof inspectResourcePages=(context,candidates,signal)=>inspectResourcePages(context,candidates,signal,{
  resolve:async()=>[{address:'93.184.215.14',family:4}],
  read:async url=>({status:url.hostname==='broken.example.org'?403:200,headers:{'content-type':'text/html'},body:`<main>${context.topicTitle} explains synthetic checks and expected results.</main>`}),
 });
 const result=await researchReviewedResources(first,claims,research(),undefined,inspect);
 expect(result.code).toBe('RESOURCES_READY');expect(http).toHaveBeenCalledTimes(2);
 expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(2);
 expect(result.state.reviewedDirection!.resourcePreviews[0].resources).toHaveLength(2);
 expect(result.state.roadmap!.id).toBe(oldPlanId);
});
