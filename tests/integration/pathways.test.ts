import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, putConsent, putPathwayPreferences, putProfile, putSkills, selectPathway, type Claims } from '../../src/lib/store';
import { generateRoadmap, suggestPathways } from '../../src/lib/ai-operations';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { mockProvider, type AIProvider } from '../../src/lib/ai-provider';

const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1)))throw new Error('BLOCKED: use a dedicated qa_pathways_* TEST_DATABASE_URL.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const preferences={interests:['delivery','ai-quality'] as const,preferredWork:'automation',codingPreference:'some'};
let claims:Claims;let budgetId:string;const emails:string[]=[];
beforeAll(async()=>{await first.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});});
async function learner(){
 const email=`pathways-${crypto.randomUUID()}@example.invalid`;emails.push(email);await first.invitation.create({data:{email}});
 const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Pathway Learner');
 const identity={id:user.id,email,sessionVersion:0};
 await putProfile(first,identity,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,identity,{entries:catalogue.skills.slice(0,3).map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:1});
 await putConsent(first,identity,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION});
 await putPathwayPreferences(first,identity,{preferences,expectedPlanningRevision:2});
 return identity;
}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-pathway-integration-secret-only');
 budgetId=`pathways-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);
 await first.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:30,expiresAt:new Date(Date.now()+3600000)}});
 claims=await learner();
});
afterEach(async()=>{await first.user.deleteMany({where:{email:{in:emails}}});await first.invitation.deleteMany({where:{email:{in:emails}}});await first.fundingBudget.delete({where:{id:budgetId}});vi.unstubAllEnvs();});
afterAll(async()=>{await first.$disconnect();await second.$disconnect();});
const request=(revision=3,operationKey=crypto.randomUUID())=>({expectedPlanningRevision:revision,operationKey});
async function oldPlan(){const state=await getState(first,claims);const result=await generateRoadmap(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:state.profile.planningRevision,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});const id=result.state.roadmap!.id;await first.roadmapTask.updateMany({where:{roadmapId:id},data:{completed:true}});return id;}
function controlled(){let release!:()=>void;let entered!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);const ready=new Promise<void>(resolve=>entered=resolve);const provider:AIProvider={model:'controlled-synthetic',async respond(input,signal){entered();await gate;return mockProvider.respond(input,signal);}};return {provider,ready,release};}

describe('US15 provisional pathway persistence and shared controls - real isolated PostgreSQL, mocked provider',()=>{
 it('IT-PX01: preferences and selection survive reload; reordered/no-op saves preserve planning revision',async()=>{
  const noOp=await putPathwayPreferences(first,claims,{preferences:{...preferences,interests:['ai-quality','delivery']},expectedPlanningRevision:3});expect(noOp.profile.planningRevision).toBe(3);
  const generated=await suggestPathways(first,claims,request());expect(generated.state.pathwayExploration!.suggestions).toHaveLength(2);
  const selected=await selectPathway(first,claims,{suggestionId:'direction-1',expectedPlanningRevision:3});expect(selected.profile.planningRevision).toBe(4);
  const saved=await getState(second,claims);expect(saved.pathwayExploration!.selectedSuggestionId).toBe('direction-1');
  expect((await selectPathway(first,claims,{suggestionId:'direction-1',expectedPlanningRevision:4})).profile.planningRevision).toBe(4);
 });
 it('IT-PX02: current consent is required before an attempt; duplicate key replays without redispatch',async()=>{
  await putConsent(first,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});
  await expect(suggestPathways(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
  expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);
  await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION});
  const body=request();await suggestPathways(first,claims,body);expect((await suggestPathways(second,claims,body)).code).toBe('REPLAY');
  expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(1);
  await expect(suggestPathways(first,claims,{...body,expectedPlanningRevision:99})).rejects.toMatchObject({code:'KEY_CONFLICT'});
 });
 it('IT-PX03: selected provisional direction blocks authoritative generation with zero additional attempts; old plan/progress stay intact',async()=>{
  const planId=await oldPlan();await suggestPathways(first,claims,request());await selectPathway(first,claims,{suggestionId:'direction-1',expectedPlanningRevision:3});
  const count=await first.aIAttempt.count({where:{operation:{userId:claims.id}}});
  await expect(generateRoadmap(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:4,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false})).rejects.toMatchObject({code:'CONTENT_REVIEW_REQUIRED'});
  const state=await getState(first,claims);expect(state.roadmap!.id).toBe(planId);expect(state.roadmap!.tasks.every(task=>task.completed)).toBe(true);
  expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(count);
 });
 it('IT-PX04: two invalid mock outputs preserve committed suggestions and plan, with two accounted attempts',async()=>{
  const planId=await oldPlan();await suggestPathways(first,claims,request());const before=(await getState(first,claims)).pathwayExploration;
  let calls=0;const provider:AIProvider={model:'invalid-fixture',async respond(){calls++;return {suggestions:[]};}};
  await expect(suggestPathways(first,claims,request(),provider)).rejects.toMatchObject({code:'INVALID_OUTPUT'});
  expect(calls).toBe(2);const state=await getState(first,claims);expect(state.pathwayExploration).toEqual(before);expect(state.roadmap!.id).toBe(planId);expect(state.roadmap!.tasks.every(task=>task.completed)).toBe(true);
  expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(4);
 });
 it('IT-PX05: changed profile during processing rejects late suggestions; one user lease spans two instances',async()=>{
  const pending=controlled();const work=suggestPathways(first,claims,request(),pending.provider);const settled=work.then(value=>({value,error:null}),error=>({value:null,error}));await Promise.race([pending.ready,settled.then(result=>{throw result.error??new Error('Provider gate was not entered.');})]);
  await expect(suggestPathways(second,claims,request())).rejects.toMatchObject({code:'OPERATION_BUSY'});
  await putProfile(second,claims,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:6,expectedRevision:3});pending.release();
  expect((await settled).error).toMatchObject({code:'STALE_INPUT'});expect((await getState(first,claims)).pathwayExploration!.suggestions).toEqual([]);
 });
 it('IT-PX06: withdrawal during provider processing fences activation and cancels suggestion operation',async()=>{
  const pending=controlled();const work=suggestPathways(first,claims,request(),pending.provider).catch(error=>error);await Promise.race([pending.ready,work.then(result=>{throw result;})]);
  await putConsent(second,claims,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});pending.release();
  expect(await work).toMatchObject({code:'CONSENT_REQUIRED'});expect((await getState(first,claims)).pathwayExploration!.suggestions).toEqual([]);
  expect((await first.aIOperation.findFirstOrThrow({where:{userId:claims.id,kind:'pathway_suggestions'}})).state).toBe('cancelled');
 });
 it('IT-PX07: deletion during processing prevents account/data recreation',async()=>{
  const pending=controlled();const work=suggestPathways(first,claims,request(),pending.provider).catch(error=>error);await Promise.race([pending.ready,work.then(result=>{throw result;})]);await deleteAccount(second,claims);pending.release();
  expect(await work).toMatchObject({code:'ACCESS_ENDED'});expect(await first.user.count({where:{id:claims.id}})).toBe(0);expect(await first.pathwayExploration.count({where:{userId:claims.id}})).toBe(0);
 });
 it('IT-PX08: cross-user selection cannot access another learner suggestions; a global budget is atomic across users/instances',async()=>{
  const other=await learner();await expect(selectPathway(first,other,{suggestionId:'direction-1',expectedPlanningRevision:3})).rejects.toMatchObject({code:'UNKNOWN_DIRECTION'});
  await first.fundingBudget.update({where:{id:budgetId},data:{ceiling:1}});
  const results=await Promise.allSettled([suggestPathways(first,claims,request()),suggestPathways(second,other,request())]);
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected').map(result=>(result as PromiseRejectedResult).reason.code)).toEqual(['FUNDING_STOP']);
  expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
 });
 it('IT-PX09: cleared stale selection does not refresh old suggestions; failed stale selection preserves inventory',async()=>{
  await suggestPathways(first,claims,request());await selectPathway(first,claims,{suggestionId:'direction-1',expectedPlanningRevision:3});
  await putProfile(first,claims,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:6,expectedRevision:4});
  const cleared=await selectPathway(first,claims,{suggestionId:null,expectedPlanningRevision:5});expect(cleared.pathwayExploration!.inputRevision).toBe(4);
  await expect(selectPathway(first,claims,{suggestionId:'direction-2',expectedPlanningRevision:6})).rejects.toMatchObject({code:'STALE_INPUT'});
  expect((await getState(first,claims)).skills).toHaveLength(3);
 });
 it('IT-PX10: a no-gap legacy inventory does not bypass pathway exploration',async()=>{
  await putSkills(first,claims,{entries:catalogue.skills.map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:3});
  const result=await suggestPathways(first,claims,request(4));expect(result.code).toBe('PATHWAYS_READY');expect(result.operation.attempts).toBe(1);
 });
 it('IT-PX11: empty inventory produces no transferable-experience claims',async()=>{
  const before=await getState(first,claims);
  await putSkills(first,claims,{entries:[],removals:before.skills.map(skill=>skill.key),expectedRevision:3});
  const result=await suggestPathways(first,claims,request(4));expect(result.state.pathwayExploration!.suggestions.every(suggestion=>suggestion.transferableSkillIds.length===0)).toBe(true);
 });
 it('IT-PX12: an expired worker cannot commit and its dispatched reservation is not refunded',async()=>{
  const pending=controlled();const body=request();const work=suggestPathways(first,claims,body,pending.provider).catch(error=>error);await Promise.race([pending.ready,work.then(result=>{throw result;})]);
  await second.aIOperation.updateMany({where:{userId:claims.id,key:body.operationKey},data:{deadline:new Date(Date.now()-1000)}});pending.release();
  expect(await work).toMatchObject({code:'DEADLINE'});expect((await getState(first,claims)).pathwayExploration!.suggestions).toEqual([]);
  expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
 });
});
