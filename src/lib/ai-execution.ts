import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { catalogue } from './catalogue';
import { DomainError, POLICY_VERSION } from './domain';
import { mockConfiguration } from './ai-config';
import type { ProcessingDisclosure } from './types';

export const GROQ_NATIVE_TOOL_LIMIT = 6;
export const GROQ_MODEL = 'openai/gpt-oss-20b';
export const GROQ_NOTICE = 'Local assignment demo using synthetic inputs only. Groq receives minimized CV text for extraction, or confirmed skill IDs, learning gaps and weekly hours for planning. The application does not save CV files, text, prompts or excerpts. Groq documents possible reliability/abuse retention up to 30 days unless its Data Controls disable it; account settings are not verified by this application. Candidates require confirmation. Catalogue activities are synthetic and unreviewed.';
export const workflowApprovalSchema=z.object({
 approvalReference:z.string().trim().min(1).max(300),providerTermsReference:z.string().trim().min(1).max(300),privacyTermsReference:z.string().trim().min(1).max(300),
 approvedNoticeSha256:z.string().regex(/^[a-f0-9]{64}$/),freeNativeToolsConfirmed:z.literal(true),maximumCharge:z.literal(0),
 nativeOrchestration:z.literal('provider-managed-no-hard-call-cap'),maxReportedToolCalls:z.number().int().min(1).max(GROQ_NATIVE_TOOL_LIMIT).default(GROQ_NATIVE_TOOL_LIMIT),
}).strict();
export const groqConfigurationSchema = z.object({
 model:z.literal(GROQ_MODEL), catalogueVersion:z.string().min(1).max(100),
 maxOutputTokens:z.number().int().positive().max(8192),
 maxRequestBytes:z.number().int().positive().max(200000),
 ceilingRequests:z.number().int().positive().max(100), expiresAt:z.iso.datetime(),
 freePlanConfirmed:z.literal(true), dataScope:z.literal('synthetic-only'),
 privacyNotice:z.string().trim().min(40).max(3000),
 workflow:workflowApprovalSchema.optional(),
}).strict().superRefine((config,ctx)=>{if(config.workflow&&config.workflow.approvedNoticeSha256!==createHash('sha256').update(config.privacyNotice).digest('hex'))ctx.addIssue({code:'custom',path:['workflow','approvedNoticeSha256'],message:'Approval must bind the exact provider/native-search notice.'});});
export type GroqConfiguration = z.infer<typeof groqConfigurationSchema>;
export function configurationVersion(config:GroqConfiguration){
 return createHash('sha256').update(JSON.stringify(groqConfigurationSchema.parse(config))).digest('hex');
}
type Tx=Prisma.TransactionClient;
export async function groqConfiguration(tx:Tx){
 if(process.env.NODE_ENV==='production')throw new DomainError('AI_DISABLED','The synthetic Groq demo is restricted to local testing.',503);
 if(process.env.GROQ_FREE_PLAN_CONFIRMED!=='true')throw new DomainError('AI_CONFIGURATION','Confirm the Groq account remains on the Free Plan before enabling this demo.',503);
 const budgetId=process.env.AI_BUDGET_ID;
 const budget=budgetId?await tx.fundingBudget.findUnique({where:{id:budgetId}}):null;
 const parsed=groqConfigurationSchema.safeParse(budget?.configuration);
 if(!budget||!parsed.success)throw new DomainError('AI_CONFIGURATION','Run the Groq configuration command before processing.',503);
 const pilot=parsed.data;const version=configurationVersion(pilot);
 if(budget.mode!=='groq'||budget.currency!=='REQUESTS'||budget.pricingVersion!==version||budget.ceiling!==pilot.ceilingRequests||budget.expiresAt.toISOString()!==pilot.expiresAt)
  throw new DomainError('AI_CONFIGURATION','Groq configuration and shared request counter do not match.',503);
 return {mode:'groq' as const,budgetId:budget.id,version,pilot,budget,units:1};
}
export async function executionConfiguration(tx:Tx){
 if(process.env.AI_MODE==='groq')return groqConfiguration(tx);
 const config=mockConfiguration();return {mode:'mock' as const,budgetId:config.budgetId,version:'mock-v1',units:1};
}
export async function processingDisclosure(tx:Tx):Promise<ProcessingDisclosure>{
 if(process.env.AI_MODE==='mock')return {mode:'mock',connectedWorkflow:true,policyVersion:POLICY_VERSION,notice:'Local mock processing of synthetic inputs only, including pathway suggestions from confirmed skills, saved interests, coding/work preferences and weekly hours. Mock resource previews use selected direction/topic labels and placeholder sources, with two separately counted provider steps. They do not perform web search or verify real pages. No external AI transmission occurs. Files and evidence are temporary; keyed fingerprints, saved resource fixtures and operation/consent metadata remain until account deletion. Candidate references expire after 15 minutes.',provider:'Local mock provider'};
 if(process.env.AI_MODE==='groq')try{
  const {pilot,version}=await groqConfiguration(tx);
  return {mode:'groq',connectedWorkflow:!!pilot.workflow,policyVersion:`groq-disclosure-v1-${version}`,provider:`Groq (${pilot.model})`,notice:pilot.privacyNotice};
 }catch{return {mode:'disabled',policyVersion:'groq-unconfigured',provider:'Groq (not configured)',notice:'Configure the local Groq Free Plan demo before enabling AI. Manual entry remains available.'};}
 return {mode:'disabled',policyVersion:'ai-disabled',provider:'AI disabled',notice:'AI processing is disabled. Manual entry remains available.'};
}
export function assertGroqDispatch(config:Awaited<ReturnType<typeof groqConfiguration>>,time:Date){
 const {pilot,budget}=config;
 if(!budget.enabled||budget.expiresAt<=time)throw new DomainError('FUNDING_STOP','The shared Groq request allowance is revoked or expired. Further dispatch and activation are blocked.',503);
 if(catalogue.version!==pilot.catalogueVersion)throw new DomainError('STALE_CATALOGUE','Groq configuration must match the synthetic catalogue version.',409);
 if(!process.env.GROQ_API_KEY)throw new DomainError('AI_CONFIGURATION','Configure GROQ_API_KEY on the server.',503);
}
export function assertGroqWorkflow(config:Awaited<ReturnType<typeof groqConfiguration>>){
 if(!config.pilot.workflow)throw new DomainError('RESOURCE_LIVE_DISABLED','The connected workflow needs approved native-tool usage/cost terms and an exact provider-search notice. Existing data is preserved.',503);
}
