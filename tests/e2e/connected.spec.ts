import { test, expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { syntheticPdf } from '../synthetic-pdf';
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
  await page.getByRole('switch',{name:'Optional CV skill extraction'}).click();await expect(page.getByRole('switch',{name:'Optional CV skill extraction'})).toBeChecked();
  await page.getByRole('switch',{name:'Learning roadmap generation'}).click();await expect(page.getByRole('switch',{name:'Learning roadmap generation'})).toBeChecked();
  await page.getByRole('button',{name:'My skills',exact:true}).click();
  await page.getByLabel('Choose synthetic PDF').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from(syntheticPdf())});
  await page.getByRole('button',{name:'Extract candidate skills'}).click();
  await expect(page.getByRole('heading',{name:'Temporary evidence · review before confirming'})).toBeVisible({timeout:15000});
  expect(await client.confirmedSkill.count({where:{userId:user.id}})).toBe(0);
  await page.getByRole('button',{name:'Confirm skills',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Skills confirmed'})).toBeVisible();
  expect(await client.confirmedSkill.count({where:{userId:user.id,source:'cv'}})).toBe(3);
  await page.getByRole('button',{name:'Continue to roadmap'}).click();await page.getByRole('button',{name:'Generate mock roadmap'}).click();
  const task=page.getByRole('checkbox',{name:'Complete Generative AI fundamentals'});await expect(task).toBeVisible({timeout:15000});await task.click();await expect(task).toBeChecked();
  await page.reload();await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(task).toBeChecked();
  await page.getByRole('button',{name:'Check last operation / recover saved plan'}).click();await expect(page.getByRole('status').filter({hasText:'succeeded'})).toBeVisible();
  await page.getByRole('button',{name:'My skills',exact:true}).click();await page.getByLabel('Choose synthetic PDF').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not PDF')});await page.getByRole('button',{name:'Extract candidate skills'}).click();await expect(page.getByRole('status').filter({hasText:'PDF_MALFORMED'})).toBeVisible();
  expect(await client.confirmedSkill.count({where:{userId:user.id}})).toBe(3);
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
