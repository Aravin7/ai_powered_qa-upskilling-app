import { syntheticPlanningDetails } from '../fixtures/requirement-details';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, putPathwayPreferences, putProfile, putSkills, type Claims } from '../../src/lib/store';
import { activateRequirementSnapshot, registerRequirementSnapshot } from '../../src/lib/requirement-snapshots';
import { confirmSkillReconciliation, previewSkillReconciliation } from '../../src/lib/skill-reconciliation';
import { getReviewedGaps, reviewedDirectionOptions, saveReviewedDirection } from '../../src/lib/reviewed-direction';
import { generateRoadmap } from '../../src/lib/ai-operations';
import { catalogue } from '../../src/lib/catalogue';
import { requirementContentDigest, type RequirementLibrary } from '../../src/lib/requirements';

const url=process.env.TEST_DATABASE_URL;
if(!url||!/^qa_pathways_/.test(new URL(url).pathname.slice(1))||!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Use only isolated local qa_pathways_* TEST_DATABASE_URL.');
const first=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
const second=new PrismaClient({adapter:new PrismaPg({connectionString:url,max:4})});
let claims:Claims;let library:RequirementLibrary;let planId:string;
const emails:string[]=[];
function fixture():RequirementLibrary{
 const today=new Date().toISOString().slice(0,10);
 const node=(id:string,label:string,prerequisites:string[]=[])=>({id,label,meaningVersion:'synthetic-direction-v2',meaning:`Synthetic direction-only scope: ${id}`,aliases:[],level:'foundation' as const,priority:'important' as const,prerequisites,sourceIds:['fixture'],minutes:120,activity:'Synthetic practice',outcome:'Synthetic outcome',...syntheticPlanningDetails(id,prerequisites)});
 const result:RequirementLibrary={version:`synthetic-direction-${crypto.randomUUID()}`,audience:'experienced-qa',createdOn:today,sources:[{id:'fixture',title:'Synthetic source',url:'https://example.org/fixture',checkedOn:today}],capabilities:[node('automation','Test automation'),node('ci','Continuous integration',['automation']),node('load-testing','Load testing'),node('observability','Observability',['load-testing'])],directionRules:[{id:'delivery',label:'Synthetic delivery',requirements:[{capabilityId:'ci',priority:'critical'},{capabilityId:'observability',priority:'nice'}]},{id:'maintenance',label:'Synthetic maintenance',requirements:[{capabilityId:'automation',priority:'important'}]}],review:null};
 result.review={reviewer:'Synthetic tests only',reviewedOn:today,contentDigest:requirementContentDigest(result)};return result;
}
async function learner(){const email=`direction-${crypto.randomUUID()}@example.invalid`;emails.push(email);await first.invitation.create({data:{email}});const user=await admitGoogle(first,crypto.randomUUID(),email,'Synthetic Direction');return {id:user.id,email,sessionVersion:0};}
beforeEach(async()=>{
 vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-direction-signing-secret-only');
 await first.catalogueRevision.upsert({where:{id:'active'},create:{id:'active',version:catalogue.version},update:{}});
 library=fixture();await registerRequirementSnapshot(first,library,'synthetic-direction-evidence');await activateRequirementSnapshot(first,library.version);
 claims=await learner();await putProfile(first,claims,{currentRole:'QA',yearsExperience:7,hoursPerWeek:5,expectedRevision:0});
 await putSkills(first,claims,{expectedRevision:1,removals:[],entries:[{canonicalSkillId:'automation',label:'Test automation'},{canonicalSkillId:null,label:'SQL'}]});
 const preview=await previewSkillReconciliation(first,claims,library.version);
 await confirmSkillReconciliation(first,claims,{version:library.version,expectedRevision:2,reviewToken:preview.reviewToken,confirmations:[{skillKey:'id:automation',capabilityId:'automation'}]});
 const plan=await first.roadmap.create({data:{userId:claims.id,inputRevision:3,catalogueVersion:catalogue.version,tasks:{create:[1,2,3,4].map(week=>({position:week-1,week,title:'Synthetic task',activity:'Synthetic practice',completionCriterion:'Synthetic result',kind:'practical',skillIds:['automation'],resourceIds:[],estimatedMinutes:30,completed:true}))}}});planId=plan.id;
});
afterEach(async()=>{await first.user.deleteMany({where:{email:{in:emails}}});await first.invitation.deleteMany({where:{email:{in:emails}}});vi.unstubAllEnvs();});
afterAll(async()=>{await first.requirementActivation.deleteMany({where:{id:'active'}});await first.$disconnect();await second.$disconnect();});
const body=(directionId='delivery',expectedPlanningRevision=3,deferredCapabilityIds:string[]=[])=>({version:library.version,directionId,deferredCapabilityIds,expectedPlanningRevision});
const plan=()=>first.roadmap.findUniqueOrThrow({where:{id:planId},include:{tasks:{orderBy:{position:'asc'}}}});

it('RD-01 R06/R15: selection persists; comparison is deterministic and no-op saves retain plan/progress',async()=>{
 const old=await plan();await saveReviewedDirection(first,claims,body('delivery',3,['observability']));
 const comparison=await getReviewedGaps(second,claims);
 expect(comparison).toMatchObject({strengthIds:['automation'],mandatoryGapIds:['ci'],optionalGapIds:[],deferredCapabilityIds:['load-testing','observability'],planningRevision:4});
 expect(await getReviewedGaps(first,claims)).toEqual(comparison);
 await saveReviewedDirection(second,claims,body('delivery',4,['observability']));
 expect((await getState(first,claims)).profile.planningRevision).toBe(4);expect(await plan()).toEqual(old);
 expect((await getState(second,claims)).skills.map(skill=>skill.label).sort()).toEqual(['SQL','Test automation']);
});
it('RD-02 R06: unknown rules, mandatory deferral and forged gap/priority fields cannot change selection',async()=>{
 for(const input of [body('invented'),body('delivery',3,['ci']),{...body(),priority:'nice'},{...body(),mandatoryGapIds:[]}])await expect(saveReviewedDirection(first,claims,input)).rejects.toBeDefined();
 expect(await first.reviewedDirection.count({where:{userId:claims.id}})).toBe(0);expect((await getState(first,claims)).profile.planningRevision).toBe(3);
});
it('RD-03 R06/R12: active version change preserves selection but denies stale comparison and saves',async()=>{
 await saveReviewedDirection(first,claims,body());const old=await plan();const next=fixture();await registerRequirementSnapshot(first,next,'synthetic-direction-evidence');await activateRequirementSnapshot(first,next.version);
 expect((await reviewedDirectionOptions(first,claims)).stale).toBe(true);
 await expect(getReviewedGaps(first,claims)).rejects.toMatchObject({code:'STALE_REQUIREMENTS'});
 await expect(saveReviewedDirection(first,claims,body('maintenance',4))).rejects.toMatchObject({code:'STALE_REQUIREMENTS'});
 expect((await getState(first,claims)).reviewedDirection?.snapshotVersion).toBe(library.version);expect(await plan()).toEqual(old);
});
it('RD-04 R14: concurrent selections across two clients permit only one current-revision commit',async()=>{
 const results=await Promise.allSettled([saveReviewedDirection(first,claims,body()),saveReviewedDirection(second,claims,body('maintenance'))]);
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
 expect((await getState(first,claims)).profile.planningRevision).toBe(4);expect(await first.reviewedDirection.count({where:{userId:claims.id}})).toBe(1);
});
it('RD-05 R06/R07: no-gap generation bypasses provider, consent and funding without changing the plan',async()=>{
 await saveReviewedDirection(first,claims,body('maintenance'));const old=await plan();const provider={model:'synthetic-never-called',respond:vi.fn()};
 const output=await generateRoadmap(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:4,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false},provider);
 expect(output.code).toBe('NO_GAPS');expect(output.operation).toBeNull();expect(provider.respond).not.toHaveBeenCalled();
 expect(await first.aIOperation.count({where:{userId:claims.id}})).toBe(0);expect(await first.aIAttempt.count({where:{operation:{userId:claims.id}}})).toBe(0);expect(await plan()).toEqual(old);
});
it('RD-06 R07: reviewed learning needs cannot silently generate from the legacy catalogue without consent',async()=>{
 await saveReviewedDirection(first,claims,body());const old=await plan();
 await expect(generateRoadmap(first,claims,{operationKey:crypto.randomUUID(),expectedPlanningRevision:4,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false})).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
 expect(await first.aIOperation.count({where:{userId:claims.id}})).toBe(0);expect(await plan()).toEqual(old);
});
it('RD-07 R01/R10: ownership, revoked access and deletion prevent private reads and late selection',async()=>{
 await saveReviewedDirection(first,claims,body());const other=await learner();expect(await getReviewedGaps(first,other)).toBeNull();
 await expect(saveReviewedDirection(first,claims,{...body('maintenance',4),userId:other.id})).rejects.toBeDefined();
 await first.invitation.update({where:{email:claims.email},data:{active:false}});await expect(getReviewedGaps(first,claims)).rejects.toMatchObject({code:'ACCESS_ENDED'});
 await first.invitation.update({where:{email:claims.email},data:{active:true}});await deleteAccount(first,claims);
 expect(await first.reviewedDirection.count({where:{userId:claims.id}})).toBe(0);await expect(saveReviewedDirection(first,claims,body('maintenance',4))).rejects.toMatchObject({code:'ACCESS_ENDED'});
});
it('RD-08 R06/R15: changed preferences clear selection; no-op preferences preserve it',async()=>{
 const preferences={interests:['delivery'],preferredWork:'delivery',codingPreference:'open'};
 await putPathwayPreferences(first,claims,{preferences,expectedPlanningRevision:3});await saveReviewedDirection(first,claims,body('delivery',4));
 await putPathwayPreferences(first,claims,{preferences,expectedPlanningRevision:5});expect((await getState(first,claims)).reviewedDirection).not.toBeNull();
 await putPathwayPreferences(first,claims,{preferences:{...preferences,codingPreference:'some'},expectedPlanningRevision:5});expect((await getState(first,claims)).reviewedDirection).toBeNull();expect((await plan()).tasks.every(task=>task.completed)).toBe(true);
});
it('RD-09 R06: missing meaning confirmation is review_required, not an invented learning deficit',async()=>{
 await first.capabilityConfirmation.deleteMany({where:{skill:{userId:claims.id}}});await saveReviewedDirection(first,claims,body('maintenance'));
 expect(await getReviewedGaps(first,claims)).toMatchObject({outcome:'review_required',mandatoryGapIds:[],reconfirmationIds:['automation']});
});
it('RD-10 R08/R14: failed selection transaction rolls back; old selection/progress survive and retry succeeds',async()=>{
 await saveReviewedDirection(first,claims,body());const old=await plan();
 await first.$executeRawUnsafe('ALTER TABLE "ReviewedDirection" ADD CONSTRAINT "rd_synthetic_failure" CHECK ("directionId" <> \'maintenance\') NOT VALID');
 try{
  await expect(saveReviewedDirection(first,claims,body('maintenance',4))).rejects.toBeDefined();
  expect((await getState(first,claims)).reviewedDirection?.directionId).toBe('delivery');expect((await getState(first,claims)).profile.planningRevision).toBe(4);expect(await plan()).toEqual(old);
 }finally{await first.$executeRawUnsafe('ALTER TABLE "ReviewedDirection" DROP CONSTRAINT "rd_synthetic_failure"');}
 await saveReviewedDirection(first,claims,body('maintenance',4));expect((await getState(first,claims)).reviewedDirection?.directionId).toBe('maintenance');
 await expect(saveReviewedDirection(first,claims,body('delivery',4))).rejects.toMatchObject({code:'STALE_INPUT'});
});
