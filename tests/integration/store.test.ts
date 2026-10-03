import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, patchTask, putProfile, type Claims } from '../../src/lib/store';
// Explicit isolated test DB only. Never implicitly use DATABASE_URL or erase existing data.
const url=process.env.TEST_DATABASE_URL;
if(!url)throw new Error('BLOCKED: set TEST_DATABASE_URL to a migrated isolated PostgreSQL database. Integration tests did not run.');
const client=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const suffix=crypto.randomUUID();const emailA=`a-${suffix}@example.invalid`;const emailB=`b-${suffix}@example.invalid`;
let a:Claims,b:Claims;
beforeAll(async()=>{
 await client.invitation.createMany({data:[{email:emailA},{email:emailB}]});
 const ua=await admitGoogle(client,`sub-a-${suffix}`,emailA,'Synthetic A');const ub=await admitGoogle(client,`sub-b-${suffix}`,emailB,'Synthetic B');
 a={id:ua.id,email:emailA,sessionVersion:0};b={id:ub.id,email:emailB,sessionVersion:0};
});
afterAll(async()=>{await client.user.deleteMany({where:{email:{in:[emailA,emailB]}}});await client.invitation.deleteMany({where:{email:{in:[emailA,emailB]}}});await client.$disconnect()});
describe('T01/T02/T08/T10 database controls',()=>{
 it('denies account attachment by changed Google subject',async()=>{await expect(admitGoogle(client,`wrong-${suffix}`,emailA,'Wrong subject')).rejects.toThrow('Operator review')});
 it('serializes simultaneous profile writes and rejects the stale write',async()=>{const body={currentRole:'QA engineer',yearsExperience:6,hoursPerWeek:4,expectedRevision:0};const results=await Promise.allSettled([putProfile(client,a,body),putProfile(client,a,{...body,hoursPerWeek:7})]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect((await getState(client,a)).profile.planningRevision).toBe(1)});
 it('prevents another learner updating a task',async()=>{
  const plan=await client.roadmap.create({data:{userId:a.id,inputRevision:1,catalogueVersion:'qa-synthetic-v1',tasks:{create:{position:0,week:1,title:'Synthetic',activity:'Fixture',completionCriterion:'Fixture',kind:'practical',skillIds:['ai-basics'],resourceIds:[],estimatedMinutes:30}}},include:{tasks:true}});
  await expect(patchTask(client,b,plan.tasks[0].id,{completed:true,expectedTaskRevision:0})).rejects.toThrow('Task not found');
  await patchTask(client,a,plan.tasks[0].id,{completed:true,expectedTaskRevision:0});
  await expect(patchTask(client,a,plan.tasks[0].id,{completed:false,expectedTaskRevision:0})).rejects.toThrow('saved data changed');
 });
 it('revocation invalidates the existing session claims',async()=>{await client.invitation.update({where:{email:emailB},data:{active:false}});await expect(getState(client,b)).rejects.toThrow('session or invitation')});
 it('deletes owned records and prevents automatic re-entry',async()=>{const result=await deleteAccount(client,a);expect(result.allStoreDeletionVerified).toBe(false);await expect(getState(client,a)).rejects.toThrow();await expect(admitGoogle(client,`sub-a-${suffix}`,emailA,'A')).rejects.toThrow('invitation');expect(await client.roadmap.count({where:{userId:a.id}})).toBe(0)});
});
