import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { syntheticPdf } from '../synthetic-pdf';
test.beforeAll(async({request})=>{
 if(process.env.RUN_AUTHENTICATED_E2E!=='true')return;
 // Cold dev-route compilation belongs to harness setup, outside the timed learner journey.
 test.setTimeout(120000);
 expect((await request.get('/api/me')).status()).toBe(401);
 expect((await request.get('/api/auth/providers')).status()).toBe(200);
});
test.beforeAll(async({request})=>{
 if(process.env.RUN_AUTHENTICATED_E2E!=='true')return;
 test.setTimeout(120000);
 expect((await request.get('/')).status()).toBe(200);
});
test('connected authenticated mock workflow: PDF review, plan, progress, fallback and status',async({page,context})=>{
 test.skip(process.env.RUN_AUTHENTICATED_E2E!=='true','Requires isolated TEST_DATABASE_URL and a simulated signed session; Google OAuth is not exercised.');
 test.setTimeout(90000);
 const client=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.TEST_DATABASE_URL,max:3})});
 const email=`e2e-${crypto.randomUUID()}@example.invalid`;const budgetId=process.env.AI_BUDGET_ID!;
 try{
  await client.invitation.create({data:{email}});
  const user=await client.user.create({data:{email,googleSubject:crypto.randomUUID(),name:'Synthetic Reviewer',profile:{create:{}}}});
  await client.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});
  await client.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:30,expiresAt:new Date(Date.now()+3600000)}});
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{uid:user.id,email,sessionVersion:0,name:user.name},maxAge:3600});
  await context.addCookies([{name:'next-auth.session-token',value:token,url:`http://127.0.0.1:${process.env.E2E_PORT??'3000'}`,httpOnly:true,sameSite:'Lax'}]);
  // Compile the private dev route before measuring UI persistence; this also verifies the synthetic session.
  const authenticated=await page.request.get('/api/me');expect(authenticated.status()).toBe(200);
  await page.goto('/');await expect(page.getByRole('heading',{name:'Make this path your own.'})).toBeVisible();
  await page.getByLabel('Current role').fill('QA engineer');
  await page.getByLabel('Years of experience').fill('7');
  await page.getByLabel('Learning hours per week').fill('5');
  await page.getByRole('button',{name:'Save profile'}).click();
  await expect(page.getByRole('status').filter({hasText:'Profile saved'})).toBeVisible();
  expect((await client.profile.findUniqueOrThrow({where:{userId:user.id}})).confirmed).toBe(true);
  await page.getByRole('button',{name:'Privacy & settings',exact:true}).click();
  for(const purpose of ['Optional CV skill extraction','Learning roadmap generation']){
   const saved=page.waitForResponse(response=>response.url().endsWith('/api/consent')&&response.request().method()==='PUT');
   await page.getByRole('switch',{name:purpose}).click();
   expect((await saved).status()).toBe(200);
   await expect(page.getByRole('switch',{name:purpose})).toBeChecked();
  }
  await page.getByRole('button',{name:'My skills',exact:true}).click();
  await page.getByLabel('Choose synthetic PDF').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(syntheticPdf(['Professional Summary','Experienced in API testing.','Work Experience','I authored test cases for a synthetic form.','Technologies','Playwright','Education','I used prompt engineering.','Extracurricular Activities','I configured CI/CD.']))});
  const prepared=page.waitForResponse(response=>response.url().endsWith('/api/cv/prepare')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Prepare private preview'}).click();expect((await prepared).status()).toBe(200);
  await expect(page.getByRole('region',{name:'Prepared CV text review'})).toBeVisible();
  expect(await client.aIAttempt.count({where:{operation:{userId:user.id}}})).toBe(0);
  await expect(page.getByRole('button',{name:'Send reviewed text for skill suggestions'})).toBeDisabled();
  const evidenceDir='docs/evidence/2026-10-17-pathway-exploration/legacy-cv-regression';await mkdir(evidenceDir,{recursive:true});
  await page.screenshot({path:evidenceDir+'/00-prepared-preview.png',fullPage:true});
  await page.getByRole('checkbox',{name:'I reviewed this prepared text and want to send it for skill suggestions.'}).check();
  const extracted=page.waitForResponse(response=>response.url().endsWith('/api/cv/extract')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Send reviewed text for skill suggestions'}).click();
  const extraction=await extracted;
  expect(await extraction.json()).toMatchObject({code:'OK',data:{code:'CANDIDATES_READY'}});
  expect(extraction.status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Temporary evidence · review before confirming'})).toBeVisible({timeout:15000});
  expect(await client.confirmedSkill.count({where:{userId:user.id}})).toBe(0);
  await expect(page.getByRole('checkbox',{name:'Select extracted Test automation'})).not.toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Select extracted API testing'})).not.toBeChecked();
  await expect(page.getByText('Listed in CV—experience not demonstrated.',{exact:false})).toBeVisible();
  await page.screenshot({path:evidenceDir+'/01-cv-evidence-review.png',fullPage:true});
  await page.getByRole('checkbox',{name:'Select extracted API testing'}).check();
await page.getByRole('checkbox',{name:'Select extracted Test design'}).check();
  await page.getByRole('button',{name:'Confirm skills',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Skills confirmed'})).toBeVisible();
  expect(await client.confirmedSkill.count({where:{userId:user.id,source:'cv'}})).toBe(3);
  await page.getByRole('button',{name:'Continue to roadmap'}).click();await page.getByRole('button',{name:'Generate mock roadmap'}).click();
  const task=page.getByRole('checkbox',{name:'Complete Generative AI fundamentals'});await expect(task).toBeVisible({timeout:15000});await task.click();await expect(task).toBeChecked();
  await page.reload();await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(task).toBeChecked();
  await page.screenshot({path:evidenceDir+'/02-roadmap-progress-reloaded.png',fullPage:true});
  await page.getByRole('button',{name:'Check last operation / recover saved plan'}).click();await expect(page.getByRole('status').filter({hasText:'succeeded'})).toBeVisible();
  await page.getByRole('button',{name:'My skills',exact:true}).click();await page.getByLabel('Choose synthetic PDF').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not PDF')});await page.getByRole('button',{name:'Prepare private preview'}).click();await expect(page.getByRole('status').filter({hasText:'PDF_MALFORMED'})).toBeVisible();
  expect(await client.confirmedSkill.count({where:{userId:user.id}})).toBe(3);
  await page.screenshot({path:evidenceDir+'/03-invalid-pdf-recovery.png',fullPage:true});
  await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(task).toBeChecked();
  const signedOut=page.waitForResponse(response=>response.url().endsWith('/api/auth/signout')&&response.request().method()==='POST');
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  expect((await signedOut).status()).toBe(200);
  await expect(page.getByRole('heading',{name:/Build on what/})).toBeVisible();
  expect((await page.request.get('/api/me')).status()).toBe(401);
  expect((await client.user.findUniqueOrThrow({where:{id:user.id}})).sessionVersion).toBe(1);
 }finally{
  await client.user.deleteMany({where:{email}});await client.invitation.deleteMany({where:{email}});await client.fundingBudget.deleteMany({where:{id:budgetId}});await client.$disconnect();
 }
});
