import { z, ZodError } from 'zod';
import { createHash } from 'node:crypto';
import type { PrismaClient, AIOperation } from '../generated/prisma/client';
import { access, getState, type Claims, type Tx } from './store';
import { catalogue } from './catalogue';
import { assertRevision, compare, DomainError, generateSchema, POLICY_VERSION } from './domain';
import { AI_LIMITS, mockConfiguration } from './ai-config';
import { fingerprint, signCandidate } from './candidate-origin';
import { minimizeText, validateExtraction, validateRoadmapOutput } from './ai-output';
import { mockProvider, ProviderFailure, type AIProvider, type ProviderInput } from './ai-provider';
import { parsePdf } from './pdf';
import type { Purpose } from './types';

// Every mutation takes invitation -> user -> catalogue -> funding locks in that order.
// No transaction stays open during parsing or provider work.
const transactionOptions={maxWait:2000,timeout:3000};
// Prisma DateTime uses timestamp without time zone. Explicit UTC avoids driver/session-zone reinterpretation.
async function now(tx:Tx){const [row]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;return row.now;}
async function consent(tx:Tx,claims:Claims,kind:Purpose){
 const c=await tx.consent.findFirst({where:{userId:claims.id,purpose:kind},orderBy:{sequence:'desc'}});
 if(!c?.granted||c.policyVersion!==POLICY_VERSION)throw new DomainError('CONSENT_REQUIRED','Enable current consent for this purpose in Privacy & settings.',403);
 return c;
}
async function catalogueRevision(tx:Tx){
 await tx.$queryRaw`SELECT id FROM "CatalogueRevision" WHERE id='active' FOR UPDATE`;
 const c=await tx.catalogueRevision.findUnique({where:{id:'active'}});
 if(!c||c.version!==catalogue.version)throw new DomainError('STALE_CATALOGUE','The catalogue changed or is not configured. Refresh before retrying.',409);
 return c;
}
function metadata(op:AIOperation){return {id:op.id,key:op.key,kind:op.kind,state:op.state,code:op.code,attempts:op.attempts,deadline:op.deadline.toISOString(),roadmapId:op.roadmapId};}
export async function operationStatus(client:PrismaClient,claims:Claims,id:string){
 return client.$transaction(async tx=>{
  await access(tx,claims,true);
  await tx.aIOperation.updateMany({where:{userId:claims.id,state:'running',deadline:{lte:await now(tx)}},data:{state:'expired',code:'DEADLINE'}});
  const op=await tx.aIOperation.findFirst({where:{userId:claims.id,OR:[{id},{key:id}]}});
  if(!op)throw new DomainError('NOT_FOUND','Operation not found.',404);
  return metadata(op);
 },transactionOptions);
}
async function begin(client:PrismaClient,claims:Claims,kind:Purpose,key:string,binding:string,started:number,expected?:z.infer<typeof generateSchema>){
 return client.$transaction(async tx=>{
  await access(tx,claims,true);const c=await consent(tx,claims,kind);
  const existing=await tx.aIOperation.findUnique({where:{userId_kind_key:{userId:claims.id,kind,key}}});
  if(existing){
   if(existing.fingerprint!==binding)throw new DomainError('KEY_CONFLICT','This operation key belongs to different input. Use a new key for a deliberate retry.',409);
   if(existing.state==='running'&&existing.deadline<=await now(tx))return {op:await tx.aIOperation.update({where:{id:existing.id},data:{state:'expired',code:'DEADLINE'}}),replay:true};
   return {op:existing,replay:true};
  }
  const global=await catalogueRevision(tx);
  const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
  if(expected){
   assertRevision(profile.planningRevision,expected.expectedPlanningRevision);
   if(expected.expectedCatalogueVersion!==global.version)throw new DomainError('STALE_CATALOGUE','Refresh the current catalogue.',409);
   if(!profile.confirmed||!profile.inventoryConfirmed)throw new DomainError('ONBOARDING_REQUIRED','Save your profile and confirm your skills first.');
   const skills=await tx.confirmedSkill.findMany({where:{userId:claims.id}});
   if(compare(skills.map(s=>({...s,source:s.source as 'manual'|'cv'}))).noGaps)return {noGaps:true} as const;
   if(!skills.length&&!expected.introductoryPlanAcknowledged)throw new DomainError('ACKNOWLEDGMENT_REQUIRED','Acknowledge introductory planning without established skill evidence.');
  }
  mockConfiguration();
  const time=await now(tx);const deadline=new Date(Math.min(started+AI_LIMITS.totalMs,time.getTime()+AI_LIMITS.totalMs));
  if(deadline.getTime()-time.getTime()<3000)throw new DomainError('DEADLINE','Processing deadline reached.',504);
  await tx.aIOperation.updateMany({where:{userId:claims.id,state:'running',deadline:{lte:time}},data:{state:'expired',code:'DEADLINE'}});
  if(await tx.aIOperation.findFirst({where:{userId:claims.id,state:'running'}}))throw new DomainError('OPERATION_BUSY','Another operation is running. Check its status before retrying.',409);
  return {op:await tx.aIOperation.create({data:{userId:claims.id,kind,key,fingerprint:binding,sessionVersion:claims.sessionVersion,consentSequence:c.sequence,inputRevision:profile.planningRevision,catalogueRevision:global.revision,catalogueVersion:global.version,deadline,createdAt:time}}),replay:false};
 },transactionOptions);
}
async function fence(tx:Tx,claims:Claims,op:AIOperation){
 await access(tx,claims,true);const c=await consent(tx,claims,op.kind as Purpose);
 const current=await tx.aIOperation.findUnique({where:{id:op.id}});
 const time=await now(tx);
 if(!current||current.state!=='running'||current.fence!==op.fence||current.sessionVersion!==claims.sessionVersion||c.sequence!==op.consentSequence)throw new DomainError('OPERATION_CANCELLED','This operation is no longer authorized. Existing data is preserved.',409);
 if(time>=current.deadline)throw new DomainError('DEADLINE','Processing deadline reached. Existing data is preserved.',504);
 const global=await catalogueRevision(tx);
 if(global.revision!==op.catalogueRevision||global.version!==op.catalogueVersion)throw new DomainError('STALE_CATALOGUE','Catalogue changed during processing. Existing plan preserved.',409);
 const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
 assertRevision(profile.planningRevision,op.inputRevision);
 return {current,time};
}
async function reserve(client:PrismaClient,claims:Claims,op:AIOperation){
 const config=mockConfiguration();
 await client.$transaction(async tx=>{
  const {current,time}=await fence(tx,claims,op);
  if(current.attempts>=2)throw new DomainError('ATTEMPT_LIMIT','Both permitted attempts have been used.',502);
  if(op.deadline.getTime()-time.getTime()<5000)throw new DomainError('DEADLINE','Insufficient time for another attempt.',504);
  const count=await tx.aIAttempt.count({where:{operation:{userId:claims.id},reservedAt:{gt:new Date(time.getTime()-3600000)}}});
  if(count>=5)throw new DomainError('QUOTA_EXHAUSTED','Five attempts have been reserved in the last hour. Try after older attempts expire.',429);
  await tx.$queryRaw`SELECT id FROM "FundingBudget" WHERE id=${config.budgetId} FOR UPDATE`;
  const budget=await tx.fundingBudget.findUnique({where:{id:config.budgetId}});
  // MOCK units are deliberately not currency or a paid pricing estimate.
  if(!budget||budget.mode!=='mock'||budget.currency!=='MOCK'||budget.pricingVersion!=='mock-v1'||budget.expiresAt<=time||budget.reserved+1>budget.ceiling)throw new DomainError('FUNDING_STOP','Shared mock funding is missing, expired or exhausted. No request was dispatched.',503);
  await tx.fundingBudget.update({where:{id:budget.id},data:{reserved:{increment:1}}});
  await tx.aIAttempt.create({data:{operationId:op.id,budgetId:budget.id,reservedUnits:1,reservedAt:time}});
  await tx.aIOperation.update({where:{id:op.id},data:{attempts:{increment:1}}});
 },transactionOptions);
}
async function finishFailure(client:PrismaClient,claims:Claims,op:AIOperation,error:DomainError){
 await client.$transaction(async tx=>{
  await access(tx,claims,true);
  await tx.aIOperation.updateMany({where:{id:op.id,userId:claims.id,state:'running',fence:op.fence},data:{state:error.code==='DEADLINE'?'expired':error.status===422?'infeasible':'failed',code:error.code}});
 },transactionOptions).catch(()=>{}); // A deleted owner/DB outage leaves no resurrection path; expiry fences a stranded lease.
}
function safeError(error:unknown):DomainError{
 if(error instanceof DomainError)return error;
 if(error instanceof ZodError)return new DomainError('INVALID_OUTPUT','Provider response failed validation. Existing data is preserved.',502);
 return new DomainError('PROVIDER_UNAVAILABLE','Processing failed. Existing data is preserved; manual entry remains available.',503);
}
async function propose<T>(client:PrismaClient,claims:Claims,op:AIOperation,provider:AIProvider,input:ProviderInput,validate:(output:unknown)=>T):Promise<T>{
 for(let attempt=0;attempt<2;attempt++){
  await reserve(client,claims,op);
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const timeout=Math.min(AI_LIMITS.providerMs,op.deadline.getTime()-Date.now()-3000);
   const output=await Promise.race([provider.respond(input,controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new ProviderFailure('PROVIDER_UNAVAILABLE'))},Math.max(1,timeout));})]);
   if(JSON.stringify(output)?.length>AI_LIMITS.outputBytes)throw new DomainError('INVALID_OUTPUT','Provider output exceeds the configured limit.',502);
   return validate(output);
  }catch(error){
   const safe=safeError(error);
   const retryable=error instanceof ProviderFailure?error.retryable:error instanceof ZodError||['INVALID_OUTPUT','INVALID_EVIDENCE','INVALID_PLAN','DURATION_POLICY','CAPACITY'].includes(safe.code);
   if(attempt===1||!retryable)throw safe;
  }finally{clearTimeout(timer);controller.abort();}
 }
 throw new DomainError('ATTEMPT_LIMIT','Both attempts have been used.',502);
}
async function finishBeforeDeadline(tx:Tx,op:AIOperation,data:{roadmapId?:string;code:string}){
 // Last write uses the database wall clock. Reserve transaction/response margin, not merely model timeout.
 const rows=await tx.$queryRaw<{id:string}[]>`UPDATE "AIOperation" SET state='succeeded',code=${data.code},"roadmapId"=${data.roadmapId??null} WHERE id=${op.id} AND fence=${op.fence} AND state='running' AND deadline > (clock_timestamp() AT TIME ZONE 'UTC') + interval '2 seconds' RETURNING id`;
 if(rows.length!==1)throw new DomainError('DEADLINE','Activation deadline reached. Previous plan preserved.',504);
}
export async function generateRoadmap(client:PrismaClient,claims:Claims,input:unknown,provider:AIProvider=mockProvider){
 const started=Date.now();const body=generateSchema.parse(input);
 const result=await begin(client,claims,'roadmap_generation',body.operationKey,createHash('sha256').update(JSON.stringify(body)).digest('hex'),started,body);
 if('noGaps' in result)return {code:'NO_GAPS',operation:null,state:await getState(client,claims)};
 const {op,replay}=result;
 if(replay)return {code:op.state==='succeeded'?'REPLAY':op.code,operation:metadata(op),state:await getState(client,claims)};
 try{
  const snapshot=await getState(client,claims);assertRevision(snapshot.profile.planningRevision,op.inputRevision);
  const plan=await propose(client,claims,op,provider,{kind:'roadmap_generation',profile:{hoursPerWeek:snapshot.profile.hoursPerWeek},skills:snapshot.skills.filter(s=>s.canonicalSkillId).map(s=>({canonicalSkillId:s.canonicalSkillId}))},output=>validateRoadmapOutput(output,snapshot.profile,snapshot.skills));
  await client.$transaction(async tx=>{
   await fence(tx,claims,op);
   await tx.roadmap.updateMany({where:{userId:claims.id,status:'active'},data:{status:'archived'}});
   const roadmap=await tx.roadmap.create({data:{userId:claims.id,inputRevision:op.inputRevision,catalogueVersion:op.catalogueVersion,createdAt:await now(tx),deferredSkillIds:plan.deferredSkillIds,modelVersion:provider.model,promptVersion:'mock-contract-v1',planningSnapshot:{hoursPerWeek:snapshot.profile.hoursPerWeek,confirmedSkillIds:snapshot.skills.flatMap(s=>s.canonicalSkillId?[s.canonicalSkillId]:[])},tasks:{create:plan.tasks.map((task,position)=>({...task,position}))}}});
   await finishBeforeDeadline(tx,op,{roadmapId:roadmap.id,code:'MOCK_PLAN_SAVED'});
  },transactionOptions);
  return {code:'MOCK_PLAN_SAVED',operation:await operationStatus(client,claims,op.id),state:await getState(client,claims)};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}
export async function extractSkills(client:PrismaClient,claims:Claims,bytes:Uint8Array,key:unknown,provider:AIProvider=mockProvider){
 const started=Date.now();const operationKey=z.string().uuid().parse(key);
 if(bytes.length>AI_LIMITS.bytes)throw new DomainError('PDF_BYTE_LIMIT','Use a PDF no larger than 2 MiB.',413);
 const result=await begin(client,claims,'cv_extraction',operationKey,fingerprint(bytes),started);
 if('noGaps' in result)throw new DomainError('INVALID_OPERATION','Invalid extraction operation.');
 const {op,replay}=result;
 if(replay)return {code:'EXTRACTION_STATUS_ONLY',operation:metadata(op),candidates:[],warnings:['Extraction evidence is not stored. Deliberately upload again with a new key or enter skills manually.']};
 try{
  const parsed=await parsePdf(bytes,op.deadline.getTime());
  const state=await getState(client,claims);
  const text=minimizeText(parsed.text,[claims.email,state.name,...state.name.split(/\s+/).filter(n=>n.length>2)]);
  const candidates=await propose(client,claims,op,provider,{kind:'cv_extraction',text},output=>validateExtraction(output,text));
  await client.$transaction(async tx=>{await fence(tx,claims,op);await finishBeforeDeadline(tx,op,{code:candidates.length?'CANDIDATES_READY':'NO_EVIDENCE'});},transactionOptions);
  // A final access/consent check before temporary evidence delivery, including revoke/re-grant.
  await client.$transaction(async tx=>{await access(tx,claims,true);const c=await consent(tx,claims,'cv_extraction');if(c.sequence!==op.consentSequence)throw new DomainError('CONSENT_REQUIRED','Consent changed; extraction evidence has been discarded.',403);},transactionOptions);
  return {code:candidates.length?'CANDIDATES_READY':'NO_EVIDENCE',operation:await operationStatus(client,claims,op.id),candidates:candidates.map(c=>({...c,candidateReference:signCandidate(claims,op.consentSequence,op.id,c.skillId,c.label)})),warnings:[...parsed.warnings,'Mock extraction; synthetic inputs only. Review each candidate. Identification removal is limited and does not guarantee anonymity.']};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}
