import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, endSession, getState, patchTask, putConsent, putProfile, putSkills, type Claims } from '../../src/lib/store';
import { catalogue } from '../../src/lib/catalogue';
import { generateRoadmap, extractSkills, operationStatus } from '../../src/lib/ai-operations';
import { mockProvider, ProviderFailure, type AIProvider } from '../../src/lib/ai-provider';
import { POLICY_VERSION } from '../../src/lib/domain';
import { syntheticPdf } from '../synthetic-pdf';
const url=process.env.TEST_DATABASE_URL;
if(!url)throw new Error('BLOCKED: set TEST_DATABASE_URL to an isolated migrated real PostgreSQL database.');
const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:5})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:5})});
let a:Claims,b:Claims;let budgetId:string;
const emails:string[]=[];
beforeAll(async()=>{await client.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});});
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-integration-signing-secret-only');
 budgetId=`test-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);
 await client.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:100,expiresAt:new Date(Date.now()+86400000)}});
 async function learner(){const key=crypto.randomUUID();const email=`${key}@example.invalid`;emails.push(email);await client.invitation.create({data:{email}});const u=await admitGoogle(client,key,email,'Synthetic Learner');const c={id:u.id,email,sessionVersion:0};await putProfile(client,c,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});await putSkills(client,c,{entries:catalogue.skills.slice(0,3).map(s=>({canonicalSkillId:s.id,label:s.label})),removals:[],expectedRevision:1});for(const purpose of ['cv_extraction','roadmap_generation'])await putConsent(client,c,{purpose,granted:true,policyVersion:POLICY_VERSION});return c;}
 a=await learner();b=await learner();
});
afterEach(async()=>{
 await client.user.deleteMany({where:{email:{in:emails}}});await client.invitation.deleteMany({where:{email:{in:emails}}});
 await client.fundingBudget.delete({where:{id:budgetId}});vi.unstubAllEnvs();
});
afterAll(async()=>{await client.$disconnect();await second.$disconnect();});
const body=(revision=2,key=crypto.randomUUID())=>({operationKey:key,expectedPlanningRevision:revision,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});
function controlled(){let release!:()=>void;let entered!:()=>void;const gate=new Promise<void>(r=>release=r);const ready=new Promise<void>(r=>entered=r);const provider:AIProvider={model:'controlled-mock',async respond(input,signal){entered();await gate;return mockProvider.respond(input,signal)}};return {provider,ready,release};}
describe('Week 3 connected services against real PostgreSQL; provider is mocked',()=>{
 it('W3-1: actual PDF → temporary candidates → confirmation → deterministic gaps → roadmap',async()=>{
  const original=await getState(client,a);const result=await extractSkills(client,a,syntheticPdf(['Synthetic fixture only','I designed test design cases for a local form.','I performed API testing on a sample API.','I used Playwright in a local synthetic test suite.']),crypto.randomUUID());
  expect(result.candidates).toHaveLength(3);expect((await getState(client,a)).skills).toEqual(original.skills);
  const saved=await putSkills(client,a,{entries:result.candidates.map(c=>({canonicalSkillId:c.skillId,label:c.label,candidateReference:c.candidateReference})),removals:[],expectedRevision:2});
  const generated=await generateRoadmap(client,a,body(saved.profile.planningRevision));expect(generated.code).toBe('MOCK_PLAN_SAVED');
  expect(generated.state.roadmap?.tasks).toHaveLength(5);expect(generated.state.roadmap?.tasks.every(t=>t.estimatedMinutes<=300&&!t.completed)).toBe(true);
  const persisted=await client.aIOperation.findMany({where:{userId:a.id}});expect(JSON.stringify(persisted)).not.toMatch(/evidenceExcerpt|I used Playwright|Synthetic fixture only/);
 },15000);
 it('W3-2: malformed PDF preserves existing inventory, consumes zero provider attempts, manual recovery succeeds',async()=>{
  const before=await getState(client,a);
  await expect(extractSkills(client,a,new Uint8Array(Buffer.from('malformed PDF')),crypto.randomUUID())).rejects.toMatchObject({code:'PDF_MALFORMED'});
  expect((await getState(client,a)).skills).toEqual(before.skills);expect(await client.aIAttempt.count({where:{operation:{userId:a.id}}})).toBe(0);
  const saved=await putSkills(client,a,{entries:[...before.skills.map(s=>({canonicalSkillId:s.canonicalSkillId,label:s.label})),{canonicalSkillId:null,label:'Synthetic exploratory testing'}],removals:[],expectedRevision:2});expect(saved.skills).toHaveLength(4);
 });
 it('W3-3: two invalid responses preserve the active plan and saved progress, consuming exactly two reservations',async()=>{
  const initial=await generateRoadmap(client,a,body());const task=initial.state.roadmap!.tasks[0];await patchTask(client,a,task.id,{completed:true,expectedTaskRevision:0});const before=(await getState(client,a)).roadmap;
  let calls=0;const invalid:AIProvider={model:'invalid-mock',async respond(){calls++;return {outcome:'plan',tasks:[{week:99}]}}};
  await expect(generateRoadmap(second,a,body(),invalid)).rejects.toMatchObject({code:'INVALID_OUTPUT'});expect(calls).toBe(2);
  expect((await getState(client,a)).roadmap).toEqual(before);expect(await client.roadmap.count({where:{userId:a.id}})).toBe(1);
  expect((await client.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3);
 });
 it('atomically archives progress and starts a valid replacement unchecked; replay never redispatches',async()=>{
  const first=await generateRoadmap(client,a,body());await patchTask(client,a,first.state.roadmap!.tasks[0].id,{completed:true,expectedTaskRevision:0});
  const request=body();const next=await generateRoadmap(second,a,request);const replay=await generateRoadmap(client,a,request);
  expect(replay.code).toBe('REPLAY');expect(replay.state.roadmap?.id).toBe(next.state.roadmap?.id);
  expect(next.state.roadmap?.tasks.every(t=>!t.completed)).toBe(true);
  const old=await client.roadmap.findUniqueOrThrow({where:{id:first.state.roadmap!.id},include:{tasks:true}});expect(old.status).toBe('archived');expect(old.tasks.some(t=>t.completed)).toBe(true);
  await expect(patchTask(client,a,old.tasks[0].id,{completed:false,expectedTaskRevision:1})).rejects.toMatchObject({code:'NOT_FOUND'});
  expect((await operationStatus(client,a,request.operationKey)).roadmapId).toBe(next.state.roadmap?.id);
  await expect(operationStatus(client,b,request.operationKey)).rejects.toMatchObject({code:'NOT_FOUND'});
 });
 it('binds same-key requests and extraction bytes; lost extraction returns metadata only',async()=>{
  const key=crypto.randomUUID();await extractSkills(client,a,syntheticPdf(),key);
  const replay=await extractSkills(second,a,syntheticPdf(),key);expect(replay.candidates).toEqual([]);expect(replay.code).toBe('EXTRACTION_STATUS_ONLY');
  await expect(extractSkills(client,a,syntheticPdf(['Changed synthetic bytes']),key)).rejects.toMatchObject({code:'KEY_CONFLICT'});
  const request=body();await generateRoadmap(client,a,request);await expect(generateRoadmap(client,a,{...request,introductoryPlanAcknowledged:true})).rejects.toMatchObject({code:'KEY_CONFLICT'});
 });
 it('enforces a shared one-operation lease across two clients and operation types',async()=>{
  const gate=controlled();const running=generateRoadmap(client,a,body(),gate.provider);await gate.ready;
  try{await expect(extractSkills(second,a,syntheticPdf(),crypto.randomUUID())).rejects.toMatchObject({code:'OPERATION_BUSY'});}finally{gate.release();}
  await running;expect(await client.roadmap.count({where:{userId:a.id,status:'active'}})).toBe(1);
 });
 it('serializes funding across users and retains uncertain reservations',async()=>{
  await client.fundingBudget.update({where:{id:budgetId},data:{ceiling:1}});
  const results=await Promise.allSettled([generateRoadmap(client,a,body()),generateRoadmap(second,b,body())]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect((await client.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(1);
 });
 it('blocks missing budget and consent with zero dispatch; no gaps uses zero reservations',async()=>{
  const spy=vi.fn(mockProvider.respond);const provider={model:'spy-mock',respond:spy};
  await putConsent(client,a,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});await expect(generateRoadmap(client,a,body(),provider)).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
  vi.stubEnv('AI_BUDGET_ID','absent');await expect(generateRoadmap(client,b,body(),provider)).rejects.toMatchObject({code:'FUNDING_STOP'});
  await putSkills(client,b,{entries:catalogue.skills.map(s=>({canonicalSkillId:s.id,label:s.label})),removals:[],expectedRevision:2});
  expect((await generateRoadmap(client,b,body(3),provider)).code).toBe('NO_GAPS');expect(spy).not.toHaveBeenCalled();
 });
 it('counts retries in the five-attempt rolling quota and never dispatches a sixth',async()=>{
  const invalid:AIProvider={model:'invalid-mock',async respond(){throw new ProviderFailure('PROVIDER_INCOMPLETE')}};
  for(let i=0;i<2;i++)await expect(generateRoadmap(client,a,body(),invalid)).rejects.toMatchObject({code:'PROVIDER_INCOMPLETE'});
  await expect(generateRoadmap(second,a,body(),invalid)).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});
  expect(await client.aIAttempt.count({where:{operation:{userId:a.id}}})).toBe(5);
 });
 it.each(['consent','profile','catalogue','session','deletion','deadline'])('fences late activation after %s change',async change=>{
  const gate=controlled();const request=body();const running=generateRoadmap(client,a,request,gate.provider);
  const assertion=expect(running).rejects.toBeInstanceOf(Error);await gate.ready;
  try{
   if(change==='consent')await putConsent(second,a,{purpose:'roadmap_generation',granted:false,policyVersion:POLICY_VERSION});
   if(change==='profile')await putProfile(second,a,{currentRole:'QA lead',yearsExperience:7,hoursPerWeek:5,expectedRevision:2});
   if(change==='catalogue')await second.catalogueRevision.update({where:{id:'active'},data:{revision:{increment:1}}});
   if(change==='session')await endSession(second,a);
   if(change==='deletion')await deleteAccount(second,a);
   if(change==='deadline')await second.aIOperation.updateMany({where:{userId:a.id,state:'running'},data:{deadline:new Date(Date.now()-1)}});
  }finally{gate.release();}
  await assertion;expect(await client.roadmap.count({where:{userId:a.id}})).toBe(0);
 });
});
