import { describe, expect, it } from 'vitest';
import { reviewedPlanContext, validateReviewedPlan, mockReviewedPlan } from '../src/lib/reviewed-roadmap';
import { requirementContentDigest } from '../src/lib/requirements';
import { syntheticReviewedLibrary } from './fixtures/reviewed-planning';

function setup(count=4,shared=true){
 const library=syntheticReviewedLibrary(count,shared);
 const resources=library.capabilities.map(item=>({topicId:item.id,documentationId:`${item.id}-doc`,supportingId:`${item.id}-lesson`}));
 const input={library,selection:{directionId:'qa',deferredCapabilityIds:[] as string[]},inventory:[] as {canonicalSkillId:string;label:string;meaningVersion:string}[],hoursPerWeek:5,resources};
 const context=reviewedPlanContext(input);const proposal=mockReviewedPlan(context);
 return {input,context,proposal};
}
describe('R06/R07/T07 reviewed proposal validation; synthetic, no provider/DB',()=>{
 it('RR-01 accepts exact work, shared setup once, practice and four occupied weeks',()=>{
  const {context,proposal}=setup();const result=validateReviewedPlan(context,proposal);
  expect(context.totalMinutes).toBe(450);expect(result.tasks).toHaveLength(9);
  expect(result.tasks.reduce((sum,item)=>sum+item.estimatedMinutes,0)).toBe(450);
  expect(new Set(result.tasks.map(item=>item.week)).size).toBe(4);
 });
 it.each(['resources','minutes-short','minutes-padded','activity','outcome','title','skill','duplicate','missing','no-practice'])('RR-02-%s rejects changed, missing or overlapping work',variation=>{
  const {context,proposal}=setup();
  const item=proposal.tasks[1];
  if(variation==='resources')item.resourceIds=['invented'];
  if(variation==='minutes-short')item.estimatedMinutes--;
  if(variation==='minutes-padded')item.estimatedMinutes++;
  if(variation==='activity')item.activity='Unrelated work';
  if(variation==='outcome')item.completionCriterion='Unrelated result';
  if(variation==='title')item.title='Unrelated topic';
  if(variation==='skill')item.skillIds=['invented'];
  if(variation==='duplicate')proposal.tasks=[...proposal.tasks,{...item,week:4}];
  if(variation==='missing')proposal.tasks.pop();
  if(variation==='no-practice')proposal.tasks=proposal.tasks.filter(item=>item.kind!=='practical');
  expect(()=>validateReviewedPlan(context,proposal)).toThrow();
 });
 it('RR-03 rejects prerequisite inversion before scheduling and confirmed prerequisites need no learning tasks',()=>{
  const {context,proposal,input}=setup();
  [proposal.tasks[2],proposal.tasks[3]]=[proposal.tasks[3],proposal.tasks[2]];
  expect(()=>validateReviewedPlan(context,proposal)).toThrow(/precede/);
  const first=input.library.capabilities[0];
  input.inventory=[{canonicalSkillId:first.id,label:first.label,meaningVersion:first.meaningVersion}];input.resources.shift();
  const reduced=reviewedPlanContext(input);
  expect(reduced.activities.some(item=>item.id.startsWith(first.id+':'))).toBe(false);
  expect(()=>validateReviewedPlan(reduced,mockReviewedPlan(reduced))).not.toThrow();
 });
 it.each(['zero','fraction','string','gap','reverse','thirteen','one-week','overload'])('RR-04-%s rejects invalid weeks or weekly effort',variation=>{
  const {context,proposal}=setup();
  if(variation==='zero')proposal.tasks[0].week=0;
  if(variation==='fraction')proposal.tasks[0].week=1.5;
  if(variation==='string')(proposal.tasks[0] as unknown as {week:string}).week='1';
  if(variation==='gap')proposal.tasks.filter(item=>item.week===4).forEach(item=>{item.week=5;});
  if(variation==='reverse')proposal.tasks[0].week=2;
  if(variation==='thirteen')proposal.tasks.at(-1)!.week=13;
  if(variation==='one-week')proposal.tasks.forEach(item=>{item.week=1;});
  if(variation==='overload')context.hoursPerWeek=1;
  expect(()=>validateReviewedPlan(context,proposal)).toThrow();
 });
 it('RR-05 bypasses no gaps and rejects missing meaning provenance and missing resources',()=>{
  const {input}=setup();
  input.inventory=input.library.capabilities.map(item=>({canonicalSkillId:item.id,label:item.label,meaningVersion:item.meaningVersion}));
  expect(()=>reviewedPlanContext(input)).toThrow(/No missing/);
  input.inventory[0].meaningVersion='old';expect(()=>reviewedPlanContext(input)).toThrow(/Confirm changed/);
  input.inventory=[];input.resources=[];expect(()=>reviewedPlanContext(input)).toThrow(/Research resources/);
 });
 it('RR-06 retains 24 valid tasks across all twelve weeks',()=>{
  const {context,proposal}=setup(12,false);proposal.tasks=context.activities.map((item,index)=>({...item.task,week:Math.floor(index/2)+1}));
  const result=validateReviewedPlan(context,proposal);expect(result.tasks).toHaveLength(24);expect(result.tasks.at(-1)!.week).toBe(12);
 });
 it('RR-07 distinguishes demonstrable capacity, duration and unverified infeasibility',()=>{
  const {context}=setup();
  const failure={outcome:'infeasible',reason:'Synthetic limit',constraintCode:'capacity',deferredSkillIds:[],tasks:[]};
  expect(()=>validateReviewedPlan(context,failure)).toThrow(/does not prove/);
  context.hoursPerWeek=1;expect(()=>validateReviewedPlan(context,failure)).toThrow(/capacity/);
  const small=setup(1).context;expect(()=>validateReviewedPlan(small,{...failure,constraintCode:'duration_policy'})).toThrow(/four weeks/);
 });
 it('RR-08 optional deferral is server-derived; model cannot defer required work',()=>{
  const {input}=setup(3);input.library.directionRules[0].requirements=[{capabilityId:'qa-topic-2',priority:'important'},{capabilityId:'qa-topic-3',priority:'nice'}];
  input.library.review!.contentDigest=requirementContentDigest(input.library);
  input.selection.deferredCapabilityIds.push('qa-topic-3');input.resources.pop();
  const context=reviewedPlanContext(input);const output=mockReviewedPlan(context);
  expect(validateReviewedPlan(context,output).deferredSkillIds).toEqual(['qa-topic-3']);
  output.deferredSkillIds=['qa-topic-2'];expect(()=>validateReviewedPlan(context,output)).toThrow(/Deferrals/);
 });
});
