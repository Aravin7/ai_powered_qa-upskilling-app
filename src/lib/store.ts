import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { catalogue } from './catalogue';
import { DomainError, assertRevision, consentSchema, inventorySchema, profileSchema, reviewInventory, sameInventory, taskSchema } from './domain';
import { processingDisclosure } from './ai-execution';
import type { AppState, SkillEntry } from './types';
import { verifyCandidate } from './candidate-origin';
import { capabilityLibrary, preferenceSchema, savePreferencesSchema, selectPathwaySchema, storedSuggestionsSchema } from './pathways';
import { storedResourcePreviewsSchema } from './resource-preview';
import { reviewedResourcePreviewsSchema, reviewedPlanViewSchema } from './reviewed-resources';
export type Claims = { id: string; email: string; sessionVersion: number };
export type Tx = Prisma.TransactionClient;
// A single lock order (invitation, then user) serializes mutations with revocation/deletion.
export async function access(tx:Tx,claims:Claims,lock=false) {
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
  const [p,skills,consents,roadmap,exploration]=await Promise.all([
   tx.profile.findUniqueOrThrow({where:{userId:user.id}}),
   tx.confirmedSkill.findMany({where:{userId:user.id},orderBy:{key:'asc'}}),
   tx.consent.findMany({where:{userId:user.id},orderBy:{sequence:'asc'}}),
   tx.roadmap.findFirst({where:{userId:user.id,status:'active'},include:{tasks:{orderBy:{position:'asc'}}}}),
   tx.pathwayExploration.findUnique({where:{userId:user.id}})
  ]);
  const current={cv_extraction:false,roadmap_generation:false};
  const selected=await tx.reviewedDirection.findUnique({where:{userId:user.id}});
  const active=await tx.requirementActivation.findUnique({where:{id:'active'}});
  const reviewedDirection=selected?{snapshotVersion:selected.snapshotVersion,directionId:selected.directionId,label:selected.label,deferredCapabilityIds:selected.deferredCapabilityIds,requirementSetId:selected.requirementSetId,current:active?.version===selected.snapshotVersion,resourcePreviews:reviewedResourcePreviewsSchema.parse(selected.resourcePreviews)}:null;
  const frozen=reviewedPlanViewSchema.safeParse(roadmap?.planningSnapshot);
  const reviewed=frozen.success?{mode:frozen.data.mode,directionLabel:frozen.data.directionLabel,libraryVersion:frozen.data.context.libraryVersion,requirementSetId:frozen.data.context.requirementSetId,current:active?.version===frozen.data.context.libraryVersion,resources:frozen.data.resources}:undefined;
  const processing=await processingDisclosure(tx);
  const suggestions=exploration?storedSuggestionsSchema.parse(exploration.suggestions):[];
  const explorationCurrent=!!exploration&&exploration.libraryVersion===(suggestions.some(item=>item.generationMode==='groq')?active?.version:capabilityLibrary.version);
  for(const c of consents)if(c.purpose in current)current[c.purpose as keyof typeof current]=c.policyVersion===processing.policyVersion&&c.granted;
  return {processing,reviewedDirection,name:user.name,pathwayExploration:exploration?{preferences:preferenceSchema.parse(exploration.preferences),suggestions,current:explorationCurrent,inputRevision:exploration.inputRevision,libraryVersion:exploration.libraryVersion,selectedSuggestionId:exploration.selectedSuggestionId,resourcePreviews:storedResourcePreviewsSchema.parse(exploration.resourcePreviews)}:null,profile:{currentRole:p.currentRole,yearsExperience:p.yearsExperience,hoursPerWeek:p.hoursPerWeek,confirmed:p.confirmed,inventoryConfirmed:p.inventoryConfirmed,planningRevision:p.planningRevision},skills:skills.map(s=>({key:s.key,canonicalSkillId:s.canonicalSkillId,label:s.label,source:s.source as SkillEntry['source']})),consents:current,roadmap:roadmap?{reviewed,id:roadmap.id,inputRevision:roadmap.inputRevision,catalogueVersion:roadmap.catalogueVersion,createdAt:roadmap.createdAt.toISOString(),deferredSkillIds:roadmap.deferredSkillIds,tasks:roadmap.tasks.map(t=>({id:t.id,week:t.week,kind:t.kind as 'learning'|'practical',title:t.title,activity:t.activity,completionCriterion:t.completionCriterion,skillIds:t.skillIds,resourceIds:t.resourceIds,estimatedMinutes:t.estimatedMinutes,completed:t.completed,revision:t.revision}))}:null,archivedRoadmaps:[]};
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
  const consent=await tx.consent.findFirst({where:{userId:claims.id,purpose:'cv_extraction'},orderBy:{sequence:'desc'}});
  const policyVersion=(await processingDisclosure(tx)).policyVersion;
  const next=reviewInventory(old,body).map(s=>{
   if(old.some(o=>o.key===s.key))return s;
   const submitted=body.entries.find(e=>e.canonicalSkillId===s.canonicalSkillId&&e.label===s.label);
   if(submitted?.candidateReference){
    if(!consent?.granted||consent.policyVersion!==policyVersion||!verifyCandidate(submitted.candidateReference,claims,consent.sequence,s.canonicalSkillId,s.label))throw new DomainError('CANDIDATE_EXPIRED','Candidate reference expired or changed. Review it as manual entry before saving.',409);
    return {...s,source:'cv' as const};
   }return s;
  });const changed=!sameInventory(old,next)||!p.inventoryConfirmed;
  if(changed){
   // Retain existing IDs/provenance and attached meaning confirmations. The
   // reviewed merge already rejects omissions without explicit removal.
   await tx.confirmedSkill.deleteMany({where:{userId:claims.id,key:{notIn:next.map(s=>s.key)}}});
   const added=next.filter(s=>!old.some(o=>o.key===s.key));
   if(added.length)await tx.confirmedSkill.createMany({data:added.map(s=>({...s,userId:claims.id,catalogueVersion:catalogue.version}))});
  }
  await tx.profile.update({where:{userId:claims.id},data:{inventoryConfirmed:true,planningRevision:{increment:changed?1:0}}});
 });
 return getState(client,claims);
}
export async function putConsent(client:PrismaClient,claims:Claims,input:unknown){
 const body=consentSchema.parse(input);
 await client.$transaction(async tx=>{await access(tx,claims,true);const disclosure=await processingDisclosure(tx);if(body.granted&&(disclosure.mode==='disabled'||body.policyVersion!==disclosure.policyVersion))throw new DomainError('CONSENT_REQUIRED','Read and accept the current provider notice before granting consent.',403);await tx.consent.create({data:{...body,userId:claims.id}});if(!body.granted)await tx.aIOperation.updateMany({where:{userId:claims.id,kind:{in:body.purpose==='roadmap_generation'?['roadmap_generation','pathway_suggestions','resource_research']:[body.purpose]},state:'running'},data:{state:'cancelled',code:'CONSENT_REQUIRED'}});});
 return getState(client,claims);
}
export async function endSession(client:PrismaClient,claims:Claims){
 await client.$transaction(async tx=>{
  // Idempotent for a repeated sign-out or an already deleted/revoked account.
  try{await access(tx,claims,true);}catch(error){if(error instanceof DomainError&&error.code==='ACCESS_ENDED')return;throw error;}
  await tx.user.update({where:{id:claims.id},data:{sessionVersion:{increment:1}}});await tx.aIOperation.updateMany({where:{userId:claims.id,state:'running'},data:{state:'cancelled',code:'ACCESS_ENDED'}});
 });
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

export async function putPathwayPreferences(client:PrismaClient,claims:Claims,input:unknown){
 const body=savePreferencesSchema.parse(input);
 const preferences={...body.preferences,interests:[...body.preferences.interests].sort()};
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
  assertRevision(profile.planningRevision,body.expectedPlanningRevision);
  const existing=await tx.pathwayExploration.findUnique({where:{userId:claims.id}});
  if(existing&&JSON.stringify(preferenceSchema.parse(existing.preferences))===JSON.stringify(preferences))return;
  const revision=profile.planningRevision+1;
  await tx.profile.update({where:{userId:claims.id},data:{planningRevision:revision}});
  const data={preferences,inputRevision:revision,libraryVersion:capabilityLibrary.version,suggestions:[],selectedSuggestionId:null,operationId:null,resourcePreviews:[]};
  await tx.reviewedDirection.deleteMany({where:{userId:claims.id}});
  await tx.pathwayExploration.upsert({where:{userId:claims.id},create:{...data,userId:claims.id},update:data});
 });
 return getState(client,claims);
}

