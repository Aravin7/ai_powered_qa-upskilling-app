import { requirementContentDigest, type RequirementLibrary } from '../../src/lib/requirements';
import { syntheticPlanningDetails } from './requirement-details';

export function syntheticReviewedLibrary(count=4,sharedSetup=true):RequirementLibrary{
 const day=new Date().toISOString().slice(0,10);const ids=Array.from({length:count},(_,index)=>`qa-topic-${index+1}`);
 const capabilities=ids.map((id,index)=>{
  const prerequisites=index?[ids[index-1]]:[];const details=syntheticPlanningDetails(id,prerequisites);
  return {id,label:`Synthetic QA topic ${index+1}`,meaningVersion:'synthetic-planning-v1',meaning:`Synthetic meaning for ${id}`,aliases:[],level:'foundation' as const,priority:'important' as const,prerequisites,sourceIds:['source'],minutes:sharedSetup?120:110,activity:`Perform the synthetic exercise for ${id}.`,outcome:`Record the synthetic result for ${id}.`,scope:details.scope,effort:{...details.effort,setupMinutes:sharedSetup?10:0,sharedSetup:sharedSetup?details.effort.sharedSetup:null}};
 });
 const library:RequirementLibrary={version:`synthetic-planning-${crypto.randomUUID()}`,audience:'experienced-qa',createdOn:day,sources:[{id:'source',title:'Synthetic source only',url:'https://docs.example.org/requirements',checkedOn:day}],capabilities,directionRules:[{id:'qa',label:'Synthetic QA direction',requirements:[{capabilityId:ids.at(-1)!,priority:'important'}]}],review:null};
 library.review={reviewer:'Synthetic test reviewer only',reviewedOn:day,contentDigest:requirementContentDigest(library)};return library;
}
