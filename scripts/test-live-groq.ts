import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../src/lib/catalogue';
import { configurationVersion,groqConfigurationSchema,GROQ_MODEL,GROQ_NOTICE } from '../src/lib/ai-execution';
import { DomainError } from '../src/lib/domain';
import { admitGoogle,getState,patchTask,putConsent,putProfile,putSkills } from '../src/lib/store';
import { extractSkills,generateRoadmap } from '../src/lib/ai-operations';
import { ProviderFailure } from '../src/lib/ai-provider';
import { syntheticPdf } from '../tests/synthetic-pdf';

if(process.env.RUN_LIVE_GROQ_TESTS!=='true')throw new Error('NOT RUN: explicitly set RUN_LIVE_GROQ_TESTS=true for this optional external test.');
if(process.env.NODE_ENV==='production'||process.env.GROQ_FREE_PLAN_CONFIRMED!=='true'||!process.env.GROQ_API_KEY)
 throw new Error('BLOCKED: requires local execution, a server key and confirmed Groq Free Plan.');
const url=process.env.TEST_DATABASE_URL;
if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||new URL(url).pathname!=='/qa_groq_demo')
 throw new Error('BLOCKED: this smoke test accepts only the dedicated local qa_groq_demo database.');
process.env.AI_MODE='groq';process.env.AI_BUDGET_ID='groq-live-smoke-v1';
const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const email=`live-synthetic-${crypto.randomUUID()}@example.invalid`;let userId:string|undefined;
try{
 const config=groqConfigurationSchema.parse({model:GROQ_MODEL,catalogueVersion:catalogue.version,maxOutputTokens:4096,maxRequestBytes:64000,
  ceilingRequests:20,expiresAt:new Date(Date.now()+7*86400000).toISOString(),freePlanConfirmed:true,dataScope:'synthetic-only',privacyNotice:GROQ_NOTICE});
 await client.fundingBudget.upsert({where:{id:process.env.AI_BUDGET_ID},update:{},create:{id:process.env.AI_BUDGET_ID,mode:'groq',currency:'REQUESTS',pricingVersion:configurationVersion(config),ceiling:20,expiresAt:new Date(config.expiresAt),configuration:config}});
 await client.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});
 await client.invitation.create({data:{email}});const user=await admitGoogle(client,crypto.randomUUID(),email,'Synthetic Reviewer');userId=user.id;
 const claims={id:user.id,email,sessionVersion:0};
 await putProfile(client,claims,{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 const disclosure=(await getState(client,claims)).processing!;
 for(const purpose of ['cv_extraction','roadmap_generation'])await putConsent(client,claims,{purpose,granted:true,policyVersion:disclosure.policyVersion});
 const extracted=await extractSkills(client,claims,syntheticPdf(),crypto.randomUUID());
 assert.deepEqual(extracted.candidates.map(candidate=>candidate.skillId).sort(),['api-testing','automation','test-design']);
 const confirmed=await putSkills(client,claims,{entries:extracted.candidates.map(candidate=>({canonicalSkillId:candidate.skillId,label:candidate.label,candidateReference:candidate.candidateReference})),removals:[],expectedRevision:1});
 assert.equal(confirmed.skills.filter(skill=>skill.source==='cv').length,3);
 console.log('LIVE GR-L1 PASS: real synthetic PDF produced three expected candidates; confirmed CV inventory persisted.');
 const saved=await generateRoadmap(client,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:confirmed.profile.planningRevision,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false});
 assert.equal(saved.code,'PLAN_SAVED');assert.ok(saved.state.roadmap);const plan=saved.state.roadmap;
 await patchTask(client,claims,plan.tasks[0].id,{completed:true,expectedTaskRevision:0});
 const reloaded=await getState(client,claims);assert.equal(reloaded.roadmap?.id,plan.id);assert.equal(reloaded.roadmap?.tasks[0].completed,true);
 assert.equal((await client.roadmap.findUniqueOrThrow({where:{id:plan.id}})).modelVersion,GROQ_MODEL);
 console.log(`LIVE GR-L2 PASS: validated ${plan.tasks.length}-task roadmap saved; completion survived server reload.`);
}catch(error){
 console.error(error instanceof DomainError?`LIVE FAIL: ${error.code}: ${error.message}`:'LIVE FAIL: expected synthetic evidence or saved roadmap did not match.');
 if(error instanceof ProviderFailure&&error.providerStatus)console.error(`Provider HTTP status: ${error.providerStatus}. No echoed error body is logged.`);
 process.exitCode=1;
}finally{
 if(userId){const attempts=await client.aIAttempt.count({where:{operation:{userId}}});console.log(`Live provider attempts reserved: ${attempts}; identity was synthetic, Google OAuth was not tested.`);}
 await client.user.deleteMany({where:{email}});await client.invitation.deleteMany({where:{email}});
 // Keep aggregate allowance consumption; delete only this run's disposable synthetic learner.
 await client.$disconnect();
}
