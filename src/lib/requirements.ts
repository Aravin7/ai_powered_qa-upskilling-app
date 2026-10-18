import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from './domain';

const id=z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const text=(max:number)=>z.string().trim().min(1).max(max);
const uniqueIds=z.array(id).max(100).refine(items=>new Set(items).size===items.length,'Duplicate IDs.');
const statements=z.array(text(600)).min(1).max(20);
const minutes=z.number().int().nonnegative().max(2400);
export const capabilityScopeSchema=z.object({
 includes:statements,excludes:statements,startingKnowledge:statements,
 prerequisiteRationale:z.array(z.object({capabilityId:id,reason:text(600)}).strict()).max(100),
}).strict();
export const capabilityEffortSchema=z.object({
 readingMinutes:minutes,setupMinutes:minutes,practiceMinutes:minutes.refine(value=>value>0),
 reviewMinutes:minutes,troubleshootingMinutes:minutes,
 troubleshootingLimit:text(600),
 sharedSetup:z.object({id,activity:text(600)}).strict().nullable(),
}).strict();
export const requirementLibrarySchema=z.object({
 version:text(100),audience:z.literal('experienced-qa'),createdOn:z.iso.date(),
 sources:z.array(z.object({id,title:text(240),url:z.url().refine(value=>{
  const page=new URL(value);return page.protocol==='https:'&&!page.username&&!page.password;
 }),checkedOn:z.iso.date()}).strict()).min(1).max(100),
 capabilities:z.array(z.object({
  id,label:text(140),meaningVersion:text(80),meaning:text(600),aliases:z.array(text(100)).max(30),
  level:z.enum(['foundation','intermediate']),priority:z.enum(['critical','important','nice']),
  prerequisites:uniqueIds,sourceIds:uniqueIds.refine(items=>items.length>0,'Requirement sources are required.'),
  minutes:z.number().int().positive().max(2400),activity:text(1000),outcome:text(1000),
  scope:capabilityScopeSchema.optional(),effort:capabilityEffortSchema.optional(),
 }).strict()).min(1).max(100),
 directionRules:z.array(z.object({id,label:text(140),requirements:z.array(z.object({capabilityId:id,priority:z.enum(['critical','important','nice'])}).strict()).min(1).max(100)}).strict()).max(100).default([]),
 review:z.object({reviewer:text(140),reviewedOn:z.iso.date(),contentDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict().nullable(),
}).strict();
export type RequirementLibrary=z.infer<typeof requirementLibrarySchema>;

/** Validates draft structure, not reviewer identity or source truth. No fetching. */
export function validateRequirementLibrary(input:unknown,now=new Date()){
 const library=requirementLibrarySchema.parse(input);const today=now.toISOString().slice(0,10);
 const ids=new Set(library.capabilities.map(item=>item.id));const sources=new Set(library.sources.map(item=>item.id));
 if(ids.size!==library.capabilities.length||sources.size!==library.sources.length)throw new DomainError('INVALID_REQUIREMENTS','Requirement and source IDs must be unique.');
 if(library.createdOn>today||library.sources.some(source=>source.checkedOn>today))throw new DomainError('INVALID_REQUIREMENTS','Requirement/source dates cannot be in the future.');
 for(const item of library.capabilities){
  if(item.prerequisites.some(prerequisite=>!ids.has(prerequisite))||item.sourceIds.some(source=>!sources.has(source)))
   throw new DomainError('INVALID_REQUIREMENTS','Missing prerequisite or source reference.');
  const aliases=item.aliases.map(alias=>alias.toLowerCase());
  if(new Set(aliases).size!==aliases.length)throw new DomainError('INVALID_REQUIREMENTS','Duplicate aliases need correction.');
  if(item.scope){
   const reasons=item.scope.prerequisiteRationale.map(reason=>reason.capabilityId);
   if(new Set(reasons).size!==reasons.length||reasons.length!==item.prerequisites.length||reasons.some(reason=>!item.prerequisites.includes(reason)))throw new DomainError('INVALID_REQUIREMENTS','Each prerequisite needs exactly one scope rationale.');
  }
  if(item.effort){const effort=item.effort;
   if(effort.readingMinutes+effort.setupMinutes+effort.practiceMinutes+effort.reviewMinutes+effort.troubleshootingMinutes!==item.minutes)throw new DomainError('INVALID_REQUIREMENTS','Effort components must equal the declared topic minutes.');
   if((effort.setupMinutes>0)!==!!effort.sharedSetup)throw new DomainError('INVALID_REQUIREMENTS','Nonzero setup requires an explicit shared setup ID and activity.');
  }
 }
 const setups=new Map<string,{minutes:number;activity:string}>();
 for(const item of library.capabilities){const effort=item.effort;if(!effort?.sharedSetup)continue;
  const old=setups.get(effort.sharedSetup.id);if(old&&(old.minutes!==effort.setupMinutes||old.activity!==effort.sharedSetup.activity))throw new DomainError('INVALID_REQUIREMENTS','Shared setup IDs must have identical effort and activity.');
  setups.set(effort.sharedSetup.id,{minutes:effort.setupMinutes,activity:effort.sharedSetup.activity});
 }
 if(new Set(library.directionRules.map(rule=>rule.id)).size!==library.directionRules.length)throw new DomainError('INVALID_REQUIREMENTS','Direction rule IDs must be unique.');
 for(const rule of library.directionRules){
  if(new Set(rule.requirements.map(item=>item.capabilityId)).size!==rule.requirements.length||rule.requirements.some(item=>!ids.has(item.capabilityId)))throw new DomainError('INVALID_REQUIREMENTS','Direction requirements must use unique known capability IDs.');
 }
 const active=new Set<string>();const completed=new Set<string>();
 function visit(capabilityId:string){
  if(active.has(capabilityId))throw new DomainError('INVALID_REQUIREMENTS','Requirement prerequisites contain a cycle.');
  if(completed.has(capabilityId))return;active.add(capabilityId);
  for(const prerequisite of library.capabilities.find(item=>item.id===capabilityId)!.prerequisites)visit(prerequisite);
  active.delete(capabilityId);completed.add(capabilityId);
 }
 for(const item of library.capabilities)visit(item.id);
 return library;
}
export function requirementContentDigest(input:unknown,now=new Date()){
 const library=validateRequirementLibrary(input,now);
 // Set-like ordering and JSON key order cannot silently invalidate the review.
 const canonical={version:library.version,audience:library.audience,createdOn:library.createdOn,
  sources:[...library.sources].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),
  directionRules:library.directionRules.map(rule=>({...rule,requirements:[...rule.requirements].sort((a,b)=>a.capabilityId<b.capabilityId?-1:a.capabilityId>b.capabilityId?1:0)})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),
  capabilities:library.capabilities.map(item=>({...item,aliases:[...item.aliases].sort(),prerequisites:[...item.prerequisites].sort(),sourceIds:[...item.sourceIds].sort()})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
 return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
export function reviewedLibrary(input:unknown,now=new Date()){
 const library=validateRequirementLibrary(input,now);const review=library.review;
 if(!review||review.reviewedOn>now.toISOString().slice(0,10)||review.reviewedOn<library.createdOn||library.sources.some(source=>source.checkedOn>review.reviewedOn)||review.contentDigest!==requirementContentDigest(library,now))
  throw new DomainError('CONTENT_REVIEW_REQUIRED','This exact requirement-library version needs a dated content review. Existing plans are preserved.',409);
 return library;
}

/** Legacy snapshots remain readable. New registration/activation requires the
 * complete reviewed content contract; a digest alone does not establish quality. */
export function publicationReadyLibrary(input:unknown,now=new Date()){
 const library=reviewedLibrary(input,now);
 if(!library.directionRules.length||library.capabilities.some(item=>!item.scope||!item.effort))throw new DomainError('CONTENT_DETAIL_REQUIRED','Reviewed directions, scope boundaries, prerequisite rationale and complete effort assumptions are required before publication.',409);
 return library;
}

export function capabilityMeaningIdentity(item:RequirementLibrary['capabilities'][number]){
 return JSON.stringify({meaning:item.meaning,label:item.label,level:item.level,
  ...(item.scope?{scope:{...item.scope,includes:[...item.scope.includes].sort(),excludes:[...item.scope.excludes].sort(),startingKnowledge:[...item.scope.startingKnowledge].sort(),prerequisiteRationale:[...item.scope.prerequisiteRationale].sort((a,b)=>a.capabilityId.localeCompare(b.capabilityId))}}:{}),
 });
}

/** Explicit workload before scheduling. Shared setup occurs once, even when
 * several retained topics need it. Confirmed topics contribute no learning work. */
export function directionWorkload(input:unknown,selection:unknown,confirmedIds:unknown,now=new Date()){
 const library=publicationReadyLibrary(input,now);const confirmed=new Set(uniqueIds.parse(confirmedIds));
 const compiled=compileDirectionRequirements(library,selection,now);
 if([...confirmed].some(id=>!compiled.capabilities.some(item=>item.id===id)))throw new DomainError('INVALID_INPUT','Confirmed workload IDs must belong to the selected requirements.');
 const setups=new Map<string,{id:string;activity:string;minutes:number;requiredBy:string[]}>();
 const topics=compiled.capabilities.filter(item=>!confirmed.has(item.id)).map(item=>{
  const effort=item.effort!;
  if(effort.sharedSetup){const key=effort.sharedSetup.id;const setup=setups.get(key)??{id:key,activity:effort.sharedSetup.activity,minutes:effort.setupMinutes,requiredBy:[]};setup.requiredBy.push(item.id);setups.set(key,setup);}
  return {id:item.id,minutes:item.minutes-effort.setupMinutes,setupId:effort.sharedSetup?.id??null,effort,activity:item.activity,outcome:item.outcome};
 });
 const sharedSetups=[...setups.values()];return {topics,sharedSetups,totalMinutes:topics.reduce((sum,topic)=>sum+topic.minutes,0)+sharedSetups.reduce((sum,setup)=>sum+setup.minutes,0)};
}

/** Server-only input: never accept the library/review from a learner request.
 * A digest binds reviewed content; it does not authenticate a reviewer. */
/** Legacy synthetic foundation only. Use compileDirectionRequirements for amended selections. */
export function compileSelectedRequirements(input:unknown,selectedIds:unknown,now=new Date()){
 const library=reviewedLibrary(input,now);const selected=uniqueIds.refine(items=>items.length>0).parse(selectedIds);
 const included=new Set<string>();const ordered:RequirementLibrary['capabilities']=[];
 function include(capabilityId:string){
  if(included.has(capabilityId))return;
  const item=library.capabilities.find(capability=>capability.id===capabilityId);
  if(!item)throw new DomainError('UNKNOWN_CAPABILITY','Selected direction contains an unsupported capability.');
  for(const prerequisite of [...item.prerequisites].sort())include(prerequisite);
  included.add(capabilityId);ordered.push(item);
 }
 for(const selectedId of [...selected].sort())include(selectedId);
 const mandatory=new Set<string>();
 function require(capabilityId:string){if(mandatory.has(capabilityId))return;mandatory.add(capabilityId);for(const prerequisite of ordered.find(item=>item.id===capabilityId)!.prerequisites)require(prerequisite);}
 for(const item of ordered)if(item.priority!=='nice')require(item.id);
 const contentDigest=requirementContentDigest(library,now);
 const requirementSetId=`requirements-${createHash('sha256').update(JSON.stringify({contentDigest,selected:[...selected].sort()})).digest('hex')}`;
 return {requirementSetId,libraryVersion:library.version,contentDigest,capabilities:ordered.map(item=>({...item,mandatory:mandatory.has(item.id)}))};
}

export const directionSelectionSchema=z.object({directionId:id,deferredCapabilityIds:uniqueIds}).strict();

/** Trusted server-owned library only; learners select IDs, never rule content or priorities. */
export function compileDirectionRequirements(input:unknown,selectionInput:unknown,now=new Date()){
 const library=reviewedLibrary(input,now);const selection=directionSelectionSchema.parse(selectionInput);
 const rule=library.directionRules.find(item=>item.id===selection.directionId);
 if(!rule)throw new DomainError('UNKNOWN_DIRECTION','Selected direction has no reviewed requirement rule.',409);
 const nodes=new Map(library.capabilities.map(item=>[item.id,item]));
 const closure=(roots:string[])=>{
  const included=new Set<string>();const ordered:string[]=[];
  const visit=(nodeId:string)=>{if(included.has(nodeId))return;for(const prerequisite of [...nodes.get(nodeId)!.prerequisites].sort())visit(prerequisite);included.add(nodeId);ordered.push(nodeId);};
  for(const root of [...roots].sort())visit(root);return {included,ordered};
 };
 const mandatory=closure(rule.requirements.filter(item=>item.priority!=='nice').map(item=>item.capabilityId)).included;
 const deferred=new Set(selection.deferredCapabilityIds);
 for(const nodeId of deferred){
  if(!rule.requirements.some(item=>item.capabilityId===nodeId&&item.priority==='nice')||mandatory.has(nodeId))throw new DomainError('INVALID_DEFERRAL','Only optional requirements outside mandatory prerequisite closure can be deferred.',409);
 }
 const retained=closure(rule.requirements.filter(item=>!deferred.has(item.capabilityId)).map(item=>item.capabilityId));
 if([...deferred].some(nodeId=>retained.included.has(nodeId)))throw new DomainError('INVALID_DEFERRAL','A deferred topic is still required by retained work.',409);
 const all=closure(rule.requirements.map(item=>item.capabilityId));
 const contentDigest=requirementContentDigest(library,now);
 const requirementSetId=`requirements-${createHash('sha256').update(JSON.stringify({contentDigest,directionId:rule.id,deferred:[...deferred].sort()})).digest('hex')}`;
 return {requirementSetId,libraryVersion:library.version,contentDigest,directionId:rule.id,deferredRootIds:[...deferred].sort(),
  deferredCapabilityIds:all.ordered.filter(nodeId=>!retained.included.has(nodeId)),
  capabilities:retained.ordered.map(nodeId=>{
   const capability=nodes.get(nodeId)!;const explicit=rule.requirements.find(item=>item.capabilityId===nodeId);
   // Override legacy global priority; only the reviewed direction and closure apply.
   return {...capability,priority:mandatory.has(nodeId)?explicit?.priority==='critical'?'critical' as const:'important' as const:'nice' as const,mandatory:mandatory.has(nodeId)};
  })};
}

const inventorySchema=z.array(z.object({canonicalSkillId:id.nullable(),label:text(140),meaningVersion:text(80).nullable()}).strict()).max(100)
 .superRefine((entries,context)=>{
  const ids=entries.flatMap(entry=>entry.canonicalSkillId?[entry.canonicalSkillId]:[]);
  if(new Set(ids).size!==ids.length)context.addIssue({code:'custom',message:'Canonical inventory IDs must be unique.'});
 });
export function compareSelectedRequirements(library:unknown,selectedIds:unknown,confirmedInventory:unknown,now=new Date()){
 return compareCompiled(compileSelectedRequirements(library,selectedIds,now),confirmedInventory);
}
export function compareDirectionRequirements(library:unknown,selection:unknown,confirmedInventory:unknown,now=new Date()){
 const compiled=compileDirectionRequirements(library,selection,now);
 const result=compareCompiled(compiled,confirmedInventory);
 return {...result,outcome:result.reconfirmationIds.length?'review_required' as const:result.outcome,
  mandatoryGapIds:result.requirements.filter(item=>item.mandatory&&item.evidence==='not_established').map(item=>item.id),
  optionalGapIds:result.requirements.filter(item=>!item.mandatory&&item.evidence==='not_established').map(item=>item.id),
  directionId:compiled.directionId,deferredRootIds:compiled.deferredRootIds,deferredCapabilityIds:compiled.deferredCapabilityIds};
}
function compareCompiled(compiled:ReturnType<typeof compileSelectedRequirements>,confirmedInventory:unknown){
 const inventory=inventorySchema.parse(confirmedInventory);
 const requirements=compiled.capabilities.map(item=>{
  const entry=inventory.find(known=>known.canonicalSkillId===item.id);
  return {...item,evidence:entry?.meaningVersion===item.meaningVersion?'confirmed_self_report' as const:entry?'reconfirmation_required' as const:'not_established' as const};
 });
 const gaps=requirements.filter(item=>item.evidence!=='confirmed_self_report');
 return {...compiled,requirements,outcome:gaps.length?'gaps' as const:'no_gaps' as const,
  evidenceStatus:inventory.length?'self_report' as const:'none' as const,
  strengthIds:requirements.filter(item=>item.evidence==='confirmed_self_report').map(item=>item.id),
  mandatoryGapIds:gaps.filter(item=>item.mandatory).map(item=>item.id),optionalGapIds:gaps.filter(item=>!item.mandatory).map(item=>item.id),
  reconfirmationIds:requirements.filter(item=>item.evidence==='reconfirmation_required').map(item=>item.id),
  outsideInventory:inventory.filter(entry=>!requirements.some(item=>item.id===entry.canonicalSkillId))};
}
