import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../src/lib/catalogue';
import { configurationVersion,groqConfigurationSchema,GROQ_MODEL } from '../src/lib/ai-execution';
import { admitGoogle,getState,patchTask,putConsent,putProfile,putSkills } from '../src/lib/store';
import { generateRoadmap,researchReviewedResources } from '../src/lib/ai-operations';
import { activateRequirementSnapshot,registerRequirementSnapshot } from '../src/lib/requirement-snapshots';
import { getReviewedGaps,saveReviewedDirection } from '../src/lib/reviewed-direction';
import { requirementContentDigest } from '../src/lib/requirements';
import { syntheticReviewedLibrary } from '../tests/fixtures/reviewed-planning';
import { createGroqProvider } from '../src/lib/groq-provider';
import { DomainError } from '../src/lib/domain';
import { ProviderFailure } from '../src/lib/ai-provider';

// Explicitly opt-in. Never invoke this from npm test or authenticated mock E2E.
if(process.env.RUN_LIVE_REVIEWED_WORKFLOW!=='true')throw new Error('NOT RUN: requires explicit live synthetic authorization.');
if(process.env.NODE_ENV==='production'||process.env.GROQ_FREE_PLAN_CONFIRMED!=='true'||!process.env.GROQ_API_KEY)throw new Error('BLOCKED: local Free Plan, paid billing disabled and a server key are required.');
const url=process.env.TEST_DATABASE_URL;
if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||new URL(url).pathname!=='/qa_pathways_live_20261019')throw new Error('BLOCKED: use only the dedicated local qa_pathways_live_20261019 database.');
process.env.AI_MODE='groq';process.env.AI_BUDGET_ID='live-reviewed-synthetic-v1';
process.env.AI_SIGNING_SECRET??=randomUUID()+randomUUID();
const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const email=`live-reviewed-${randomUUID()}@example.invalid`;let userId:string|undefined,oldPlanId:string|undefined;
const notice='Authorized local student-portfolio synthetic test. Groq receives synthetic confirmed skill IDs, QA direction/topic labels and public requirement/source context, then independently retrieved public page excerpts for selection and synthetic planning activities/hours. Native browser search is provider-hosted and may use Exa; application HTTPS checks fetch candidate pages. No CV, learner identity or confidential data is sent in this journey. Groq documents possible reliability/abuse retention up to 30 days; account-specific and downstream retention settings are not independently verified. Free Plan with paid billing disabled was confirmed by Aravin. Automatic resource checks and synthetic effort do not establish professional quality.';
const reference='Aravin explicitly authorized the live synthetic journey on 19 October 2026; Free Plan and paid billing disabled confirmed in chat.';
const extendAllowance=process.argv.includes('--extend-test-allowance-to-10');
const resourceOnly=process.argv.includes('--resource-only');
let phase='configuration';
try{
 const existing=await client.fundingBudget.findUniqueOrThrow({where:{id:process.env.AI_BUDGET_ID}});
 let config=groqConfigurationSchema.parse(existing.configuration);
 assert.equal(existing.pricingVersion,configurationVersion(config));assert.equal(existing.enabled,true);
 assert.equal(existing.mode,'groq');assert.equal(existing.currency,'REQUESTS');assert.equal(existing.ceiling,config.ceilingRequests);
 assert.equal(existing.expiresAt.toISOString(),config.expiresAt);assert.equal(config.privacyNotice,notice);assert.ok(config.workflow);
 if(extendAllowance&&existing.ceiling===5){
  assert.equal(existing.reserved,5,'Preserve the five previously consumed reservations.');
  config=groqConfigurationSchema.parse({...config,ceilingRequests:10,expiresAt:new Date(Date.now()+86400000).toISOString(),workflow:{...config.workflow,approvalReference:reference+' Additional five requests authorized by Aravin on 21 October 2026.'}});
  const changed=await client.fundingBudget.updateMany({where:{id:existing.id,ceiling:5,reserved:5,enabled:true,pricingVersion:existing.pricingVersion},data:{ceiling:10,expiresAt:new Date(config.expiresAt),configuration:config,pricingVersion:configurationVersion(config)}});
  assert.equal(changed.count,1,'Allowance changed concurrently; stop without dispatch.');
  console.log('Isolated allowance extended to 10 with reserved=5 preserved; one-day test window renewed by explicit authorization.');
 }
 if(process.argv.includes('--extend-test-allowance-to-15')&&existing.ceiling===10){
  assert.equal(existing.reserved,10,'Preserve all ten consumed reservations.');
  config=groqConfigurationSchema.parse({...config,ceilingRequests:15});
  const changed=await client.fundingBudget.updateMany({where:{id:existing.id,ceiling:10,reserved:10,enabled:true,pricingVersion:existing.pricingVersion},data:{ceiling:15,configuration:config,pricingVersion:configurationVersion(config)}});
  assert.equal(changed.count,1,'Allowance changed concurrently; stop without dispatch.');
  const saved=await client.fundingBudget.findUniqueOrThrow({where:{id:existing.id}});
  assert.equal(saved.reserved,10);assert.equal(saved.expiresAt.toISOString(),existing.expiresAt.toISOString());
  console.log('Isolated allowance extended to 15; ten consumed reservations and expiry preserved.');
 }
 assert.ok([10,15].includes(config.ceilingRequests),'Requires the explicitly authorized isolated allowance.');
 assert.ok(new Date(config.expiresAt)>new Date(),'Expired allowance requires new explicit authorization; never auto-renew.');
 await client.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
 const library=syntheticReviewedLibrary(2);
 library.sources=[{id:'source',title:'Playwright documentation — source context for synthetic smoke only',url:'https://playwright.dev/docs/intro',checkedOn:new Date().toISOString().slice(0,10)}];
 const labels=['Playwright test assertions','Playwright GitHub Actions CI'];
 for(const [index,node] of library.capabilities.entries()){
  node.label=labels[index];node.meaningVersion='synthetic-live-v1';node.meaning=`Synthetic planning topic: ${labels[index]}`;
  node.scope!.includes=[index?'Run Playwright tests in GitHub Actions with an npm-based workflow.':'Use Playwright expect assertions with browser locators and auto-retrying checks.'];
  node.scope!.excludes=['Production readiness, professional assessment and claims of proficiency.'];
  node.scope!.startingKnowledge=['Synthetic assumption: basic TypeScript, Git and npm commands.'];
 }
 library.review={reviewer:'Synthetic smoke fixture only; not professional content approval',reviewedOn:new Date().toISOString().slice(0,10),contentDigest:requirementContentDigest(library)};
 await registerRequirementSnapshot(client,library,'Synthetic isolated live smoke; no actual v4 content publication.');await activateRequirementSnapshot(client,library.version);
 await client.invitation.create({data:{email}});const user=await admitGoogle(client,randomUUID(),email,'Synthetic Live Workflow Learner');userId=user.id;
 const claims={id:user.id,email,sessionVersion:0};
 await putProfile(client,claims,{currentRole:'Synthetic QA engineer',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(client,claims,{entries:[],removals:[],expectedRevision:1});
 await putConsent(client,claims,{purpose:'roadmap_generation',granted:true,policyVersion:(await getState(client,claims)).processing!.policyVersion});
 await saveReviewedDirection(client,claims,{version:library.version,directionId:'qa',deferredCapabilityIds:[],expectedPlanningRevision:2});
 assert.equal((await getReviewedGaps(client,claims))!.mandatoryGapIds.length,2);
 const old=await client.roadmap.create({data:{userId:user.id,inputRevision:2,catalogueVersion:catalogue.version,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:'Prior synthetic activity',activity:'Previous synthetic work',completionCriterion:'Prior observation',kind:'practical',skillIds:[],resourceIds:[],estimatedMinutes:15,completed:true}))}}});
 oldPlanId=old.id;
 const request={operationKey:randomUUID(),expectedPlanningRevision:3,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:true};
 phase='missing-resource fallback';await assert.rejects(generateRoadmap(client,claims,request),(error:unknown)=>error instanceof DomainError&&error.code==='RESOURCE_VERIFICATION_REQUIRED');
 assert.equal(await client.aIAttempt.count({where:{operation:{userId:user.id}}}),0);
 assert.equal((await client.roadmap.findUniqueOrThrow({where:{id:old.id}})).status,'active');
 console.log('LIVE WF-0 PASS: missing resources blocked dispatch and preserved prior plan.');
 const provider=createGroqProvider({apiKey:process.env.GROQ_API_KEY!,model:GROQ_MODEL,planningApprovalReference:reference,nativeResearch:{approvalReference:reference,maxNativeToolCalls:config.workflow!.maxReportedToolCalls},
  onResearchDiagnostic:event=>console.log(JSON.stringify({diagnostic:'native-research-validation',...event})),
  fetchImpl:async(input,init)=>{const response=await fetch(input,init);console.log(`Provider HTTP ${response.status}; no prompt, response body or credential logged.`);return response;}
 });
 for(const topic of library.capabilities){
  phase=`research ${topic.label}`;
  const result=await researchReviewedResources(client,claims,{operationKey:randomUUID(),expectedPlanningRevision:3,topicId:topic.id},provider);
  assert.equal(result.code,'RESOURCES_READY');
  const pair=result.state.reviewedDirection!.resourcePreviews.find(item=>item.topicId===topic.id)!;
  console.log(`LIVE WF-1 PASS: ${topic.label}; ${pair.resources.length} checked resources.`);
  for(const resource of pair.resources)console.log(JSON.stringify({kind:resource.kind,url:resource.url,checkedAt:resource.checkedAt,accessNote:resource.accessNote}));
  if(resourceOnly)break;
 }
 if(!resourceOnly){
 phase='roadmap activation';const result=await generateRoadmap(client,claims,{...request,operationKey:randomUUID()},provider);assert.equal(result.code,'PLAN_SAVED');
 const plan=result.state.roadmap!;await patchTask(client,claims,plan.tasks[0].id,{completed:true,expectedTaskRevision:0});
 assert.equal((await getState(client,claims)).roadmap!.tasks[0].completed,true);
 const archived=await client.roadmap.findUniqueOrThrow({where:{id:old.id},include:{tasks:true}});assert.equal(archived.status,'archived');assert.ok(archived.tasks.every(task=>task.completed));
 assert.equal(await client.roadmap.count({where:{userId:user.id,status:'active'}}),1);
 console.log(`LIVE WF-2 PASS: ${plan.tasks.length} tasks saved atomically; old progress archived and new completion persisted. Synthetic identity/content only; no Google OAuth or CV extraction in this resource-focused run.`);
 }
}catch(error){
 console.error(`LIVE FAIL during ${phase}: ${error instanceof DomainError?error.code:'HARNESS_OR_ASSERTION'}. No raw provider response logged.`);
 if(error instanceof ProviderFailure&&error.providerStatus)console.error(`Provider HTTP status: ${error.providerStatus}.`);
 if(oldPlanId){const old=await client.roadmap.findUniqueOrThrow({where:{id:oldPlanId},include:{tasks:true}});console.log(`Failure preservation: prior plan active=${old.status==='active'}, prior completion retained=${old.tasks.every(task=>task.completed)}.`);}
 process.exitCode=1;
}finally{
 if(userId){const budget=await client.fundingBudget.findUniqueOrThrow({where:{id:process.env.AI_BUDGET_ID}});console.log(`Run reservations: ${await client.aIAttempt.count({where:{operation:{userId}}})}; aggregate reserved: ${budget.reserved}/${budget.ceiling}. Counters are not reset.`);await client.user.deleteMany({where:{id:userId}});}
 await client.invitation.deleteMany({where:{email}});await client.requirementActivation.deleteMany({where:{id:'active'}});await client.$disconnect();
}
