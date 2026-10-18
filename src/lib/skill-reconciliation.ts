import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client';
import { access, type Claims, type Tx } from './store';
import { assertRevision, DomainError, normalizeLabel } from './domain';
import { fingerprint } from './candidate-origin';
import { activeRequirementSnapshot, loadRequirementSnapshot } from './requirement-snapshots';
import { compareDirectionRequirements, requirementContentDigest, type RequirementLibrary } from './requirements';

const versionSchema=z.string().trim().min(1).max(100);
const confirmationSchema=z.object({version:versionSchema,expectedRevision:z.number().int().nonnegative(),reviewToken:z.string().max(3000),
 confirmations:z.array(z.object({skillKey:z.string().min(1).max(120),capabilityId:z.string().min(1).max(80)}).strict()).max(100)
 .refine(items=>new Set(items.map(item=>item.skillKey)).size===items.length,'Confirm each source skill at most once.')}).strict();
const tokenSchema=z.object({purpose:z.literal('skill-meaning-review-v1'),owner:z.string(),session:z.number().int(),revision:z.number().int(),version:versionSchema,digest:z.string(),binding:z.string(),expires:z.number().int()}).strict();

async function skills(tx:Tx,owner:string){return tx.confirmedSkill.findMany({where:{userId:owner},orderBy:{key:'asc'},include:{capabilityConfirmation:true}});}
type Rows=Awaited<ReturnType<typeof skills>>;
function candidates(library:RequirementLibrary,rows:Rows){
 return rows.map(row=>({skillKey:row.key,label:row.label,source:row.source,
  candidates:library.capabilities.filter(capability=>capability.id===row.canonicalSkillId||[capability.label,...capability.aliases].some(label=>normalizeLabel(label)===normalizeLabel(row.label)))
   .map(capability=>({capabilityId:capability.id,label:capability.label,meaning:capability.meaning,meaningVersion:capability.meaningVersion,
    requiresConfirmation:row.capabilityConfirmation?.capabilityId!==capability.id||row.capabilityConfirmation?.meaningVersion!==capability.meaningVersion})),
 }));
}
function binding(rows:Rows){return fingerprint(JSON.stringify(rows.map(row=>({id:row.id,key:row.key,canonicalSkillId:row.canonicalSkillId,label:row.label,source:row.source,confirmation:row.capabilityConfirmation}))));}
function sign(data:z.infer<typeof tokenSchema>){const payload=Buffer.from(JSON.stringify(data)).toString('base64url');return `${payload}.${fingerprint(payload)}`;}
function verify(token:string,expected:Omit<z.infer<typeof tokenSchema>,'expires'>,time:number){
 try{
  const [payload,signature,...extra]=token.split('.');if(extra.length||!signature)return false;
  const actual=Buffer.from(signature);const wanted=Buffer.from(fingerprint(payload));
  if(actual.length!==wanted.length||!timingSafeEqual(actual,wanted))return false;
  const parsed=tokenSchema.parse(JSON.parse(Buffer.from(payload,'base64url').toString('utf8')));
  return parsed.expires>time&&parsed.expires<=time+15*60*1000&&Object.entries(expected).every(([key,value])=>parsed[key as keyof typeof parsed]===value);
 }catch{return false;}
}
async function context(tx:Tx,claims:Claims,version:string){
 // The operator's activation switch must wait for this review transaction.
 await tx.$queryRaw`SELECT id FROM "RequirementActivation" WHERE id='active' FOR SHARE`;
 const active=await activeRequirementSnapshot(tx);
 if(!active||active.pointer.version!==version)throw new DomainError('CONTENT_REVIEW_REQUIRED','This reviewed requirement version is not active. Refresh before reviewing skills.',409);
 const library=await loadRequirementSnapshot(tx,version);const rows=await skills(tx,claims.id);
 const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
 const [{now}]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;
 const expected={purpose:'skill-meaning-review-v1' as const,owner:claims.id,session:claims.sessionVersion,revision:profile.planningRevision,version:library.version,digest:requirementContentDigest(library),binding:binding(rows)};
 return {library,rows,profile,time:now.getTime(),expected};
}

