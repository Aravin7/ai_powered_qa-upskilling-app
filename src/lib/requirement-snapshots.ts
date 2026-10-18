import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { z } from 'zod';
import { DomainError } from './domain';
import { capabilityMeaningIdentity, publicationReadyLibrary, requirementContentDigest, reviewedLibrary } from './requirements';
import { catalogue } from './catalogue';

/** Trusted operator service only; never expose this as a learner mutation.
 * The operator must verify the referenced review evidence separately. Registering
 * an immutable snapshot does not publish/activate a direction or alter plans. */
export async function registerRequirementSnapshot(client:PrismaClient,input:unknown,evidenceReference:unknown){
 const reference=z.string().trim().min(1).max(240).parse(evidenceReference);
 const library=publicationReadyLibrary(input);const digest=requirementContentDigest(library);
 return client.$transaction(async tx=>{
  // Serialize version history checks across app instances.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('qa-requirement-snapshot-registration'))`;
  const history=await tx.requirementSnapshot.findMany({select:{content:true}});
  for(const record of history){const previous=reviewedLibrary(record.content);
   for(const capability of library.capabilities){const old=previous.capabilities.find(item=>item.id===capability.id&&item.meaningVersion===capability.meaningVersion);
    if(old&&capabilityMeaningIdentity(old)!==capabilityMeaningIdentity(capability))throw new DomainError('MEANING_VERSION_CONFLICT','Changed capability meaning, boundaries, starting knowledge or level requires a new meaning version.',409);
   }
  }
  // Unique version and INSERT ON CONFLICT serialize competing registrations;
  // no upsert UPDATE is allowed by the immutable database trigger.
  await tx.requirementSnapshot.createMany({data:[{version:library.version,contentDigest:digest,content:library as unknown as Prisma.InputJsonValue,reviewEvidenceReference:reference}],skipDuplicates:true});
  const stored=await tx.requirementSnapshot.findUniqueOrThrow({where:{version:library.version}});
  const existing=reviewedLibrary(stored.content);
  if(stored.contentDigest!==digest||stored.reviewEvidenceReference!==reference||JSON.stringify(existing.review)!==JSON.stringify(library.review))
   throw new DomainError('VERSION_CONFLICT','This requirement version is already registered with different content or review evidence.',409);
  return {version:stored.version,contentDigest:stored.contentDigest};
 });
}

export async function loadRequirementSnapshot(tx:Prisma.TransactionClient,version:string){
 const stored=await tx.requirementSnapshot.findUnique({where:{version}});
 if(!stored)throw new DomainError('CONTENT_REVIEW_REQUIRED','This requirement snapshot is not registered.',409);
 const library=reviewedLibrary(stored.content);
 if(library.version!==stored.version||requirementContentDigest(library)!==stored.contentDigest)
  throw new DomainError('INVALID_REQUIREMENTS','Requirement snapshot integrity check failed.',409);
 return library;
}

/** Trusted operator only, after independent review-evidence verification.
 * The global revision fence makes in-flight model work stale across instances. */
export async function activateRequirementSnapshot(client:PrismaClient,version:string){
 return client.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "CatalogueRevision" WHERE id='active' FOR UPDATE`;
  const global=await tx.catalogueRevision.findUnique({where:{id:'active'}});
  if(!global||global.version!==catalogue.version)throw new DomainError('STALE_CATALOGUE','The active catalogue must be configured before activating reviewed requirements.',409);
  publicationReadyLibrary(await loadRequirementSnapshot(tx,version));
  const current=await tx.requirementActivation.findUnique({where:{id:'active'}});
  if(current?.version===version)return {version,revision:current.revision};
  const next=await tx.requirementActivation.upsert({where:{id:'active'},create:{id:'active',version},update:{version,revision:{increment:1},activatedAt:new Date()}});
  await tx.catalogueRevision.update({where:{id:'active'},data:{revision:{increment:1}}});
  return {version:next.version,revision:next.revision};
 });
}

export async function activeRequirementSnapshot(tx:Prisma.TransactionClient){
 const pointer=await tx.requirementActivation.findUnique({where:{id:'active'}});
 if(!pointer)return null;
 return {pointer,library:publicationReadyLibrary(await loadRequirementSnapshot(tx,pointer.version))};
}
