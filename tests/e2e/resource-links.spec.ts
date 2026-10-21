import { mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test,expect } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';

test('CW-UI: frozen researched-resource records render two external links and retain progress; synthetic metadata only',async({page,context})=>{
 test.skip(process.env.RUN_AUTHENTICATED_E2E!=='true','Requires isolated database and a synthetic signed identity, not Google OAuth.');
 test.setTimeout(120000);
 const url=process.env.TEST_DATABASE_URL!;
 if(!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Use an isolated local qa_pathways_* database.');
 const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:3})});
 const email=`resource-links-${crypto.randomUUID()}@example.invalid`;
 try{
  await client.invitation.create({data:{email}});
  const user=await client.user.create({data:{email,googleSubject:crypto.randomUUID(),name:'Synthetic Resource UI Learner',profile:{create:{currentRole:'Synthetic QA',yearsExperience:7,hoursPerWeek:5,confirmed:true,inventoryConfirmed:true,planningRevision:2}}}});
  const resources=[{url:'https://docs.example.org/qa-topic',title:'Synthetic official topic documentation',kind:'documentation'},{url:'https://lessons.example.org/qa-topic',title:'Synthetic supporting topic lesson',kind:'tutorial'}].map((item,index)=>{
   const hash=createHash('sha256').update(item.url).digest('hex');
   return {...item,id:`resource-${hash}`,sourceId:`groq-${hash}`,publisher:new URL(item.url).hostname,reviewStatus:'automatically_checked',checkedAt:new Date().toISOString(),accessNote:'Synthetic UI fixture only; no live page inspection occurred.',citation:{requestId:'synthetic-ui-fixture',toolIndex:0,resultIndex:index,resultType:'browser'}};
  });
  const snapshot={kind:'reviewed-direction-v1',mode:'groq',directionLabel:'Synthetic retained QA direction',context:{libraryVersion:'synthetic-retained-version',requirementSetId:'synthetic-retained-requirements'},resources:[{pathwayId:'qa',pathwayTitle:'Synthetic QA',topicId:'qa-topic',topicTitle:'Synthetic QA topic',resources,professionalReview:null,mode:'groq',model:'synthetic-ui-model',inputRevision:2,libraryVersion:'synthetic-retained-version',requirementSetId:'synthetic-retained-requirements',operationId:crypto.randomUUID()}]};
  await client.roadmap.create({data:{userId:user.id,inputRevision:2,catalogueVersion:catalogue.version,planningSnapshot:snapshot,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:`Synthetic UI activity ${week}`,activity:'Read the external topic and practise outside the app.',completionCriterion:'Record a synthetic observation.',kind:week===4?'practical':'learning',skillIds:['qa-topic'],resourceIds:week===1?resources.map(item=>item.id):[],estimatedMinutes:30}))}}});
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{uid:user.id,email,name:user.name,sessionVersion:0},maxAge:3600});
  await context.addCookies([{name:'next-auth.session-token',value:token,url:process.env.NEXTAUTH_URL!,httpOnly:true,sameSite:'Lax'}]);
  await page.goto('/');await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();
  for(const resource of resources){const link=page.getByRole('link',{name:new RegExp(resource.title)});await expect(link).toHaveAttribute('href',resource.url);await expect(link).toHaveAttribute('rel','noopener noreferrer');}
  await expect(page.getByText(/Synthetic UI fixture only; no live page inspection occurred/).first()).toBeVisible();
  const task=page.getByRole('checkbox',{name:'Complete Synthetic UI activity 1',exact:true});
  const saved=page.waitForResponse(response=>response.request().method()==='PATCH'&&response.url().includes('/api/roadmap/tasks/'));
  await task.click();expect((await saved).status()).toBe(200);await expect(task).toBeChecked();
  await page.reload();await page.getByRole('button',{name:'Learning roadmap',exact:true}).click();await expect(task).toBeChecked();
  await expect(page.getByRole('link',{name:/Synthetic official topic documentation/})).toBeVisible();
  const folder='docs/evidence/2026-10-19-connected-workflow';await mkdir(folder,{recursive:true});await page.screenshot({path:`${folder}/04-frozen-resource-links.png`,fullPage:true});
 }finally{await client.user.deleteMany({where:{email}});await client.invitation.deleteMany({where:{email}});await client.$disconnect();}
});
