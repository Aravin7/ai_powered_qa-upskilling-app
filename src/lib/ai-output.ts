import { z } from 'zod';
import { prepareCvText, type CvBlock } from './cv-text';
import { catalogue } from './catalogue';
import { canonicalize, DomainError, normalizeLabel, planSchema, validatePlan } from './domain';
import { AI_LIMITS } from './ai-config';
import type { Profile, SkillEntry } from './types';
export const extractionSchema=z.object({skills:z.array(z.object({skillId:z.string().max(80).nullable(),label:z.string().trim().min(1).max(100),evidenceExcerpt:z.string().trim().min(1).max(400),sourceId:z.string().max(80).nullable().optional()}).strict()).max(AI_LIMITS.candidates)}).strict();
export const infeasibleSchema=z.object({outcome:z.literal('infeasible'),reason:z.string().trim().min(1).max(600),constraintCode:z.enum(['duration_policy','capacity','prerequisite_or_content','undetermined']),tasks:z.array(z.never()).length(0),deferredSkillIds:z.array(z.never()).length(0)}).strict();
export const roadmapOutputSchema=z.union([planSchema,infeasibleSchema]);
// A server-validated witness only establishes that at least one schedule exists.
// It is never activated in place of a provider proposal.
export function oneTaskPerWeekWitness(hoursPerWeek:number,confirmedSkillIds:readonly string[]){
 const confirmed=new Set(confirmedSkillIds);
 const gaps=catalogue.skills.filter(skill=>!confirmed.has(skill.id));
 if(gaps.length<4||gaps.length>12)return null;
 const tasks=gaps.map((skill,index)=>({week:index+1,kind:index===gaps.length-1?'practical' as const:'learning' as const,
  title:skill.label,activity:skill.activity,completionCriterion:skill.outcome,skillIds:[skill.id],resourceIds:[...skill.resourceIds],estimatedMinutes:skill.minutes}));
 const inventory:SkillEntry[]=catalogue.skills.filter(skill=>confirmed.has(skill.id)).map(skill=>({key:`id:${skill.id}`,canonicalSkillId:skill.id,label:skill.label,source:'manual'}));
 try{
  validatePlan({outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks},{hoursPerWeek},inventory);
  return tasks.map(task=>({week:task.week,skillId:task.skillIds[0],estimatedMinutes:task.estimatedMinutes,kind:task.kind}));
 }catch{return null;}
}
export function containsSkill(text:string,label:string){
 const term=normalizeLabel(label).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(?:^|[^\\p{L}\\p{N}])${term}(?:$|[^\\p{L}\\p{N}])`,'u').test(normalizeLabel(text));
}
export function supportsCatalogueSkill(line:string,skill:{id:string;label:string;aliases:readonly string[]}){
 if([skill.label,...skill.aliases].some(label=>containsSkill(line,label)))return true;
 // CVs often describe the work without using the catalogue's exact label.
 if(skill.id==='test-design'&&/\b(?:designed|authored|wrote|created|executed|reviewed|maintained|developed)\b[^.!?;\n]{0,180}\b(?:test cases?|test scenarios?|test designs?)\b/i.test(line))return true;
 return skill.id==='api-testing'&&(/\b(?:api|rest|http)\s+(?:testing|validation|checks?)\b|\b(?:tested|validated)\s+(?:rest|http|json)\s+(?:apis?|endpoints?)\b/i.test(line));
}
const actionVerb=/\b(?:used|built|designed|implemented|performed|created|tested|automated|reviewed|authored|executed|conducted|wrote|led|developed|maintained|validated|configured|deployed|reported|analyzed|analysed|managed|delivered|supported|debugged|verified|documented|prepared|established|integrated|contributed|presented|facilitated)\b/i;
export function minimizeText(text:string,identifiers:string[]){return prepareCvText(text,identifiers).text;}
const unsupported=/(?:\b(?:no|not|never|without|lack|lacks|want|wish|hope|plan|aspire|learn|learning|seeking|require|requires|required|requirement|requirements|vacancy|job advert|ignore|invoke)\b|n['’]t\b|[<>]|https?:|@)/i;
export function evidenceClauses(text:string){return text.split(/(?<=[.!?;])\s+/).map(s=>s.trim()).filter(Boolean);}
export function affirmativeEvidence(text:string){return !/["“”]/.test(text)&&evidenceClauses(text).some(clause=>!unsupported.test(clause)&&(actionVerb.test(clause)||/\b(?:experienced|proficient|skilled)\s+(?:in|with|at)\b/i.test(clause)));}
export function supportsAffirmativeCatalogueSkill(text:string,skill:{id:string;label:string;aliases:readonly string[]}){
 return !/["“”]/.test(text)&&evidenceClauses(text).some(clause=>affirmativeEvidence(clause)&&supportsCatalogueSkill(clause,skill));
}
export function candidateEvidence(block:CvBlock,excerpt:string,skill:{id:string;label:string;aliases:readonly string[]}){
 const offset=block.text.indexOf(excerpt);if(offset<0||block.text.indexOf(excerpt,offset+1)>=0)return null;
 // Check the full sentence around the excerpt; a model cannot omit negation by
 // quoting only its affirmative fragment. Ambiguous quotes fail conservatively.
 if(/["“”]/.test(block.text))return null;
 let position=0;
 for(const clause of evidenceClauses(block.text)){
  const begin=block.text.indexOf(clause,position);position=begin+clause.length;
  if(offset<begin||offset+excerpt.length>position)continue;
  if(unsupported.test(clause)||!supportsCatalogueSkill(excerpt,skill))return null;
  if(affirmativeEvidence(clause))return 'demonstrated' as const;
  if(block.section==='technologies'&&!actionVerb.test(clause))return 'listed' as const;
 }
 return null;
}
export function validateExtraction(input:unknown,text:string,sourceBlocks?:CvBlock[]){
 const result=extractionSchema.parse(input);const seen=new Set<string>();
 const blocks=sourceBlocks??text.split('\n').map((line,i)=>({id: `cv-${i+1}`,section:'uncertain' as const,text:line}));
 return result.skills.map(candidate=>{
  const skill=catalogue.skills.find(s=>s.id===candidate.skillId);
  if(candidate.skillId&&!skill)throw new DomainError('INVALID_EVIDENCE','Unknown extracted skill.',502);
  const vocabulary=skill??{id:'unmatched',label:candidate.label,aliases:[]};
  const matches=blocks.filter(b=>(!candidate.sourceId||b.id===candidate.sourceId)&&b.text.includes(candidate.evidenceExcerpt));
  if(matches.length!==1)throw new DomainError('INVALID_EVIDENCE','Evidence is missing or ambiguous. Review skills manually.',502);
  const evidenceType=candidateEvidence(matches[0],candidate.evidenceExcerpt,vocabulary);
  if(!evidenceType)throw new DomainError('INVALID_EVIDENCE','Evidence does not support this skill mapping.',502);
  const entry=canonicalize({canonicalSkillId:candidate.skillId,label:candidate.label});
  if(seen.has(entry.key))throw new DomainError('INVALID_EVIDENCE','Duplicate extracted skill.',502);
  seen.add(entry.key);return {...candidate,skillId:entry.canonicalSkillId,label:entry.label,sourceId:matches[0].id,evidenceType};
 });
}
export function validateRoadmapOutput(input:unknown,profile:Profile,skills:SkillEntry[]){
 const output=roadmapOutputSchema.parse(input);
 if(output.outcome==='infeasible'){
  if(oneTaskPerWeekWitness(profile.hoursPerWeek,skills.flatMap(skill=>skill.canonicalSkillId?[skill.canonicalSkillId]:[])))
   throw new DomainError('INVALID_OUTPUT','Provider declared infeasible despite a valid catalogue schedule. Existing plan preserved.',502);
  // Only independently demonstrable aggregate capacity is reported as a constraint.
  const known=new Set(skills.map(s=>s.canonicalSkillId));
  const mandatory=catalogue.skills.filter(s=>!known.has(s.id)&&s.priority!=='nice').reduce((n,s)=>n+s.minutes,0);
  if(output.constraintCode==='capacity'&&mandatory>profile.hoursPerWeek*60*12)throw new DomainError('CAPACITY','Required work exceeds twelve weeks at this availability. Existing plan preserved.',422);
  throw new DomainError('UNVERIFIED_INFEASIBLE','The provider did not produce a valid schedule. This does not prove that no feasible plan exists. Existing plan preserved.',502);
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