export async function currentSkillReviewAvailability(client:PrismaClient,claims:Claims){
 return client.$transaction(async tx=>{
  await access(tx,claims);
  const active=await activeRequirementSnapshot(tx);
  if(!active)return {available:false as const};
  return {available:true as const,version:active.pointer.version,revision:active.pointer.revision,
   reviewedOn:active.library.review!.reviewedOn};
 },{isolationLevel:'RepeatableRead'});
}

/** Private learner preview; evidence and review tokens are transient. */
export async function previewSkillReconciliation(client:PrismaClient,claims:Claims,versionInput:unknown){
 const version=versionSchema.parse(versionInput);
 return client.$transaction(async tx=>{
  await access(tx,claims,true);const current=await context(tx,claims,version);
  return {version,expectedRevision:current.profile.planningRevision,entries:candidates(current.library,current.rows),
   reviewToken:sign({...current.expected,expires:current.time+15*60*1000})};
 });
}
export async function confirmSkillReconciliation(client:PrismaClient,claims:Claims,input:unknown){
 const body=confirmationSchema.parse(input);
 return client.$transaction(async tx=>{
  await access(tx,claims,true);const current=await context(tx,claims,body.version);
  assertRevision(current.profile.planningRevision,body.expectedRevision);
  if(!verify(body.reviewToken,current.expected,current.time))throw new DomainError('REVIEW_EXPIRED','Refresh and review the current skill mappings before confirming.',409);
  const offered=candidates(current.library,current.rows);
  // Validate the entire batch before any write. Omitted mappings stay intact;
  // removing an original skill remains an explicit inventory action.
  const changes=body.confirmations.map(choice=>{
   const row=current.rows.find(item=>item.key===choice.skillKey);
   const candidate=offered.find(item=>item.skillKey===choice.skillKey)?.candidates.find(item=>item.capabilityId===choice.capabilityId);
   if(!row||!candidate)throw new DomainError('INVALID_MAPPING','Only an offered mapping for your saved skill can be confirmed.',409);
   return {row,candidate};
  }).filter(({candidate})=>candidate.requiresConfirmation);
  for(const {row,candidate} of changes)await tx.capabilityConfirmation.upsert({where:{skillId:row.id},create:{skillId:row.id,snapshotVersion:body.version,capabilityId:candidate.capabilityId,meaningVersion:candidate.meaningVersion},update:{snapshotVersion:body.version,capabilityId:candidate.capabilityId,meaningVersion:candidate.meaningVersion,confirmedAt:new Date(current.time)}});
  if(changes.length)await tx.profile.update({where:{userId:claims.id},data:{planningRevision:{increment:1}}});
  return {planningRevision:current.profile.planningRevision+(changes.length?1:0),confirmedCount:changes.length};
 });
}

export async function compareReconciledSkills(client:PrismaClient,claims:Claims,versionInput:unknown,selection:unknown){
 const version=versionSchema.parse(versionInput);
 return client.$transaction(async tx=>{
  await access(tx,claims,true);const current=await context(tx,claims,version);
  return {...compareMappedInventory(current.library,current.rows,selection),planningRevision:current.profile.planningRevision,savedSkills:current.rows.map(row=>({key:row.key,label:row.label,canonicalSkillId:row.canonicalSkillId,source:row.source}))};
 },{isolationLevel:'RepeatableRead'});
}

export async function compareSavedInventory(tx:Tx,owner:string,library:RequirementLibrary,selection:unknown){
 return compareMappedInventory(library,await skills(tx,owner),selection);
}
function compareMappedInventory(library:RequirementLibrary,rows:Rows,selection:unknown){
  const inventory=rows.map(row=>({canonicalSkillId:row.capabilityConfirmation?.capabilityId??row.canonicalSkillId,label:row.label,meaningVersion:row.capabilityConfirmation?.meaningVersion??null}));
  // Multiple saved source skills can support the same capability; preserve the
  // sources while counting it once, preferring a current confirmed meaning.
  const canonical=new Map<string,typeof inventory[number]>();
  for(const item of inventory){if(!item.canonicalSkillId)continue;const existing=canonical.get(item.canonicalSkillId);const meaning=library.capabilities.find(capability=>capability.id===item.canonicalSkillId)?.meaningVersion;
   if(!existing||(item.meaningVersion===meaning&&existing.meaningVersion!==meaning))canonical.set(item.canonicalSkillId,item);
  }
  return compareDirectionRequirements(library,selection,[...canonical.values(),...inventory.filter(item=>!item.canonicalSkillId)]);
}
