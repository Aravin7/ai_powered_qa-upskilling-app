import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { access, getState, type Claims, type Tx } from './store';
import { assertRevision, DomainError } from './domain';
import { activeRequirementSnapshot } from './requirement-snapshots';
import { compileDirectionRequirements, directionSelectionSchema } from './requirements';
import { compareSavedInventory } from './skill-reconciliation';
import { currentReviewedResources } from './reviewed-resources';
import { reviewedPlanContext } from './reviewed-roadmap';

const selectionSchema=directionSelectionSchema.extend({
 directionId:directionSelectionSchema.shape.directionId.nullable(),
 version:z.string().min(1).max(100),expectedPlanningRevision:z.number().int().nonnegative(),
}).strict();

async function active(tx:Tx){
 await tx.$queryRaw`SELECT id FROM "RequirementActivation" WHERE id='active' FOR SHARE`;
 return activeRequirementSnapshot(tx);
}

/** Caller holds eligibility/user lock. Never take selection or priorities from a GET caller. */
export async function selectedDirectionComparison(tx:Tx,owner:string){
 const saved=await tx.reviewedDirection.findUnique({where:{userId:owner}});
 if(!saved)return null;
 const current=await active(tx);
 if(!current||saved.snapshotVersion!==current.pointer.version)throw new DomainError('STALE_REQUIREMENTS','Reviewed requirements changed. Review and save your direction against the active version.',409);
 const comparison=await compareSavedInventory(tx,owner,current.library,{directionId:saved.directionId,deferredCapabilityIds:saved.deferredCapabilityIds});
 if(comparison.requirementSetId!==saved.requirementSetId)throw new DomainError('STALE_REQUIREMENTS','The saved requirement binding is invalid. Review your direction again.',409);
 const profile=await tx.profile.findUniqueOrThrow({where:{userId:owner}});
 return {...comparison,planningRevision:profile.planningRevision,directionLabel:saved.label};
}

/** Caller holds access/user lock. The active pointer and global revision fence
 * bind this server-owned context throughout dispatch and plan activation. */
export async function selectedDirectionPlanning(tx:Tx,owner:string){
 const comparison=await selectedDirectionComparison(tx,owner);
 if(!comparison)return null;
 if(comparison.reconfirmationIds.length)throw new DomainError('SKILL_REVIEW_REQUIRED','Confirm changed skill meanings in My skills before planning.',409);
 const selected=await tx.reviewedDirection.findUniqueOrThrow({where:{userId:owner}});
 const current=await active(tx);
 const profile=await tx.profile.findUniqueOrThrow({where:{userId:owner}});
 const topicIds=[...comparison.mandatoryGapIds,...comparison.optionalGapIds];
 const resources=currentReviewedResources(selected.resourcePreviews,{requirementSetId:comparison.requirementSetId,libraryVersion:comparison.libraryVersion,directionId:comparison.directionId,inputRevision:profile.planningRevision},topicIds);
 const context=reviewedPlanContext({library:current!.library,selection:{directionId:selected.directionId,deferredCapabilityIds:selected.deferredCapabilityIds},inventory:comparison.requirements.filter(item=>item.evidence==='confirmed_self_report').map(item=>({canonicalSkillId:item.id,label:item.label,meaningVersion:item.meaningVersion})),hoursPerWeek:profile.hoursPerWeek,resources:resources.map(pair=>({topicId:pair.topicId,documentationId:pair.resources[0].id,supportingId:pair.resources[1].id}))});
 return {context,resources,directionLabel:selected.label};
}

export async function reviewedDirectionOptions(client:PrismaClient,claims:Claims){
 return client.$transaction(async tx=>{
  await access(tx,claims,true);const current=await active(tx);
  const saved=await tx.reviewedDirection.findUnique({where:{userId:claims.id}});
  if(!current)return {available:false as const,stale:!!saved};
  const options=current.library.directionRules.map(rule=>{
   const compiled=compileDirectionRequirements(current.library,{directionId:rule.id,deferredCapabilityIds:[]});
   return {id:rule.id,label:rule.label,requirements:compiled.capabilities.map(item=>({id:item.id,label:item.label,mandatory:item.mandatory,priority:item.priority})),
    optionalRoots:rule.requirements.filter(item=>item.priority==='nice'&&!compiled.capabilities.find(node=>node.id===item.capabilityId)!.mandatory).map(item=>({id:item.capabilityId,label:current.library.capabilities.find(node=>node.id===item.capabilityId)!.label}))};
  });
  const stale=!!saved&&saved.snapshotVersion!==current.pointer.version;
  return {available:true as const,version:current.pointer.version,options,stale,comparison:saved&&!stale?await selectedDirectionComparison(tx,claims.id):null};
 });
}

export async function saveReviewedDirection(client:PrismaClient,claims:Claims,input:unknown){
 const body=selectionSchema.parse(input);
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
  assertRevision(profile.planningRevision,body.expectedPlanningRevision);
  const saved=await tx.reviewedDirection.findUnique({where:{userId:claims.id}});
  if(body.directionId===null){
   if(body.deferredCapabilityIds.length)throw new DomainError('INVALID_DEFERRAL','Clearing a direction cannot retain deferrals.',409);
   if(saved){await tx.reviewedDirection.delete({where:{userId:claims.id}});await tx.profile.update({where:{userId:claims.id},data:{planningRevision:{increment:1}}});}
   return;
  }
  if(!profile.confirmed||!profile.inventoryConfirmed)throw new DomainError('ONBOARDING_REQUIRED','Save your profile and confirm your skills first.');
  const current=await active(tx);
  if(!current||current.pointer.version!==body.version)throw new DomainError('STALE_REQUIREMENTS','Review the active requirement version before selecting a direction.',409);
  const compiled=compileDirectionRequirements(current.library,{directionId:body.directionId,deferredCapabilityIds:body.deferredCapabilityIds});
  if(saved?.requirementSetId===compiled.requirementSetId)return;
  const data={snapshotVersion:body.version,directionId:body.directionId,label:current.library.directionRules.find(rule=>rule.id===body.directionId)!.label,deferredCapabilityIds:compiled.deferredRootIds,requirementSetId:compiled.requirementSetId,resourcePreviews:[]};
  await tx.reviewedDirection.upsert({where:{userId:claims.id},create:{userId:claims.id,...data},update:data});
  // There is one learner target. A reviewed selection replaces any provisional interest.
  await tx.pathwayExploration.updateMany({where:{userId:claims.id},data:{selectedSuggestionId:null,resourcePreviews:[]}});
  await tx.profile.update({where:{userId:claims.id},data:{planningRevision:{increment:1}}});
 });
 return getState(client,claims);
}

export async function getReviewedGaps(client:PrismaClient,claims:Claims){
 return client.$transaction(async tx=>{await access(tx,claims,true);return selectedDirectionComparison(tx,claims.id);});
}
