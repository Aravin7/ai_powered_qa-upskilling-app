import { z } from 'zod';
import { DomainError } from './domain';
import { storedResourcePreviewSchema } from './resource-preview';
import { createHash } from 'node:crypto';

export const reviewedResourceRequestSchema=z.object({operationKey:z.string().uuid(),expectedPlanningRevision:z.number().int().nonnegative(),topicId:z.string().min(1).max(80)}).strict();
export const reviewedResourcePreviewSchema=storedResourcePreviewSchema.extend({requirementSetId:z.string().min(1).max(100)}).strict();
export const reviewedResourcePreviewsSchema=z.array(reviewedResourcePreviewSchema).max(100);
export type ReviewedResourcePreview=z.infer<typeof reviewedResourcePreviewSchema>;
// Read only the public metadata/resources from the frozen server planning record.
// The full activity/context snapshot remains in PostgreSQL for reproducibility.
export const reviewedPlanViewSchema=z.object({kind:z.literal('reviewed-direction-v1'),mode:z.enum(['mock','groq']),directionLabel:z.string().min(1).max(140),context:z.object({libraryVersion:z.string(),requirementSetId:z.string()}),resources:reviewedResourcePreviewsSchema});

/** These records are synthetic fixtures. Only explicitly enabled non-production
 * mock processing may use them. No model claim is promoted to a real page check. */
export function currentReviewedResources(input:unknown,binding:{requirementSetId:string;libraryVersion:string;directionId:string;inputRevision:number},topicIds:string[]){
 if(process.env.NODE_ENV==='production'||!['mock','groq'].includes(process.env.AI_MODE??''))throw new DomainError('REVIEWED_ROADMAP_LIVE_DISABLED','Configure an approved local processing mode. Existing plan preserved.',503);
 const previews=reviewedResourcePreviewsSchema.parse(input).filter(item=>item.requirementSetId===binding.requirementSetId&&item.libraryVersion===binding.libraryVersion&&item.pathwayId===binding.directionId&&item.inputRevision===binding.inputRevision&&topicIds.includes(item.topicId));
 if(new Set(previews.map(item=>item.topicId)).size!==previews.length)throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Duplicate topic resource snapshots need to be researched again.',409);
 for(const item of previews){
  const [doc,support]=item.resources;
  const valid=item.mode===process.env.AI_MODE&&item.resources.every(resource=>item.mode==='mock'
   ?resource.reviewStatus==='synthetic_only'&&['docs.example.org','lessons.example.org'].includes(new URL(resource.url).hostname)
   :resource.reviewStatus==='automatically_checked'&&!!resource.citation&&resource.sourceId===`groq-${createHash('sha256').update(resource.url).digest('hex')}`&&resource.id===`resource-${createHash('sha256').update(resource.url).digest('hex')}`);
  if(doc.kind!=='documentation'||support.kind==='documentation'||doc.id===support.id||!valid)throw new DomainError('RESOURCE_VERIFICATION_REQUIRED','Resource snapshot does not match the configured processing mode and source provenance.',409);
 }
 return previews;
}
