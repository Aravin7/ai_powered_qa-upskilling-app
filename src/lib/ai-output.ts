import { z } from 'zod';
import { catalogue } from './catalogue';
import { canonicalize, DomainError, normalizeLabel, planSchema, validatePlan } from './domain';
import { AI_LIMITS } from './ai-config';
import type { Profile, SkillEntry } from './types';
export const extractionSchema=z.object({skills:z.array(z.object({skillId:z.string().max(80).nullable(),label:z.string().trim().min(1).max(100),evidenceExcerpt:z.string().trim().min(1).max(400)}).strict()).max(AI_LIMITS.candidates)}).strict();
export const infeasibleSchema=z.object({outcome:z.literal('infeasible'),reason:z.string().trim().min(1).max(600),constraintCode:z.enum(['duration_policy','capacity','prerequisite_or_content','undetermined']),tasks:z.array(z.never()).length(0),deferredSkillIds:z.array(z.never()).length(0)}).strict();
export const roadmapOutputSchema=z.union([planSchema,infeasibleSchema]);
export function containsSkill(text:string,label:string){
 const term=normalizeLabel(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(?:^|[^\\p{L}\\p{N}])${term}(?:$|[^\\p{L}\\p{N}])`,'u').test(normalizeLabel(text));
}
export function supportsCatalogueSkill(line:string,skill:{id:string;label:string;aliases:readonly string[]}){
 if([skill.label,...skill.aliases].some(label=>containsSkill(line,label)))return true;
 // Concrete test-case design can be demonstrated without repeating the catalogue label.
 return skill.id==='test-design'&&/\bdesigned\b[^.!?\n]{0,120}\b(?:boundary(?: value)?|negative|equivalence partitioning)\b[^.!?\n]{0,80}\btest cases?\b/i.test(line);
}
export function minimizeText(text:string,identifiers:string[]){
 let cleaned=text.replace(/^[^\n]*(?:@|https?:\/\/|www\.|linkedin|\baddress\b|\bphone\b|\bcontact\b|\bstreet\b|\bpostal\b)[^\n]*$/gim,'');
 cleaned=cleaned.replace(/\+?\d[\d ()-]{7,}\d/g,'[removed]');
 const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const bounded=(value:string)=>new RegExp(`(?<![\\p{L}\\p{N}])${escape(value)}(?![\\p{L}\\p{N}])`,'giu');
 // Remove full identities first. Individual name tokens may also be skill terms;
 // preserve those only inside an exact catalogue phrase, never inside a full name.
 for(const identifier of [...new Set(identifiers.map(value=>value.trim()).filter(Boolean))].sort((a,b)=>b.length-a.length)){
  const skillRanges=/\s/.test(identifier)?[]:catalogue.skills.flatMap(skill=>[skill.label,...skill.aliases].flatMap(label=>
   [...cleaned.matchAll(bounded(label))].map(match=>({start:match.index,end:match.index+match[0].length}))));
  cleaned=cleaned.replace(bounded(identifier),(match:string,offset:number)=>
   skillRanges.some(range=>offset>=range.start&&offset+match.length<=range.end)?match:'[removed]');
 }
 // Local synthetic profile accepts only task-evidence lines. Discard the contact/header block.
 let excluded=false;
 return cleaned.split('\n').filter(line=>{
  if(/^\s*(?:job requirements?|requirements?|objectives?|aspirations?|future learning)\b/i.test(line)){excluded=true;return false;}
  if(/^\s*(?:work experience|experience|projects|employment history|professional skills)\s*:?\s*$/i.test(line)){excluded=false;return false;}
  return !excluded&&/\b(?:used|built|designed|implemented|performed|created|tested|automated|reviewed)\b/i.test(line);
 }).join('\n');
}
export function affirmativeEvidence(excerpt:string){
 return /\b(?:used|built|designed|implemented|performed|created|tested|automated|reviewed)\b/i.test(excerpt)
  &&!/(?:\b(?:no|not|never|without|lack|lacks|want|wish|hope|plan|aspire|learn|learning|seeking|require|requires|required|requirement|requirements|vacancy|job advert)\b|["“”<>]|https?:|@)/i.test(excerpt);
}
export function validateExtraction(input:unknown,text:string){
 const result=extractionSchema.parse(input);const seen=new Set<string>();
 return result.skills.map(candidate=>{
  const line=text.split('\n').find(line=>line.trim()===candidate.evidenceExcerpt);
  if(!line||!affirmativeEvidence(line))throw new DomainError('INVALID_EVIDENCE','Skill evidence could not be verified. Review skills manually.',502);
  const skill=catalogue.skills.find(s=>s.id===candidate.skillId);
  if(candidate.skillId&&!skill)throw new DomainError('INVALID_EVIDENCE','Unknown extracted skill.',502);
  if(!(skill?supportsCatalogueSkill(line,skill):containsSkill(line,candidate.label)))throw new DomainError('INVALID_EVIDENCE','Evidence does not support this skill mapping.',502);
  const entry=canonicalize({canonicalSkillId:candidate.skillId,label:candidate.label});
  if(seen.has(entry.key))throw new DomainError('INVALID_EVIDENCE','Duplicate extracted skill.',502);
  seen.add(entry.key);return {...candidate,skillId:entry.canonicalSkillId,label:entry.label};
 });
}
export function validateRoadmapOutput(input:unknown,profile:Profile,skills:SkillEntry[]){
 const output=roadmapOutputSchema.parse(input);
 if(output.outcome==='infeasible'){
  // Only independently demonstrable aggregate capacity is reported as a constraint.
  const known=new Set(skills.map(s=>s.canonicalSkillId));
  const mandatory=catalogue.skills.filter(s=>!known.has(s.id)&&s.priority!=='nice').reduce((n,s)=>n+s.minutes,0);
  if(output.constraintCode==='capacity'&&mandatory>profile.hoursPerWeek*60*12)throw new DomainError('CAPACITY','Required work exceeds twelve weeks at this availability. Existing plan preserved.',422);
  throw new DomainError('UNVERIFIED_INFEASIBLE','The mock provider did not produce a valid schedule. This does not prove that no feasible plan exists. Existing plan preserved.',502);
 }
 const plan=validatePlan(output,profile,skills);
 // Synthetic catalogue semantic gate: full, unsplit activities must agree with its honest effort and outcome.
 // A broader live semantic rubric requires content review before paid integration is enabled.
 for(const task of plan.tasks){
  const skill=catalogue.skills.find(s=>task.skillIds.length===1&&s.id===task.skillIds[0]);
  if(!skill||task.title!==skill.label||task.activity!==skill.activity||task.completionCriterion!==skill.outcome||task.estimatedMinutes!==skill.minutes)
   throw new DomainError('INVALID_PLAN','The proposed activity or effort does not match the synthetic catalogue.',502);
 }
 if(new Set(plan.tasks.flatMap(t=>t.skillIds)).size!==plan.tasks.length)throw new DomainError('INVALID_PLAN','Overlapping activities are not permitted in the synthetic catalogue.',502);
 return plan;
}
