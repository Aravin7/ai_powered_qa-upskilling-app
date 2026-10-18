import { z } from 'zod';
import { DomainError } from './domain';
import { storedResourcePreviewSchema } from './resource-preview';

export const reviewedResourceRequestSchema=z.object({operationKey:z.string().uuid(),expectedPlanningRevision:z.number().int().nonnegative(),topicId:z.string().min(1).max(80)}).strict();
export const reviewedResourcePreviewSchema=storedResourcePreviewSchema.extend({requirementSetId:z.string().min(1).max(100)}).strict();
export const reviewedResourcePreviewsSchema=z.array(reviewedResourcePreviewSchema).max(100);
export type ReviewedResourcePreview=z.infer<typeof reviewedResourcePreviewSchema>;
// Read only the public metadata/resources from the frozen server planning record.
// The full activity/context snapshot remains in PostgreSQL for reproducibility.
export const reviewedPlanViewSchema=z.object({kind:z.literal('reviewed-direction-v1'),mode:z.literal('mock'),directionLabel:z.string().min(1).max(140),context:z.object({libraryVersion:z.string(),requirementSetId:z.string()}),resources:reviewedResourcePreviewsSchema});

/** These records are synthetic fixtures. Only explicitly enabled non-production
 * mock processing may use them. No model claim is promoted to a real page check. */
export function currentReviewedResources(input:unknown,binding:{requirementSetId:string;libraryVersion:string;directionId:string;inputRevision:number},topicIds:string[]){
 if(process.env.NODE_ENV==='production'||process.env.AI_MODE!=='mock')throw new DomainError('REVIEWED_ROADMAP_LIVE_DISABLED','Verified live resource research is not configured. Existing plan preserved.',503);
 const previews=reviewedResourcePreviewsSchema.parse(input).filter(item=>item.requirementSetId===binding.requirementSetId&&item.libraryVersion===binding.libraryVersion&&item.pathwayId===binding.directionId&&item.inputRevision===binding.inputRevision&&topicIds.includes(item.topicId));
 if(new Set(previews.map(item=>item.topicId)).size!==previews.length)throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Duplicate topic resource snapshots need to be researched again.',409);
 for(const item of previews){
  const [doc,support]=item.resources;
  if(doc.kind!=='documentation'||support.kind==='documentation'||doc.id===support.id||item.resources.some(resource=>!['docs.example.org','lessons.example.org'].includes(new URL(resource.url).hostname)))throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Synthetic resource snapshot is invalid.',409);
 }
 return previews;
}
