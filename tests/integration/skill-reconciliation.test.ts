import { syntheticPlanningDetails } from '../fixtures/requirement-details';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, endSession, putProfile, putSkills, type Claims } from '../../src/lib/store';
import { activateRequirementSnapshot, loadRequirementSnapshot, registerRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { compareReconciledSkills, confirmSkillReconciliation, currentSkillReviewAvailability, previewSkillReconciliation } from '../../src/lib/skill-reconciliation';
import { catalogue } from '../../src/lib/catalogue';
import { requirementContentDigest, type RequirementLibrary } from '../../src/lib/requirements';
import { requirementDraft } from '../../src/lib/requirement-draft';
import { fingerprint } from '../../src/lib/candidate-origin';

const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('BLOCKED: use the isolated local qa_pathways_* TEST_DATABASE_URL.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const chosen={directionId:'delivery',deferredCapabilityIds:[]};
const today=new Date().toISOString().slice(0,10);
function fixture():RequirementLibrary{
 const node=(id:string,label:string,prerequisites:string[],aliases:string[]=[])=>({id,label,meaningVersion:'synthetic-reconciliation-v2',meaning:`Synthetic review-only scope: ${id}`,aliases,level:'foundation' as const,priority:'important' as const,prerequisites,sourceIds:['synthetic'],minutes:120,activity:'Synthetic task',outcome:'Synthetic observable outcome',...syntheticPlanningDetails(id,prerequisites)});
 const library:RequirementLibrary={version:`synthetic-registration-${crypto.randomUUID()}`,audience:'experienced-qa',createdOn:today,sources:[{id:'synthetic',title:'Synthetic source only',url:'https://example.org/fixture',checkedOn:today}],capabilities:[node('test-design','Test design',[]),node('automation','Test automation',['test-design'],['Browser suite maintenance']),node('ci','Continuous integration',['automation'])],directionRules:[{id:'delivery',label:'Synthetic delivery',requirements:[{capabilityId:'ci',priority:'important'}]}],review:null};
 library.review={reviewer:'Synthetic fixture, not professional approval',reviewedOn:today,contentDigest:requirementContentDigest(library)};return library;
}
const evidence='synthetic-test-evidence-only';
let claims:Claims;let library:RequirementLibrary;let planId:string;const emails:string[]=[];
async function learner(){const email=`reconcile-${crypto.randomUUID()}@example.invalid`;emails.push(email);await first.invitation.create({data:{email}});const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Reconciliation');return {id:user.id,email,sessionVersion:0};}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-reconciliation-signing-secret-only');
 await first.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
 library=fixture();await registerRequirementSnapshot(first,library,evidence);await activateRequirementSnapshot(first,library.version);claims=await learner();
 await putProfile(first,claims,{currentRole:'QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,claims,{expectedRevision:1,removals:[],entries:[{canonicalSkillId:'test-design',label:'Test design'},{canonicalSkillId:'automation',label:'Test automation'},...['SQL','Browser suite maintenance','C','C++','C#'].map(label=>({canonicalSkillId:null,label}))]});
 await first.confirmedSkill.updateMany({where:{userId:claims.id,canonicalSkillId:'automation'},data:{source:'cv'}});
 const plan=await first.roadmap.create({data:{userId:claims.id,inputRevision:2,catalogueVersion:'synthetic-existing-plan',planningSnapshot:{fixture:true},tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:'Synthetic saved task',activity:'Synthetic fixture',completionCriterion:'Synthetic fixture',kind:'practical',skillIds:['automation'],resourceIds:[],estimatedMinutes:30,completed:week===1}))}}});planId=plan.id;
});
afterEach(async()=>{await first.user.deleteMany({where:{email:{in:emails}}});await first.invitation.deleteMany({where:{email:{in:emails}}});vi.unstubAllEnvs();});
afterAll(async()=>{await first.requirementActivation.deleteMany({where:{id:'active'}});await first.$disconnect();await second.$disconnect();});
const choices=[{skillKey:'id:test-design',capabilityId:'test-design'},{skillKey:'id:automation',capabilityId:'automation'}];
async function request(confirmations=choices){const preview=await previewSkillReconciliation(first,claims,library.version);return {version:preview.version,expectedRevision:preview.expectedRevision,reviewToken:preview.reviewToken,confirmations};}
async function plan(){return first.roadmap.findUniqueOrThrow({where:{id:planId},include:{tasks:{orderBy:{position:'asc'}}}});}

