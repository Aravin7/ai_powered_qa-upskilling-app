import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { registerRequirementSnapshot, activateRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { syntheticReviewedLibrary } from '../fixtures/reviewed-planning';

test('RR-E2E: reviewed direction → mock resources → atomic plan → completion → reload, with missing-resource fallback',async({page,context,request})=>{
 test.skip(process.env.RUN_AUTHENTICATED_E2E!=='true','Requires isolated database and synthetic signed identity; not Google OAuth evidence.');
 test.setTimeout(120000);
 const url=process.env.TEST_DATABASE_URL!;
 if(!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Use only isolated qa_pathways_* database.');
 const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:3})});
 const email=`reviewed-browser-${crypto.randomUUID()}@example.invalid`;const original=await client.requirementActivation.findUnique({where:{id:'active'}});
 const evidence='docs/evidence/2026-10-18-reviewed-roadmap';
 try{
  expect((await request.post('/api/pathways/reviewed/resources',{headers:{Origin:process.env.NEXTAUTH_URL!},data:{}})).status()).toBe(401);
  await client.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
  await client.fundingBudget.upsert({where:{id:process.env.E2E_BUDGET_ID!},create:{id:process.env.E2E_BUDGET_ID!,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:100,expiresAt:new Date(Date.now()+3600000)},update:{}});
  const library=syntheticReviewedLibrary(2);await registerRequirementSnapshot(client,library,'synthetic browser resource/plan test');await activateRequirementSnapshot(client,library.version);
  await client.invitation.create({data:{email}});
  const user=await client.user.create({data:{email,googleSubject:crypto.randomUUID(),name:'Synthetic QA Learner',profile:{create:{currentRole:'Synthetic QA',yearsExperience:7,hoursPerWeek:5,confirmed:true,inventoryConfirmed:true,planningRevision:2}},consents:{create:{purpose:'roadmap_generation',granted:true,policyVersion:POLICY_VERSION}}}});
  const old=await client.roadmap.create({data:{userId:user.id,inputRevision:2,catalogueVersion:catalogue.version,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:`Previous task ${week}`,activity:'Previous synthetic work',completionCriterion:'Previous result',kind:'practical',skillIds:['automation'],resourceIds:[],estimatedMinutes:30,completed:true}))}}});
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{uid:user.id,email,name:user.name,sessionVersion:0},maxAge:3600});
  await context.addCookies([{name:'next-auth.session-token',value:token,url:process.env.NEXTAUTH_URL!,httpOnly:true,sameSite:'Lax'}]);
  await page.goto('/');await page.getByRole('button',{name:'Explore directions',exact:true}).click();
  const panel=page.getByRole('region',{name:'Reviewed direction and gaps',exact:true});
  await panel.getByLabel('Reviewed QA direction').selectOption('qa');await panel.getByRole('button',{name:'Save reviewed direction',exact:true}).click();
  await expect(panel.getByRole('region',{name:'Saved direction comparison'})).toBeVisible();
  await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await page.getByRole('button',{name:'Replace plan',exact:true}).click();
  await page.getByRole('checkbox',{name:'I understand that this introductory plan starts without established skill evidence.'}).check();
  await page.getByRole('button',{name:'Generate mock roadmap',exact:true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Research resources for every retained learning topic');
  expect(await client.aIAttempt.count({where:{operation:{userId:user.id}}})).toBe(0);
  expect((await client.roadmap.findUniqueOrThrow({where:{id:old.id}})).status).toBe('active');
  await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/01-missing-resource-fallback.png`,fullPage:true});
  await page.getByRole('button',{name:'Explore directions',exact:true}).click();
  // Let the real server save topic 1, then lose only its browser response.
  await page.route('**/api/pathways/reviewed/resources',async route=>{
   const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed');
  },{times:1});
  for(let index=1;index<=2;index++){
   await panel.getByRole('button',{name:`Research mock resources for Synthetic QA topic ${index}`,exact:true}).click();
   if(index===1){
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    const key=await page.evaluate(()=>sessionStorage.getItem('qa-operation-key'));
    expect(key).toBeTruthy();
    expect(await client.aIOperation.findFirst({where:{userId:user.id,key:key!,kind:'resource_research'}})).toMatchObject({state:'succeeded',attempts:2});
    const recover=page.getByRole('button',{name:'Check last operation / recover saved resources',exact:true});
    await expect(recover).toBeEnabled();await recover.click();
    await expect(page.getByText('Operation succeeded: MOCK_REVIEWED_RESOURCES_READY. 2 attempt(s).')).toBeVisible();
    expect(await client.aIAttempt.count({where:{operation:{userId:user.id}}})).toBe(2);
   }
   await expect(panel.getByRole('button',{name:`Refresh mock resources for Synthetic QA topic ${index}`,exact:true})).toBeVisible();
  }
  await expect(panel.getByText('Synthetic documentation and supporting resource saved. No live page check.')).toHaveCount(2);
  await page.screenshot({path:`${evidence}/02-synthetic-topic-resources.png`,fullPage:true});
  await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await page.getByRole('button',{name:'Replace plan',exact:true}).click();
  await page.getByRole('button',{name:'Generate mock roadmap',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Synthetic QA direction',exact:true})).toBeVisible();
  await expect(page.getByText(/230 planned minutes/)).toBeVisible();
  await expect(page.getByText(/awaiting resource and plan integration/)).toHaveCount(0);
  await expect(page.getByRole('checkbox',{name:/^Complete /})).toHaveCount(5);
  const complete=page.getByRole('checkbox',{name:'Complete Prepare Synthetic QA topic 1',exact:true});await complete.click();await expect(complete).toBeChecked();
  await page.reload();await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(complete).toBeChecked();
  await expect(page.getByText(/synthetic placeholder \(no live page check\)/).first()).toBeVisible();
  await page.screenshot({path:`${evidence}/03-saved-plan-progress-reload.png`,fullPage:true});
  const archived=await client.roadmap.findUniqueOrThrow({where:{id:old.id},include:{tasks:true}});expect(archived.status).toBe('archived');expect(archived.tasks.every(task=>task.completed)).toBe(true);
  expect(await client.roadmap.count({where:{userId:user.id,status:'active'}})).toBe(1);expect(await client.aIAttempt.count({where:{operation:{userId:user.id}}})).toBe(5);
 }finally{
  await client.user.deleteMany({where:{email}});await client.invitation.deleteMany({where:{email}});
  if(original)await activateRequirementSnapshot(client,original.version);else await client.requirementActivation.deleteMany({where:{id:'active'}});
  await client.$disconnect();
 }
});
