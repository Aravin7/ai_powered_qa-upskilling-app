import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { catalogue } from './catalogue';
import { DomainError, assertRevision, consentSchema, inventorySchema, profileSchema, reviewInventory, sameInventory, taskSchema, POLICY_VERSION } from './domain';
import type { AppState, SkillEntry } from './types';
export type Claims = { id: string; email: string; sessionVersion: number };
type Tx = Prisma.TransactionClient;
// A single lock order (invitation, then user) serializes mutations with revocation/deletion.
async function access(tx:Tx,claims:Claims,lock=false) {
 if(lock) {
  await tx.$queryRaw`SELECT email FROM "Invitation" WHERE email=${claims.email} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${claims.id} FOR UPDATE`;
 }
 const [user,invitation]=await Promise.all([tx.user.findUnique({where:{id:claims.id}}),tx.invitation.findUnique({where:{email:claims.email}})]);
 if(!user || user.status!=='active' || user.email!==claims.email || user.sessionVersion!==claims.sessionVersion || !invitation?.active) throw new DomainError('ACCESS_ENDED','Your session or invitation has ended. Sign in again.',403);
 return user;
}
export async function admitGoogle(client:PrismaClient,subject:string,email:string,name:string) {
 const normalized=email.toLowerCase().trim();
 return client.$transaction(async tx=>{
  await tx.$queryRaw`SELECT email FROM "Invitation" WHERE email=${normalized} FOR UPDATE`;
  const invite=await tx.invitation.findUnique({where:{email:normalized}});
  if(!invite?.active)throw new DomainError('INVITATION_REQUIRED','An active invitation is required.',403);
  const existing=await tx.user.findUnique({where:{googleSubject:subject}});
  if(existing){if(existing.status!=='active'||existing.email!==normalized)throw new DomainError('ACCESS_ENDED','Operator review is required.',403);return existing;}
  // A different Google subject cannot inherit an existing account by matching email.
  if(await tx.user.findUnique({where:{email:normalized}}))throw new DomainError('IDENTITY_CONFLICT','Operator review is required.',403);
  return tx.user.create({data:{googleSubject:subject,email:normalized,name:name.slice(0,100),profile:{create:{}}}});
 });
}
export async function getState(client:PrismaClient,claims:Claims):Promise<AppState> {
 return client.$transaction(async tx=>{
  const user=await access(tx,claims);
  const [p,skills,consents,roadmap]=await Promise.all([
   tx.profile.findUniqueOrThrow({where:{userId:user.id}}),
   tx.confirmedSkill.findMany({where:{userId:user.id},orderBy:{key:'asc'}}),
   tx.consent.findMany({where:{userId:user.id},orderBy:{sequence:'asc'}}),
   tx.roadmap.findFirst({where:{userId:user.id,status:'active'},include:{tasks:{orderBy:{position:'asc'}}}})
  ]);
  const current={cv_extraction:false,roadmap_generation:false};
  for(const c of consents)if(c.purpose in current)current[c.purpose as keyof typeof current]=c.policyVersion===POLICY_VERSION&&c.granted;
  return {name:user.name,profile:{currentRole:p.currentRole,yearsExperience:p.yearsExperience,hoursPerWeek:p.hoursPerWeek,confirmed:p.confirmed,inventoryConfirmed:p.inventoryConfirmed,planningRevision:p.planningRevision},skills:skills.map(s=>({key:s.key,canonicalSkillId:s.canonicalSkillId,label:s.label,source:s.source as SkillEntry['source']})),consents:current,roadmap:roadmap?{id:roadmap.id,inputRevision:roadmap.inputRevision,catalogueVersion:roadmap.catalogueVersion,createdAt:roadmap.createdAt.toISOString(),deferredSkillIds:[],tasks:roadmap.tasks.map(t=>({id:t.id,week:t.week,kind:t.kind as 'learning'|'practical',title:t.title,activity:t.activity,completionCriterion:t.completionCriterion,skillIds:t.skillIds,resourceIds:t.resourceIds,estimatedMinutes:t.estimatedMinutes,completed:t.completed,revision:t.revision}))}:null,archivedRoadmaps:[]};
 },{isolationLevel:'RepeatableRead'});
}
export async function putProfile(client:PrismaClient,claims:Claims,input:unknown) {
 const body=profileSchema.parse(input);
 await client.$transaction(async tx=>{
  await access(tx,claims,true);const p=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});assertRevision(p.planningRevision,body.expectedRevision);
  const changed=!p.confirmed||p.currentRole!==body.currentRole||p.yearsExperience!==body.yearsExperience||p.hoursPerWeek!==body.hoursPerWeek;
  await tx.profile.update({where:{userId:claims.id},data:{currentRole:body.currentRole,yearsExperience:body.yearsExperience,hoursPerWeek:body.hoursPerWeek,confirmed:true,planningRevision:{increment:changed?1:0}}});
 });
 return getState(client,claims);
}
export async function putSkills(client:PrismaClient,claims:Claims,input:unknown) {
 const body=inventorySchema.parse(input);
 await client.$transaction(async tx=>{
  await access(tx,claims,true);const p=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});assertRevision(p.planningRevision,body.expectedRevision);
  const rows=await tx.confirmedSkill.findMany({where:{userId:claims.id}});
  const old:SkillEntry[]=rows.map(s=>({key:s.key,canonicalSkillId:s.canonicalSkillId,label:s.label,source:s.source as SkillEntry['source']}));
  const next=reviewInventory(old,body);const changed=!sameInventory(old,next)||!p.inventoryConfirmed;
  if(changed){
   await tx.confirmedSkill.deleteMany({where:{userId:claims.id}});
   await tx.confirmedSkill.createMany({data:next.map(s=>({...s,userId:claims.id,catalogueVersion:catalogue.version}))});
  }
  await tx.profile.update({where:{userId:claims.id},data:{inventoryConfirmed:true,planningRevision:{increment:changed?1:0}}});
 });
 return getState(client,claims);
}
export async function putConsent(client:PrismaClient,claims:Claims,input:unknown){
 const body=consentSchema.parse(input);
 await client.$transaction(async tx=>{await access(tx,claims,true);await tx.consent.create({data:{...body,userId:claims.id}});});
 return getState(client,claims);
}
export async function patchTask(client:PrismaClient,claims:Claims,id:string,input:unknown){
 const body=taskSchema.parse(input);
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  const task=await tx.roadmapTask.findFirst({where:{id,roadmap:{userId:claims.id,status:'active'}}});
  if(!task)throw new DomainError('NOT_FOUND','Task not found.',404);
  assertRevision(task.revision,body.expectedTaskRevision);
  await tx.roadmapTask.update({where:{id},data:{completed:body.completed,revision:{increment:1}}});
 });return getState(client,claims);
}
export async function deleteAccount(client:PrismaClient,claims:Claims){
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  await tx.invitation.update({where:{email:claims.email},data:{active:false}});
  await tx.user.update({where:{id:claims.id},data:{status:'deleting',sessionVersion:{increment:1}}});
  await tx.user.delete({where:{id:claims.id}});
 });
 // Revoked invitation is a minimal re-entry fence, not a claim of all-store erasure.
 return {applicationRecordsDeleted:true,invitationRevoked:true,allStoreDeletionVerified:false};
}
