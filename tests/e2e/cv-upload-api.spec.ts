import {test,expect} from '@playwright/test';
import {encode} from 'next-auth/jwt';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {catalogue} from '../../src/lib/catalogue';
import {POLICY_VERSION} from '../../src/lib/domain';
import {syntheticPdf} from '../synthetic-pdf';

test.skip(process.env.RUN_AUTHENTICATED_E2E!=='true','Requires an isolated database and synthetic signed session; no Google OAuth or live AI.');
test.beforeAll(async({request})=>{
 test.setTimeout(120000);
 expect((await request.get('/api/me')).status()).toBe(401);
});
test('CV-01/CV-03 / R04-R05: authenticated multipart parses a real PDF; malformed recovery preserves inventory',async({request})=>{
 test.setTimeout(90000);
 const client=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.TEST_DATABASE_URL,max:3})});
 const email=`pdf-api-${crypto.randomUUID()}@example.invalid`;
 const budgetId=process.env.AI_BUDGET_ID!;
 try{
  await client.invitation.create({data:{email}});
  const user=await client.user.create({data:{email,googleSubject:crypto.randomUUID(),name:'Synthetic Reviewer',profile:{create:{currentRole:'QA engineer',yearsExperience:7,hoursPerWeek:5,confirmed:true,inventoryConfirmed:true,planningRevision:1}},skills:{create:{key:'id:api-testing',canonicalSkillId:'api-testing',label:'API testing',source:'manual',catalogueVersion:catalogue.version}}}});
  await client.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version}});
  await client.fundingBudget.create({data:{id:budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:10,expiresAt:new Date(Date.now()+3600000)}});
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{uid:user.id,email,sessionVersion:0,name:user.name},maxAge:3600});
  const headers={Cookie:`next-auth.session-token=${token}`,Origin:`http://127.0.0.1:${process.env.E2E_PORT??'3000'}`};
  const consent=await request.put('/api/consent',{headers,data:{purpose:'cv_extraction',granted:true,policyVersion:POLICY_VERSION}});
  expect(consent.status()).toBe(200);
  const upload=(buffer:Buffer)=>request.post('/api/cv/extract',{headers,multipart:{file:{name:'synthetic.pdf',mimeType:'application/pdf',buffer},operationKey:crypto.randomUUID()}});
  const valid=await upload(Buffer.from(syntheticPdf()));
  const body=await valid.json();
  expect(body).toMatchObject({code:'OK',data:{code:'CANDIDATES_READY'}});
  expect(valid.status()).toBe(200);
  expect(body.data.candidates.map((candidate:{skillId:string})=>candidate.skillId).sort()).toEqual(['api-testing','automation','test-design']);
  expect(await client.confirmedSkill.count({where:{userId:user.id}})).toBe(1);
  const attempts=await client.aIAttempt.count({where:{operation:{userId:user.id}}});
  expect(attempts).toBe(1);
  const invalid=await upload(Buffer.from('not a PDF'));
  expect(invalid.status()).toBe(422);
  expect(await invalid.json()).toMatchObject({code:'PDF_MALFORMED'});
  expect(await client.aIAttempt.count({where:{operation:{userId:user.id}}})).toBe(attempts);
  const persisted=await client.confirmedSkill.findMany({where:{userId:user.id}});
  expect(persisted.map(skill=>({id:skill.canonicalSkillId,source:skill.source}))).toEqual([{id:'api-testing',source:'manual'}]);
 }finally{
  await client.user.deleteMany({where:{email}});
  await client.invitation.deleteMany({where:{email}});
  await client.fundingBudget.deleteMany({where:{id:budgetId}});
  await client.$disconnect();
 }
});
