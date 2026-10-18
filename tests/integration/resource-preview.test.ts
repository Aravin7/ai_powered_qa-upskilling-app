import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, putConsent, putPathwayPreferences, putProfile, putSkills, selectPathway, type Claims } from '../../src/lib/store';
import { generateRoadmap, researchResourcePreview, suggestPathways } from '../../src/lib/ai-operations';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { mockProvider, ProviderFailure, type AIProvider, type ProviderInput } from '../../src/lib/ai-provider';

const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1)))throw new Error('BLOCKED: use only an isolated qa_pathways_* TEST_DATABASE_URL.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims;let email:string;let budgetId:string;let planId:string;
const body=(operationKey=crypto.randomUUID())=>({operationKey,suggestionId:'direction-1',topicId:'automation',expectedPlanningRevision:4});
beforeAll(async()=>{await first.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});});
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-resource-integration-secret-only');
 budgetId=`resource-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);
 await first.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:40,expiresAt:new Date(Date.now()+3600000)}});
 email=`resource-${crypto.randomUUID()}@example.invalid`;await first.invitation.create({data:{email}});
 const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Resource Learner');claims={id:user.id,email,sessionVersion:0};
 await putProfile(first,claims,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,claims,{entries:catalogue.skills.slice(0,3).map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:1});
 await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION});
 const plan=await generateRoadmap(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:2,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});
 planId=plan.state.roadmap!.id;await first.roadmapTask.updateMany({where:{roadmapId:planId},data:{completed:true}});
 await putPathwayPreferences(first,claims,{preferences:{interests:['delivery'],preferredWork:'automation',codingPreference:'some'},expectedPlanningRevision:2});
 await suggestPathways(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:3});
 await selectPathway(first,claims,{suggestionId:'direction-1',expectedPlanningRevision:3});
});
afterEach(async()=>{await first.user.deleteMany({where:{email}});await first.invitation.deleteMany({where:{email}});await first.fundingBudget.delete({where:{id:budgetId}});vi.unstubAllEnvs();});
afterAll(async()=>{await first.$disconnect();await second.$disconnect();});
async function assertPlan(){const plan=await first.roadmap.findUniqueOrThrow({where:{id:planId},include:{tasks:true}});expect(plan.status).toBe('active');expect(plan.tasks.every(task=>task.completed)).toBe(true);}
function gate(phase:'search'|'select'){
 let release!:()=>void;let enter!:()=>void;const ready=new Promise<void>(resolve=>enter=resolve);const paused=new Promise<void>(resolve=>release=resolve);
 const provider:AIProvider={model:'synthetic-research-gate',async respond(input,signal){if(input.kind==='resource_research'&&input.phase===phase){enter();await paused;}return mockProvider.respond(input,signal);}};
 return {provider,ready,release};
}
async function waitForGate(pending:ReturnType<typeof gate>,work:Promise<unknown>){await Promise.race([pending.ready,work.then(value=>{throw value;})]);}

describe('US15/T15 connected resource previews - real PostgreSQL and mocked server provider',()=>{
 it('IT-RP01: two accounted phases save a reloadable pair; replay and changed-key input do not redispatch',async()=>{
  const inputs:ProviderInput[]=[];const provider:AIProvider={model:'synthetic-recorded',async respond(input,signal){inputs.push(input);return mockProvider.respond(input,signal);}};
  const request=body();const result=await researchResourcePreview(first,claims,request,provider);
  expect(result.code).toBe('MOCK_RESOURCES_READY');expect(result.operation.attempts).toBe(2);expect(inputs).toHaveLength(2);
  expect(inputs.map(input=>input.kind==='resource_research'&&input.phase)).toEqual(['search','select']);
  expect(Object.keys(inputs[0]).sort()).toEqual(['context','kind','phase']);
  expect(JSON.stringify(inputs)).not.toMatch(/currentRole|yearsExperience|cvText|@example|userId|confirmedSkillIds/);
  const state=await getState(second,claims);expect(state.pathwayExploration!.resourcePreviews![0].resources).toHaveLength(2);
  expect(state.pathwayExploration!.resourcePreviews![0].resources.every(resource=>resource.reviewStatus==='synthetic_only')).toBe(true);
  expect((await researchResourcePreview(second,claims,request,provider)).code).toBe('REPLAY');expect(inputs).toHaveLength(2);
  await expect(researchResourcePreview(first,claims,{...request,topicId:'ci'},provider)).rejects.toMatchObject({code:'KEY_CONFLICT'});await assertPlan();
 });
 it('IT-RP02: missing consent, foreign topic and unselected direction consume zero research attempts',async()=>{
  await putConsent(first,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});
  await expect(researchResourcePreview(first,claims,body())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
  await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION});
  await expect(researchResourcePreview(first,claims,{...body(),topicId:'ai-security'})).rejects.toMatchObject({code:'UNKNOWN_TOPIC'});
  await expect(researchResourcePreview(first,claims,{...body(),suggestionId:'direction-for-another-user'})).rejects.toMatchObject({code:'DIRECTION_REQUIRED'});
  expect(await first.aIAttempt.count({where:{operation:{userId:claims.id,kind:'resource_research'}}})).toBe(0);
 });
 it('IT-RP03: invalid second output preserves saved pair and completed plan; no third correction call',async()=>{
  await researchResourcePreview(first,claims,body());const before=(await getState(first,claims)).pathwayExploration!.resourcePreviews;
  // Previous fixture operations belong to an earlier rolling hour; this case
  // tests replacement failure and must also work with the required five-attempt gate.
  await first.aIAttempt.updateMany({where:{operation:{userId:claims.id}},data:{reservedAt:new Date(Date.now()-3600001)}});
  let calls=0;const provider:AIProvider={model:'synthetic-invalid-selection',async respond(input,signal){calls++;return input.kind==='resource_research'&&input.phase==='select'?{documentationId:'invented',supportingId:'invented'}:mockProvider.respond(input,signal);}};
  const request=body();await expect(researchResourcePreview(first,claims,request,provider)).rejects.toMatchObject({code:'RESOURCE_VERIFICATION_REQUIRED'});
  expect(calls).toBe(2);const op=await first.aIOperation.findFirstOrThrow({where:{userId:claims.id,key:request.operationKey}});expect(op.attempts).toBe(2);expect(op.state).toBe('failed');
  expect((await getState(second,claims)).pathwayExploration!.resourcePreviews).toEqual(before);await assertPlan();
 });
 it('IT-RP04: first-stage transport loss has no hidden redispatch or refund',async()=>{
  let calls=0;const request=body();const provider:AIProvider={model:'synthetic-lost-response',async respond(){calls++;throw new ProviderFailure('PROVIDER_UNAVAILABLE');}};
  await expect(researchResourcePreview(first,claims,request,provider)).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});expect(calls).toBe(1);
  const op=await first.aIOperation.findFirstOrThrow({where:{userId:claims.id,key:request.operationKey},include:{dispatches:true}});expect(op.dispatches).toHaveLength(1);
  expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3);await assertPlan();
 });
 it('IT-RP05: second phase needs its own atomic funding reservation',async()=>{
  await first.fundingBudget.update({where:{id:budgetId},data:{ceiling:3}});let calls=0;
  const provider:AIProvider={model:'synthetic-funding',async respond(input,signal){calls++;return mockProvider.respond(input,signal);}};
  await expect(researchResourcePreview(first,claims,body(),provider)).rejects.toMatchObject({code:'FUNDING_STOP'});expect(calls).toBe(1);
  expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3);expect((await getState(first,claims)).pathwayExploration!.resourcePreviews).toEqual([]);await assertPlan();
 });
 it('IT-RP06: shared lease prevents concurrent operations; changed profile blocks phase two',async()=>{
  const pending=gate('search');const work=researchResourcePreview(first,claims,body(),pending.provider).catch(error=>error);await waitForGate(pending,work);
  await expect(researchResourcePreview(second,claims,body())).rejects.toMatchObject({code:'OPERATION_BUSY'});
  await putProfile(second,claims,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:6,expectedRevision:4});pending.release();
  expect(await work).toMatchObject({code:'STALE_INPUT'});expect((await getState(first,claims)).pathwayExploration!.resourcePreviews).toEqual([]);await assertPlan();
 });
 it('IT-RP07: withdrawal during selection cancels activation and keeps dispatched attempts',async()=>{
  const pending=gate('select');const request=body();const work=researchResourcePreview(first,claims,request,pending.provider).catch(error=>error);await waitForGate(pending,work);
  await putConsent(second,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});pending.release();expect(await work).toMatchObject({code:'CONSENT_REQUIRED'});
  const op=await first.aIOperation.findFirstOrThrow({where:{userId:claims.id,key:request.operationKey}});expect(op.state).toBe('cancelled');expect(op.attempts).toBe(2);
  expect((await getState(first,claims)).pathwayExploration!.resourcePreviews).toEqual([]);await assertPlan();
 });
 it('IT-RP08: deletion during selection cannot recreate private data',async()=>{
  const pending=gate('select');const work=researchResourcePreview(first,claims,body(),pending.provider).catch(error=>error);await waitForGate(pending,work);
  await deleteAccount(second,claims);pending.release();expect(await work).toMatchObject({code:'ACCESS_ENDED'});
  expect(await first.user.count({where:{id:claims.id}})).toBe(0);expect(await first.pathwayExploration.count({where:{userId:claims.id}})).toBe(0);
 });
 it('IT-RP09: deadline expiry during selection prevents late commit without refunding either dispatch',async()=>{
  const pending=gate('select');const request=body();const work=researchResourcePreview(first,claims,request,pending.provider).catch(error=>error);await waitForGate(pending,work);
  await second.aIOperation.updateMany({where:{userId:claims.id,key:request.operationKey},data:{deadline:new Date(Date.now()-1000)}});pending.release();expect(await work).toMatchObject({code:'DEADLINE'});
  expect((await getState(first,claims)).pathwayExploration!.resourcePreviews).toEqual([]);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(4);await assertPlan();
 });
});
