import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client';
import { catalogue } from './catalogue';
import { DomainError, POLICY_VERSION } from './domain';
import { mockConfiguration } from './ai-config';
import type { ProcessingDisclosure } from './types';

const amount=z.number().int().positive().max(2_000_000_000);
export const pilotSchema=z.object({
 model:z.string().regex(/^gemini-\d+(?:\.\d+)?-(?:flash|flash-lite|pro)(?:-\d+)?$/),
 catalogueVersion:z.string().min(1).max(100),
 // Use the verified model's maximum billable input limit, not a chars/4 estimate.
 maxBillableInputTokens:z.number().int().positive().max(2_000_000),
 maxOutputTokens:z.number().int().positive().max(65536),
 maxRequestBytes:z.number().int().positive().max(200000),
 inputMicroUsdPerMillion:amount,outputMicroUsdPerMillion:amount,ceilingMicroUsd:amount,
 pricingReference:z.string().url().refine(value=>new URL(value).origin==='https://ai.google.dev'),
 pricingVerifiedAt:z.iso.datetime(),pricingValidUntil:z.iso.datetime(),expiresAt:z.iso.datetime(),
 approvedBy:z.string().trim().min(1).max(100),approvalReference:z.string().trim().min(1).max(200),
 privacyNotice:z.string().trim().min(40).max(3000),
 dataScope:z.literal('synthetic-only'),
}).strict().refine(pilot=>new Date(pilot.expiresAt)<=new Date(pilot.pricingValidUntil)&&new Date(pilot.pricingVerifiedAt)<new Date(pilot.pricingValidUntil),'Funding expiry must stay within the verified pricing period.');
export type GeminiPilot=z.infer<typeof pilotSchema>;
export function configurationVersion(pilot:GeminiPilot){return createHash('sha256').update(JSON.stringify(pilotSchema.parse(pilot))).digest('hex');}
export function reservationMicroUsd(pilot:GeminiPilot){
 const total=BigInt(pilot.maxBillableInputTokens)*BigInt(pilot.inputMicroUsdPerMillion)+BigInt(pilot.maxOutputTokens)*BigInt(pilot.outputMicroUsdPerMillion);
 const units=(total+999999n)/1000000n;
 if(units>2000000000n)throw new DomainError('AI_CONFIGURATION','The conservative attempt reservation exceeds supported funding units.',503);
 return Number(units);
}
type Tx=Prisma.TransactionClient;
export async function pilotConfiguration(tx:Tx){
 if(process.env.NODE_ENV==='production')throw new DomainError('AI_DISABLED','The synthetic Gemini pilot is restricted to local testing.',503);
 const budgetId=process.env.AI_BUDGET_ID;
 const budget=budgetId?await tx.fundingBudget.findUnique({where:{id:budgetId}}):null;
 const parsed=pilotSchema.safeParse(budget?.configuration);
 if(!budget||!parsed.success)throw new DomainError('AI_CONFIGURATION','Gemini requires an approved server-held pilot configuration.',503);
 const pilot=parsed.data;const version=configurationVersion(pilot);
 if(budget.mode!=='gemini'||budget.currency!=='USD_MICRO'||budget.pricingVersion!==version||budget.ceiling!==pilot.ceilingMicroUsd||budget.expiresAt.toISOString()!==pilot.expiresAt)
  throw new DomainError('AI_CONFIGURATION','Gemini funding and configuration do not match.',503);
 return {mode:'gemini' as const,budgetId:budget.id,version,pilot,budget,units:reservationMicroUsd(pilot)};
}
export async function executionConfiguration(tx:Tx){
 if(process.env.AI_MODE==='gemini')return pilotConfiguration(tx);
 const config=mockConfiguration();return {mode:'mock' as const,budgetId:config.budgetId,version:'mock-v1',units:1};
}
export async function processingDisclosure(tx:Tx):Promise<ProcessingDisclosure>{
 if(process.env.AI_MODE!=='gemini')return {mode:'mock',policyVersion:POLICY_VERSION,notice:'Local mock processing of synthetic inputs only. No external AI transmission occurs. Files and evidence are temporary; keyed fingerprints and operation/consent metadata remain until account deletion. Candidate references expire after 15 minutes.',provider:'Local mock provider'};
 try{
  const {pilot,version}=await pilotConfiguration(tx);
  return {mode:'gemini',policyVersion:`gemini-disclosure-v1-${version}`,provider:`Google Gemini (${pilot.model})`,notice:pilot.privacyNotice};
 }catch{return {mode:'disabled',policyVersion:'gemini-unconfigured',provider:'Google Gemini (not configured)',notice:'Gemini dispatch is disabled until the operator configures approved pricing, funding and privacy terms. Manual entry remains available.'};}
}
export function assertGeminiDispatch(config:Awaited<ReturnType<typeof pilotConfiguration>>,time:Date){
 const {pilot,budget}=config;
 if(!budget.enabled||budget.expiresAt<=time)throw new DomainError('FUNDING_STOP','Gemini funding is revoked or expired. No further dispatch or activation is allowed.',503);
 if(new Date(pilot.pricingVerifiedAt)>time)throw new DomainError('AI_CONFIGURATION','Pricing verification cannot be in the future.',503);
 if(!catalogue.reviewed||catalogue.version!==pilot.catalogueVersion)throw new DomainError('CATALOGUE_UNREVIEWED','A matching reviewed catalogue is required before Gemini dispatch.',503);
 if(!process.env.GEMINI_API_KEY)throw new DomainError('AI_CONFIGURATION','Configure the Gemini API key on the server.',503);
}