describe('R05/R06/R12: immutable snapshot and mapping services, real isolated PostgreSQL, no AI',()=>{
 it('SR-17: new publication rejects incomplete details; historical snapshots remain readable but cannot reactivate',async()=>{
  const incomplete=fixture();delete incomplete.capabilities[0].effort;incomplete.review!.contentDigest=requirementContentDigest(incomplete);
  await expect(registerRequirementSnapshot(first,incomplete,evidence)).rejects.toMatchObject({code:'CONTENT_DETAIL_REQUIRED'});
  await first.requirementSnapshot.create({data:{version:incomplete.version,contentDigest:requirementContentDigest(incomplete),content:JSON.parse(JSON.stringify(incomplete)),reviewEvidenceReference:'synthetic-legacy-fixture'}});
  expect((await first.$transaction(tx=>loadRequirementSnapshot(tx,incomplete.version))).version).toBe(incomplete.version);
  await expect(activateRequirementSnapshot(first,incomplete.version)).rejects.toMatchObject({code:'CONTENT_DETAIL_REQUIRED'});
  expect((await first.requirementActivation.findUniqueOrThrow({where:{id:'active'}})).version).toBe(library.version);
  // Simulate an active pointer left by a pre-contract deployment. Historical
  // reading remains possible, but current learner comparison must fail closed.
  await first.requirementActivation.update({where:{id:'active'},data:{version:incomplete.version}});
  try{await expect(currentSkillReviewAvailability(first,claims)).rejects.toMatchObject({code:'CONTENT_DETAIL_REQUIRED'});}
  finally{await activateRequirementSnapshot(first,library.version);}
 });
 it('SR-18: changed inclusion boundaries require a new meaning version, even with a new review digest',async()=>{
  const next=fixture();next.capabilities[0].scope!.includes=['Synthetic expanded scope'];next.review!.contentDigest=requirementContentDigest(next);
  await expect(registerRequirementSnapshot(first,next,evidence)).rejects.toMatchObject({code:'MEANING_VERSION_CONFLICT'});
  next.capabilities[0].meaningVersion=`synthetic-boundary-${crypto.randomUUID()}`;next.review!.contentDigest=requirementContentDigest(next);
  expect((await registerRequirementSnapshot(first,next,evidence)).version).toBe(next.version);
 });
 it('SR-01: preview offers reviewed aliases without silently mapping or changing CV provenance',async()=>{
  const before=await first.confirmedSkill.findMany({where:{userId:claims.id}});const preview=await previewSkillReconciliation(first,claims,library.version);
  expect(preview.entries.find(entry=>entry.label==='Browser suite maintenance')!.candidates).toMatchObject([{capabilityId:'automation',requiresConfirmation:true}]);
  expect(preview.entries.find(entry=>entry.skillKey==='id:automation')!.source).toBe('cv');
  expect(preview.entries.filter(entry=>['SQL','C','C++','C#'].includes(entry.label)).every(entry=>!entry.candidates.length)).toBe(true);
  expect(await first.confirmedSkill.findMany({where:{userId:claims.id}})).toEqual(before);expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(0);
 });
 it('SR-02: explicit confirmation persists across instances; no-op saves preserve revision and old progress',async()=>{
  const oldPlan=await plan();const original=await first.confirmedSkill.findMany({where:{userId:claims.id},orderBy:{key:'asc'}});
  expect(await confirmSkillReconciliation(first,claims,await request())).toEqual({planningRevision:3,confirmedCount:2});
  const compared=await compareReconciledSkills(second,claims,library.version,chosen);
  expect(compared.strengthIds).toEqual(['test-design','automation']);expect(compared.mandatoryGapIds).toEqual(['ci']);expect(compared.savedSkills).toHaveLength(7);
  expect(await confirmSkillReconciliation(second,claims,await request())).toEqual({planningRevision:3,confirmedCount:0});
  expect(await first.confirmedSkill.findMany({where:{userId:claims.id},orderBy:{key:'asc'}})).toEqual(original);expect(await plan()).toEqual(oldPlan);
 });
 it('SR-03: forged, expired and cross-user review tokens fail without confirmations',async()=>{
  const body=await request();await expect(confirmSkillReconciliation(first,claims,{...body,reviewToken:body.reviewToken+'x'})).rejects.toMatchObject({code:'REVIEW_EXPIRED'});
  const data=JSON.parse(Buffer.from(body.reviewToken.split('.')[0],'base64url').toString());data.expires=1;const payload=Buffer.from(JSON.stringify(data)).toString('base64url');
  await expect(confirmSkillReconciliation(first,claims,{...body,reviewToken:`${payload}.${fingerprint(payload)}`})).rejects.toMatchObject({code:'REVIEW_EXPIRED'});
  const other=await learner();await expect(confirmSkillReconciliation(first,other,{...body,expectedRevision:0})).rejects.toMatchObject({code:'REVIEW_EXPIRED'});
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(0);
 });
 it('SR-04: profile change and cross-version token reuse reject stale confirmation',async()=>{
  const body=await request();await putProfile(first,claims,{currentRole:'QA',yearsExperience:7,hoursPerWeek:6,expectedRevision:2});
  await expect(confirmSkillReconciliation(first,claims,body)).rejects.toMatchObject({code:'STALE_INPUT'});
  const newer=fixture();await registerRequirementSnapshot(first,newer,evidence);
  await expect(confirmSkillReconciliation(first,claims,{...body,version:newer.version,expectedRevision:3})).rejects.toMatchObject({code:'CONTENT_REVIEW_REQUIRED'});
  await activateRequirementSnapshot(first,newer.version);
  await expect(confirmSkillReconciliation(first,claims,{...body,version:newer.version,expectedRevision:3})).rejects.toMatchObject({code:'REVIEW_EXPIRED'});
 });
 it('SR-05: unknown mapping in a batch rejects the whole save and preserves the plan',async()=>{
  const old=await plan();await expect(confirmSkillReconciliation(first,claims,await request([...choices,{skillKey:'label:sql',capabilityId:'ci'}]))).rejects.toMatchObject({code:'INVALID_MAPPING'});
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(0);expect((await first.profile.findUniqueOrThrow({where:{userId:claims.id}})).planningRevision).toBe(2);expect(await plan()).toEqual(old);
 });
 it('SR-06: concurrent confirmations across two clients commit once and reject the stale write',async()=>{
  const body=await request();const outcomes=await Promise.allSettled([confirmSkillReconciliation(first,claims,body),confirmSkillReconciliation(second,claims,body)]);
  expect(outcomes.filter(item=>item.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(item=>item.status==='rejected')).toHaveLength(1);
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(2);expect((await first.profile.findUniqueOrThrow({where:{userId:claims.id}})).planningRevision).toBe(3);
 });
 it('SR-07: adding inventory preserves confirmations and IDs; explicit removal cleans only that mapping',async()=>{
  await confirmSkillReconciliation(first,claims,await request());const saved=await first.confirmedSkill.findMany({where:{userId:claims.id},orderBy:{key:'asc'}});
  const entries=saved.map(row=>({canonicalSkillId:row.canonicalSkillId,label:row.label}));
  await putSkills(first,claims,{entries:[...entries,{canonicalSkillId:null,label:'Git'}],removals:[],expectedRevision:3});
  expect(await first.confirmedSkill.findMany({where:{id:{in:saved.map(row=>row.id)}},orderBy:{key:'asc'}})).toEqual(saved);
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(2);
  await expect(putSkills(first,claims,{entries:[...entries.filter(entry=>entry.canonicalSkillId!=='automation'),{canonicalSkillId:null,label:'Git'}],removals:[],expectedRevision:4})).rejects.toMatchObject({code:'EXPLICIT_REMOVAL_REQUIRED'});
  await putSkills(first,claims,{entries:[...entries.filter(entry=>entry.canonicalSkillId!=='automation'),{canonicalSkillId:null,label:'Git'}],removals:['id:automation'],expectedRevision:4});
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(1);
 });
 it('SR-08: changed meaning is a separate review need until explicitly reconfirmed',async()=>{
  await confirmSkillReconciliation(first,claims,await request());const next=structuredClone(library);next.version=`synthetic-registration-${crypto.randomUUID()}`;next.capabilities[1].meaningVersion=`meaning-${crypto.randomUUID()}`;next.capabilities[1].meaning='Synthetic expanded automation scope';next.review!.contentDigest=requirementContentDigest(next);await registerRequirementSnapshot(first,next,evidence);
  await activateRequirementSnapshot(first,next.version);
  const comparison=await compareReconciledSkills(first,claims,next.version,chosen);expect(comparison.outcome).toBe('review_required');expect(comparison.reconfirmationIds).toEqual(['automation']);expect(comparison.mandatoryGapIds).toEqual(['ci']);
  library=next;await confirmSkillReconciliation(first,claims,await request());expect((await compareReconciledSkills(second,claims,next.version,chosen)).strengthIds).toEqual(['test-design','automation']);
 });
 it('SR-09: logout, revoked invitation and deletion prevent late writes and account recreation',async()=>{
  const body=await request();await endSession(first,claims);await expect(confirmSkillReconciliation(first,claims,body)).rejects.toMatchObject({code:'ACCESS_ENDED'});
  claims={...claims,sessionVersion:1};const fresh=await request();await first.invitation.update({where:{email:claims.email},data:{active:false}});await expect(confirmSkillReconciliation(first,claims,fresh)).rejects.toMatchObject({code:'ACCESS_ENDED'});
  await first.invitation.update({where:{email:claims.email},data:{active:true}});await deleteAccount(first,claims);await expect(confirmSkillReconciliation(first,claims,fresh)).rejects.toMatchObject({code:'ACCESS_ENDED'});expect(await first.user.findUnique({where:{id:claims.id}})).toBeNull();
 });
 it('SR-10: registered snapshots reject SQL updates/deletion; changing the source object cannot mutate stored content',async()=>{
  const before=await first.requirementSnapshot.findUniqueOrThrow({where:{version:library.version}});library.capabilities[0].minutes++;
  await expect(first.requirementSnapshot.update({where:{version:library.version},data:{contentDigest:'a'.repeat(64)}})).rejects.toThrow(/immutable/);
  await expect(first.requirementSnapshot.delete({where:{version:library.version}})).rejects.toThrow(/immutable/);
  expect(await first.requirementSnapshot.findUniqueOrThrow({where:{version:library.version}})).toEqual(before);
 });
 it('SR-11: same registration replays; competing changed-content registration cannot overwrite a version',async()=>{
  expect((await registerRequirementSnapshot(second,library,evidence)).version).toBe(library.version);
  const changed=structuredClone(library);changed.capabilities[0].minutes++;changed.capabilities[0].effort!.practiceMinutes++;changed.review!.contentDigest=requirementContentDigest(changed);
  const results=await Promise.allSettled([registerRequirementSnapshot(first,library,evidence),registerRequirementSnapshot(second,changed,evidence)]);
  expect(results[0].status).toBe('fulfilled');expect(results[1].status).toBe('rejected');expect((await first.requirementSnapshot.findUniqueOrThrow({where:{version:library.version}})).contentDigest).toBe(requirementContentDigest(library));
 });
 it('SR-12: unreviewed content and reused meaning version with changed scope cannot register',async()=>{
    // v5 is now professionally reviewed.
// Explicitly remove approval in this negative test fixture.
const unreviewed = structuredClone(requirementDraft);
unreviewed.review = null;

await expect(
  registerRequirementSnapshot(first, unreviewed, evidence),
).rejects.toMatchObject({
  code: 'CONTENT_REVIEW_REQUIRED',
});
    const changed=structuredClone(library);changed.version=`synthetic-registration-${crypto.randomUUID()}`;changed.capabilities[0].meaning='Changed scope without version';changed.review!.contentDigest=requirementContentDigest(changed);
  await expect(registerRequirementSnapshot(first,changed,evidence)).rejects.toMatchObject({code:'MEANING_VERSION_CONFLICT'});expect(await first.requirementSnapshot.findUnique({where:{version:changed.version}})).toBeNull();
 });
 it('SR-13: two original skills mapped to one capability count once and preserve both labels',async()=>{
  await confirmSkillReconciliation(first,claims,await request([...choices,{skillKey:'label:browser suite maintenance',capabilityId:'automation'}]));
  const comparison=await compareReconciledSkills(second,claims,library.version,chosen);expect(comparison.strengthIds).toEqual(['test-design','automation']);expect(comparison.savedSkills.map(item=>item.label)).toContain('Browser suite maintenance');expect(comparison.savedSkills.map(item=>item.label)).toContain('Test automation');
 });
 it('SR-14: real database failure during a batch rolls back earlier mapping writes and revision',async()=>{
  const old=await plan();const body=await request();
  // Controlled fault in the explicitly isolated test DB; no component mocked.
  await first.$executeRaw`ALTER TABLE "CapabilityConfirmation" ADD CONSTRAINT synthetic_reconciliation_failure CHECK ("capabilityId" <> 'automation') NOT VALID`;
  try{
   await expect(confirmSkillReconciliation(first,claims,body)).rejects.toThrow();
   expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(0);
   expect((await first.profile.findUniqueOrThrow({where:{userId:claims.id}})).planningRevision).toBe(2);expect(await plan()).toEqual(old);
  }finally{await first.$executeRaw`ALTER TABLE "CapabilityConfirmation" DROP CONSTRAINT synthetic_reconciliation_failure`;}
  expect(await confirmSkillReconciliation(first,claims,body)).toEqual({planningRevision:3,confirmedCount:2});
 });
 it('SR-15: unchanged meanings carry to a new snapshot without erasing their original confirmation provenance',async()=>{
  await confirmSkillReconciliation(first,claims,await request());const next=fixture();await registerRequirementSnapshot(first,next,evidence);await activateRequirementSnapshot(first,next.version);
  const comparison=await compareReconciledSkills(second,claims,next.version,chosen);expect(comparison.strengthIds).toEqual(['test-design','automation']);expect(comparison.reconfirmationIds).toEqual([]);
  const original=await first.capabilityConfirmation.findMany({where:{skill:{userId:claims.id}}});expect(original.every(item=>item.snapshotVersion===library.version)).toBe(true);
 });
 it('SR-16: only the active registered version appears; switching it invalidates an old review token',async()=>{
  const old=await request();const next=fixture();await registerRequirementSnapshot(first,next,evidence);
  const availability=await currentSkillReviewAvailability(second,claims);
  expect(availability).toMatchObject({available:true,version:library.version});expect(availability).not.toHaveProperty('reviewer');
  const previousRevision=(await first.catalogueRevision.findUniqueOrThrow({where:{id:'active'}})).revision;
  await activateRequirementSnapshot(first,next.version);
  expect((await first.catalogueRevision.findUniqueOrThrow({where:{id:'active'}})).revision).toBe(previousRevision+1);
  await activateRequirementSnapshot(second,next.version);
  expect((await first.catalogueRevision.findUniqueOrThrow({where:{id:'active'}})).revision).toBe(previousRevision+1);
  expect((await currentSkillReviewAvailability(second,claims))).toMatchObject({available:true,version:next.version});
  await expect(confirmSkillReconciliation(first,claims,old)).rejects.toMatchObject({code:'CONTENT_REVIEW_REQUIRED'});
  expect(await first.capabilityConfirmation.count({where:{skill:{userId:claims.id}}})).toBe(0);
 });
});
