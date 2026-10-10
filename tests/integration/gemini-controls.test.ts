import { afterAll,afterEach,beforeEach,expect,it,vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { admitGoogle,getState,putProfile,putSkills,putConsent,patchTask,type Claims } from '../../src/lib/store';
import { extractSkills,generateRoadmap } from '../../src/lib/ai-operations';
import { configurationVersion,reservationMicroUsd } from '../../src/lib/gemini-pilot';
import { syntheticGeminiPilot } from '../fixtures/gemini-pilot';
import { syntheticPdf } from '../synthetic-pdf';
const url=process.env.TEST_DATABASE_URL;
if(!url)throw new Error('BLOCKED: separate migrated TEST_DATABASE_URL required.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims;let budgetId:string;let policyVersion:string;
const emails:string[]=[];
let pilot=syntheticGeminiPilot();
const request=()=>({operationKey:crypto.randomUUID(),expectedPlanningRevision:2,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});
const proposal=()=>({outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks:catalogue.skills.slice(3).map((skill,index)=>({week:index+1,kind:index===4?'practical':'learning',title:skill.label,activity:skill.activity,completionCriterion:skill.outcome,skillIds:[skill.id],resourceIds:[...skill.resourceIds],estimatedMinutes:skill.minutes}))});
const response=(output:unknown)=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(output)}]}}]}));
async function learner(){
 const email=`gemini-${crypto.randomUUID()}@example.invalid`;emails.push(email);
 await first.invitation.create({data:{email}});const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic API Learner');
 const c={id:user.id,email,sessionVersion:0};
 await putProfile(first,c,{currentRole:'QA engineer',yearsExperience:6,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,c,{entries:catalogue.skills.slice(0,3).map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:1});
 for(const purpose of ['cv_extraction','roadmap_generation'])await putConsent(first,c,{purpose,granted:true,policyVersion});
 return c;
}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','gemini');vi.stubEnv('AI_SIGNING_SECRET','synthetic-gemini-control-signing-secret');vi.stubEnv('GEMINI_API_KEY','synthetic-key-not-a-real-credential');
 // Synthetic review state is test-local, not professional approval.
 Object.defineProperty(catalogue,'reviewed',{value:true,configurable:true});
 budgetId=`gemini-${crypto.randomUUID()}`;vi.stubEnv('AI_BUDGET_ID',budgetId);pilot=syntheticGeminiPilot();
 const version=configurationVersion(pilot);policyVersion=`gemini-disclosure-v1-${version}`;
 await first.fundingBudget.create({data:{id:budgetId,mode:'gemini',currency:'USD_MICRO',pricingVersion:version,ceiling:pilot.ceilingMicroUsd,expiresAt:new Date(pilot.expiresAt),configuration:pilot}});
 await first.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
 claims=await learner();
 // Any unexpected outbound request fails locally; each executable case replaces this interceptor.
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Unexpected synthetic dispatch');}));
});
afterEach(async()=>{
 await first.user.deleteMany({where:{email:{in:emails}}});await first.invitation.deleteMany({where:{email:{in:emails}}});emails.length=0;
 await first.fundingBudget.deleteMany({where:{id:budgetId}});
 Object.defineProperty(catalogue,'reviewed',{value:false,configurable:true});vi.unstubAllEnvs();vi.unstubAllGlobals();
});
afterAll(async()=>{await first.$disconnect();await second.$disconnect();});
it('G-04 / R03/R11: mock consent, unreviewed content and missing key block dispatch with zero attempts',async()=>{
 await expect(putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION})).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 Object.defineProperty(catalogue,'reviewed',{value:false,configurable:true});
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CATALOGUE_UNREVIEWED'});
 Object.defineProperty(catalogue,'reviewed',{value:true,configurable:true});vi.stubEnv('GEMINI_API_KEY','');
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'AI_CONFIGURATION'});
 expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);expect(fetch).not.toHaveBeenCalled();
 vi.stubEnv('NODE_ENV','production');
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect(fetch).not.toHaveBeenCalled();
});
it('G-05 / R04/R07/R11: real service path selects Gemini only after shared currency reservation; CV and roadmap share it',async()=>{
 const http=vi.fn(async(url:unknown,init?:RequestInit)=>{
  expect(String(url)).toContain(pilot.model+':generateContent');
  const budget=await second.fundingBudget.findUniqueOrThrow({where:{id:budgetId}});expect(budget.reserved).toBeGreaterThanOrEqual(reservationMicroUsd(pilot));
  const body=JSON.parse(String(init?.body));expect(body.generationConfig.maxOutputTokens).toBe(pilot.maxOutputTokens);expect(body.tools).toBeUndefined();
  return response(body.systemInstruction.parts[0].text.startsWith('Extract')?{skills:[{skillId:'api-testing',label:'API testing',evidenceExcerpt:'I performed API testing on a local service.'}]}:proposal());
 });vi.stubGlobal('fetch',http);
 const extraction=await extractSkills(first,claims,syntheticPdf(['I performed API testing on a local service.']),crypto.randomUUID());expect(extraction.candidates).toHaveLength(1);
 const saved=await generateRoadmap(first,claims,request());expect(saved.code).toBe('PLAN_SAVED');
 expect(http).toHaveBeenCalledTimes(2);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(2*reservationMicroUsd(pilot));
 expect((await first.roadmap.findUniqueOrThrow({where:{id:saved.state.roadmap!.id}})).modelVersion).toBe(pilot.model);
},15000);
it('G-06 / R07/R11: invalid outputs consume both reservations and preserve old plan/progress; a new-key recovery succeeds',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const original=await generateRoadmap(first,claims,request());
 await patchTask(first,claims,original.state.roadmap!.tasks[0].id,{completed:true,expectedTaskRevision:0});
 const http=vi.fn(async()=>response({skills:[]}));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'INVALID_OUTPUT'});expect(http).toHaveBeenCalledTimes(2);
 const preserved=(await getState(first,claims)).roadmap!;expect(preserved.id).toBe(original.state.roadmap!.id);expect(preserved.tasks[0].completed).toBe(true);
 expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(3*reservationMicroUsd(pilot));
 vi.stubGlobal('fetch',vi.fn(async()=>response(proposal())));const recovered=await generateRoadmap(first,claims,request());expect(recovered.state.roadmap!.id).not.toBe(preserved.id);expect(recovered.state.roadmap!.tasks.every(task=>!task.completed)).toBe(true);
});
it('G-07 / R11: revocation from another instance during dispatched work prevents late activation without refund',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{await second.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});return response(proposal());}));
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'FUNDING_STOP'});
 expect((await getState(first,claims)).roadmap).toBeNull();expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(reservationMicroUsd(pilot));expect(fetch).toHaveBeenCalledTimes(1);
});
it('G-08 / R11: two instances/users race for one funded reservation; only one dispatches',async()=>{
 const other=await learner();await first.fundingBudget.update({where:{id:budgetId},data:{reserved:pilot.ceilingMicroUsd-reservationMicroUsd(pilot)}});
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);
 const results=await Promise.allSettled([generateRoadmap(first,claims,request()),generateRoadmap(second,other,request())]);
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(http).toHaveBeenCalledTimes(1);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(pilot.ceilingMicroUsd);
});
it('G-09 / R03/R11: changed notice invalidates existing consent before any dispatch',async()=>{
 const changed={...pilot,privacyNotice:pilot.privacyNotice+' Changed provider terms.'};const version=configurationVersion(changed);
 await second.fundingBudget.update({where:{id:budgetId},data:{configuration:changed,pricingVersion:version}});
 expect((await getState(first,claims)).consents.roadmap_generation).toBe(false);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'CONSENT_REQUIRED'});expect(fetch).not.toHaveBeenCalled();
});
it('G-10 / R04/R11: request above configured byte ceiling is rejected before reservation or dispatch',async()=>{
 const changed={...pilot,maxRequestBytes:1};const version=configurationVersion(changed);
 await first.fundingBudget.update({where:{id:budgetId},data:{configuration:changed,pricingVersion:version}});
 await putConsent(first,claims,{purpose:'roadmap_generation',granted:true,policyVersion:`gemini-disclosure-v1-${version}`});
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'PROVIDER_INPUT_LIMIT'});
 expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);expect(fetch).not.toHaveBeenCalled();
});
it('G-11 / R11: invalid credentials produce one dispatch/reservation and no hidden retry or refund',async()=>{
 const http=vi.fn(async()=>new Response('do not read private echoed error',{status:401}));vi.stubGlobal('fetch',http);
 await expect(generateRoadmap(first,claims,request())).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
 expect(http).toHaveBeenCalledTimes(1);expect((await first.fundingBudget.findUniqueOrThrow({where:{id:budgetId}})).reserved).toBe(reservationMicroUsd(pilot));
});
it('G-12 / R06/R11: no gaps bypasses revoked funding with zero extra calls and preserves the plan',async()=>{
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);const original=await generateRoadmap(first,claims,request());
 await putSkills(first,claims,{entries:catalogue.skills.map(skill=>({canonicalSkillId:skill.id,label:skill.label})),removals:[],expectedRevision:2});
 await first.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});
 const result=await generateRoadmap(first,claims,{...request(),expectedPlanningRevision:3});expect(result.code).toBe('NO_GAPS');expect(result.state.roadmap!.id).toBe(original.state.roadmap!.id);expect(http).toHaveBeenCalledTimes(1);
});
it('G-13 / R11: Gemini respects the shared five-attempt rolling quota',async()=>{
 const http=vi.fn(async()=>response(proposal()));vi.stubGlobal('fetch',http);
 for(let attempt=0;attempt<5;attempt++)await generateRoadmap(attempt%2?second:first,claims,request());
 await expect(generateRoadmap(second,claims,request())).rejects.toMatchObject({code:'QUOTA_EXHAUSTED'});expect(http).toHaveBeenCalledTimes(5);
});