export async function selectPathway(client:PrismaClient,claims:Claims,input:unknown){
 const body=selectPathwaySchema.parse(input);
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
  assertRevision(profile.planningRevision,body.expectedPlanningRevision);
  const row=await tx.pathwayExploration.findUnique({where:{userId:claims.id}});
  const savedSuggestions=row?storedSuggestionsSchema.parse(row.suggestions):[];
  const currentVersion=savedSuggestions.some(item=>item.generationMode==='groq')?(await tx.requirementActivation.findUnique({where:{id:'active'}}))?.version:capabilityLibrary.version;
  if(body.suggestionId){
   if(!row||row.inputRevision!==profile.planningRevision||row.libraryVersion!==currentVersion)
    throw new DomainError('STALE_INPUT','Refresh suggestions for your current saved inputs before selecting.',409);
   if(!savedSuggestions.some(suggestion=>suggestion.id===body.suggestionId))
    throw new DomainError('UNKNOWN_DIRECTION','Choose one of your saved suggestions.',400);
  }
  if(!row||row.selectedSuggestionId===body.suggestionId)return;
  if(body.suggestionId)await tx.reviewedDirection.deleteMany({where:{userId:claims.id}});
  const revision=profile.planningRevision+1;
  await tx.profile.update({where:{userId:claims.id},data:{planningRevision:revision}});
  await tx.pathwayExploration.update({where:{userId:claims.id},data:{selectedSuggestionId:body.suggestionId,inputRevision:row.inputRevision===profile.planningRevision?revision:row.inputRevision}});
 });
 return getState(client,claims);
}
