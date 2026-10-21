import { z, ZodError } from 'zod';
import { createHash } from 'node:crypto';
import type { PrismaClient, AIOperation } from '../generated/prisma/client';
import { access, getState, type Claims, type Tx } from './store';
import { catalogue } from './catalogue';
import { assertRevision, compare, DomainError, generateSchema } from './domain';
import { AI_LIMITS, signingSecret } from './ai-config';
import { executionConfiguration, assertGroqDispatch, assertGroqWorkflow, processingDisclosure } from './ai-execution';
import { createGroqProvider } from './groq-provider';
import { providerRequest, PROVIDER_PROMPT_VERSION } from './ai-provider-request';
import { fingerprint, signCandidate } from './candidate-origin';
import { validateExtraction, validateRoadmapOutput } from './ai-output';
import { mockProvider, ProviderFailure, timedProviderResponse, providerAttemptTimeout, type AIProvider, type ProviderInput } from './ai-provider';
import { parsePdf } from './pdf';
import { prepareCvText } from './cv-text';
import type { Purpose } from './types';
import { capabilityLibrary, reviewedPathwayVocabulary, storedSuggestionsSchema, suggestPathwaysSchema, validatePathwaySuggestions } from './pathways';
import { selectedDirectionComparison, selectedDirectionPlanning } from './reviewed-direction';
import { resourcePreviewRequestSchema, storedResourcePreviewSchema, storedResourcePreviewsSchema, validateResearchEnvelope, validateMockResourcePreview } from './resource-preview';
import { resourceSelectionSchema, researchedSelectionSchema, validateDiscoveredPair } from './resource-discovery';
import { inspectResourcePages, verifiedResourceChecks } from './resource-page-verifier';
import { activeRequirementSnapshot } from './requirement-snapshots';
import { reviewedResourceRequestSchema, reviewedResourcePreviewSchema, reviewedResourcePreviewsSchema } from './reviewed-resources';
import { validateReviewedPlan } from './reviewed-roadmap';

// Every mutation takes invitation -> user -> catalogue -> funding locks in that order.
// No transaction stays open during parsing or provider work.
const transactionOptions={maxWait:2000,timeout:3000};
// Prisma DateTime uses timestamp without time zone. Explicit UTC avoids driver/session-zone reinterpretation.
async function now(tx:Tx){const [row]=await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS now`;return row.now;}
async function consent(tx:Tx,claims:Claims,kind:Purpose){
 const c=await tx.consent.findFirst({where:{userId:claims.id,purpose:kind},orderBy:{sequence:'desc'}});
 if(!c?.granted||c.policyVersion!==(await processingDisclosure(tx)).policyVersion)throw new DomainError('CONSENT_REQUIRED','Enable current consent for this purpose in Privacy & settings.',403);
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
async function begin(client:PrismaClient,claims:Claims,kind:Purpose|'pathway_suggestions'|'resource_research',key:string,binding:string,started:number,expected?:z.infer<typeof generateSchema>,planningOnly=false,resource?:{suggestionId?:string;topicId:string;reviewed?:boolean}){
 return client.$transaction(async tx=>{
  await access(tx,claims,true);
  // Publication takes global revision before active requirements. Use the same
  // order before any reviewed comparison to avoid an activation/start deadlock.
  const global=await catalogueRevision(tx);
  const reviewed=expected?await tx.reviewedDirection.findUnique({where:{userId:claims.id}}):null;
  if(expected&&reviewed){
   const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
   assertRevision(profile.planningRevision,expected.expectedPlanningRevision);
   if(kind==='roadmap_generation'){
    const comparison=await selectedDirectionComparison(tx,claims.id);
    if(comparison?.outcome==='no_gaps')return {noGaps:true} as const;
    if(comparison?.reconfirmationIds.length)throw new DomainError('SKILL_REVIEW_REQUIRED','Confirm changed skill meanings before planning.',409);
   }
   if(planningOnly&&!resource?.reviewed)throw new DomainError('DIRECTION_SELECTED','Clear the saved reviewed direction before requesting provisional exploration.',409);
  }
  const c=await consent(tx,claims,kind==='pathway_suggestions'||kind==='resource_research'?'roadmap_generation':kind);
  const existing=await tx.aIOperation.findUnique({where:{userId_kind_key:{userId:claims.id,kind,key}}});
  if(existing){
   if(existing.fingerprint!==binding)throw new DomainError('KEY_CONFLICT','This operation key belongs to different input. Use a new key for a deliberate retry.',409);
   if(existing.state==='running'&&existing.deadline<=await now(tx))return {op:await tx.aIOperation.update({where:{id:existing.id},data:{state:'expired',code:'DEADLINE'}}),replay:true};
   return {op:existing,replay:true};
  }
  const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
  if(expected){
   assertRevision(profile.planningRevision,expected.expectedPlanningRevision);
   if(expected.expectedCatalogueVersion!==global.version)throw new DomainError('STALE_CATALOGUE','Refresh the current catalogue.',409);
   if(!profile.confirmed||!profile.inventoryConfirmed)throw new DomainError('ONBOARDING_REQUIRED','Save your profile and confirm your skills first.');
   const exploration=await tx.pathwayExploration.findUnique({where:{userId:claims.id}});
   if(exploration?.selectedSuggestionId&&kind!=='resource_research')throw new DomainError(planningOnly?'DIRECTION_SELECTED':'CONTENT_REVIEW_REQUIRED',planningOnly?'Clear the saved provisional direction before requesting new suggestions.':'This direction has no reviewed requirement set yet. Your existing plan is preserved.',409);
   if(kind==='resource_research'&&resource?.reviewed){
    const comparison=await selectedDirectionComparison(tx,claims.id);
    if(!comparison)throw new DomainError('DIRECTION_REQUIRED','Save a reviewed direction before researching resources.',409);
    if(comparison.reconfirmationIds.length)throw new DomainError('SKILL_REVIEW_REQUIRED','Confirm changed skill meanings before resource research.',409);
    if(![...comparison.mandatoryGapIds,...comparison.optionalGapIds].includes(resource.topicId))throw new DomainError('UNKNOWN_TOPIC','Choose a retained learning need from your saved direction.',400);
   }else if(kind==='resource_research'){
    if(!resource||!exploration?.selectedSuggestionId||exploration.selectedSuggestionId!==resource.suggestionId)
     throw new DomainError('DIRECTION_REQUIRED','Select one of your saved QA directions before researching a topic.',409);
    if(exploration.inputRevision!==profile.planningRevision||exploration.libraryVersion!==capabilityLibrary.version)
     throw new DomainError('STALE_INPUT','Refresh your saved direction before researching resources.',409);
    const direction=storedSuggestionsSchema.parse(exploration.suggestions).find(item=>item.id===resource.suggestionId);
    if(!direction?.capabilityIds.includes(resource.topicId)||!capabilityLibrary.capabilities.some(item=>item.id===resource.topicId))
     throw new DomainError('UNKNOWN_TOPIC','Choose a server-owned topic from your selected direction.',400);
   }
   const skills=await tx.confirmedSkill.findMany({where:{userId:claims.id}});
   if(!planningOnly&&!reviewed&&compare(skills.map(s=>({...s,source:s.source as 'manual'|'cv'}))).noGaps)return {noGaps:true} as const;
   if(!planningOnly&&!skills.length&&!expected.introductoryPlanAcknowledged)throw new DomainError('ACKNOWLEDGMENT_REQUIRED','Acknowledge introductory planning without established skill evidence.');
  }
  signingSecret();const config=await executionConfiguration(tx);
  if(reviewed&&kind==='roadmap_generation'){
   if(config.mode==='groq')assertGroqWorkflow(config);
   await selectedDirectionPlanning(tx,claims.id);
  }
  if(planningOnly&&config.mode==='groq'){
   assertGroqWorkflow(config);
   if(kind==='resource_research'&&!resource?.reviewed)throw new DomainError('RESOURCE_LIVE_DISABLED','Select a reviewed direction before live resource research.',503);
   if(kind==='pathway_suggestions'&&!await activeRequirementSnapshot(tx))throw new DomainError('CONTENT_REVIEW_REQUIRED','Reviewed capabilities must be active before live direction suggestions.',409);
  }
  const time=await now(tx);const deadline=new Date(Math.min(started+AI_LIMITS.totalMs,time.getTime()+AI_LIMITS.totalMs));
  if(config.mode==='groq')assertGroqDispatch(config,time);
  if(deadline.getTime()-time.getTime()<3000)throw new DomainError('DEADLINE','Processing deadline reached.',504);
  await tx.aIOperation.updateMany({where:{userId:claims.id,state:'running',deadline:{lte:time}},data:{state:'expired',code:'DEADLINE'}});
  if(await tx.aIOperation.findFirst({where:{userId:claims.id,state:'running'}}))throw new DomainError('OPERATION_BUSY','Another operation is running. Check its status before retrying.',409);
  return {op:await tx.aIOperation.create({data:{userId:claims.id,kind,key,fingerprint:binding,sessionVersion:claims.sessionVersion,consentSequence:c.sequence,inputRevision:profile.planningRevision,catalogueRevision:global.revision,catalogueVersion:global.version,deadline,createdAt:time,configurationVersion:config.version,budgetId:config.budgetId}}),replay:false};
 },transactionOptions);
}
async function fence(tx:Tx,claims:Claims,op:AIOperation){
 await access(tx,claims,true);const c=await consent(tx,claims,op.kind==='pathway_suggestions'||op.kind==='resource_research'?'roadmap_generation':op.kind as Purpose);
 const current=await tx.aIOperation.findUnique({where:{id:op.id}});
 const time=await now(tx);
 if(!current||current.state!=='running'||current.fence!==op.fence||current.sessionVersion!==claims.sessionVersion||c.sequence!==op.consentSequence)throw new DomainError('OPERATION_CANCELLED','This operation is no longer authorized. Existing data is preserved.',409);
 if(time>=current.deadline)throw new DomainError('DEADLINE','Processing deadline reached. Existing data is preserved.',504);
 const global=await catalogueRevision(tx);
 if(global.revision!==op.catalogueRevision||global.version!==op.catalogueVersion)throw new DomainError('STALE_CATALOGUE','Catalogue changed during processing. Existing plan preserved.',409);
 const profile=await tx.profile.findUniqueOrThrow({where:{userId:claims.id}});
 assertRevision(profile.planningRevision,op.inputRevision);
 const initial=await executionConfiguration(tx);
 await tx.$queryRaw`SELECT id FROM "FundingBudget" WHERE id=${initial.budgetId} FOR UPDATE`;
 const config=await executionConfiguration(tx);
 if(config.version!==op.configurationVersion||config.budgetId!==op.budgetId)throw new DomainError('STALE_CONFIGURATION','AI configuration changed. Previous data is preserved.',409);
 const checkedTime=await now(tx);
 if(checkedTime>=current.deadline)throw new DomainError('DEADLINE','Processing deadline reached. Existing data is preserved.',504);
 if(config.mode==='groq')assertGroqDispatch(config,checkedTime);
 return {current,time:checkedTime,config};
}
async function reserve(client:PrismaClient,claims:Claims,op:AIOperation){
 return client.$transaction(async tx=>{
  const {current,time,config}=await fence(tx,claims,op);
  if(current.attempts>=2)throw new DomainError('ATTEMPT_LIMIT','Both permitted attempts have been used.',502);
  if(op.deadline.getTime()-time.getTime()<5000)throw new DomainError('DEADLINE','Insufficient time for another attempt.',504);
  const count=await tx.aIAttempt.count({where:{operation:{userId:claims.id},reservedAt:{gt:new Date(time.getTime()-3600000)}}});
  if(count>=5)throw new DomainError('QUOTA_EXHAUSTED','Five attempts have been reserved in the last hour. Try after older attempts expire.',429);
  const budget=await tx.fundingBudget.findUnique({where:{id:config.budgetId}});
  const currency=config.mode==='mock'?'MOCK':'REQUESTS';
  if(!budget||!budget.enabled||budget.mode!==config.mode||budget.currency!==currency||budget.pricingVersion!==config.version||budget.expiresAt<=time||budget.reserved+config.units>budget.ceiling)throw new DomainError('FUNDING_STOP','Shared funding is missing, expired or exhausted. No request was dispatched.',503);
  await tx.fundingBudget.update({where:{id:budget.id},data:{reserved:{increment:config.units}}});
  await tx.aIAttempt.create({data:{operationId:op.id,budgetId:budget.id,reservedUnits:config.units,reservedAt:time}});
  await tx.aIOperation.update({where:{id:op.id},data:{attempts:{increment:1}}});
  return config;
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
async function propose<T>(client:PrismaClient,claims:Claims,op:AIOperation,provider:AIProvider,input:ProviderInput,validate:(output:unknown)=>T,attemptLimit=2):Promise<T>{
 provider.checkInput?.(input);
 const config=await client.$transaction(tx=>executionConfiguration(tx),transactionOptions);
 if(config.mode==='groq'){
  const request=providerRequest(input);
  if(Buffer.byteLength(JSON.stringify(request))>config.pilot.maxRequestBytes)throw new DomainError('PROVIDER_INPUT_LIMIT','Minimized provider input exceeds the approved byte ceiling. Use manual entry or a smaller CV.',422);
 }
 let request=input;
 for(let attempt=0;attempt<attemptLimit;attempt++){
  provider.checkInput?.(request);
  providerAttemptTimeout(request,op.deadline.getTime()-Date.now());
  await reserve(client,claims,op);
  try{
   const timeout=providerAttemptTimeout(request,op.deadline.getTime()-Date.now());
   const output=await timedProviderResponse(provider,request,timeout);
   if(Buffer.byteLength(JSON.stringify(output)??'')>AI_LIMITS.outputBytes)throw new DomainError('INVALID_OUTPUT','Provider output exceeds the configured limit.',502);
   return validate(output);
  }catch(error){
   const safe=safeError(error);
   const retryable=error instanceof ProviderFailure?error.retryable:error instanceof ZodError||['INVALID_OUTPUT','INVALID_EVIDENCE','INVALID_PLAN','UNVERIFIED_INFEASIBLE','DURATION_POLICY','CAPACITY'].includes(safe.code);
   if(attempt===attemptLimit-1||!retryable)throw safe;
   if(input.kind==='cv_extraction'&&(error instanceof ZodError||['INVALID_OUTPUT','INVALID_EVIDENCE'].includes(safe.code)))request={...input,correction:error instanceof ZodError?'INVALID_OUTPUT':safe.code};
   if(input.kind==='reviewed_roadmap'&&(error instanceof ZodError||['INVALID_PLAN','UNVERIFIED_INFEASIBLE'].includes(safe.code)))request={...input,correction:error instanceof ZodError?'INVALID_OUTPUT':safe.code};
  }
 }
 throw new DomainError('ATTEMPT_LIMIT','Both attempts have been used.',502);
}
async function finishBeforeDeadline(tx:Tx,op:AIOperation,data:{roadmapId?:string;code:string}){
 // Last write uses the database wall clock. Reserve transaction/response margin, not merely model timeout.
 const rows=await tx.$queryRaw<{id:string}[]>`UPDATE "AIOperation" SET state='succeeded',code=${data.code},"roadmapId"=${data.roadmapId??null} WHERE id=${op.id} AND fence=${op.fence} AND state='running' AND deadline > (clock_timestamp() AT TIME ZONE 'UTC') + interval '2 seconds' RETURNING id`;
 if(rows.length!==1)throw new DomainError('DEADLINE','Activation deadline reached. Previous plan preserved.',504);
}
async function selectProvider(client:PrismaClient,override?:AIProvider){
 const config=await client.$transaction(tx=>executionConfiguration(tx),transactionOptions);
 if(config.mode==='mock')return override??mockProvider;
 if(override){if(override.model!==config.pilot.model)throw new DomainError('AI_CONFIGURATION','Provider does not match approved model.',503);return override;}
 return createGroqProvider({apiKey:process.env.GROQ_API_KEY!,model:config.pilot.model,maxOutputTokens:config.pilot.maxOutputTokens,maxRequestBytes:config.pilot.maxRequestBytes,
  planningApprovalReference:config.pilot.workflow?.approvalReference,nativeResearch:config.pilot.workflow?{approvalReference:config.pilot.workflow.approvalReference,maxNativeToolCalls:config.pilot.workflow.maxReportedToolCalls}:undefined});
}
export async function generateRoadmap(client:PrismaClient,claims:Claims,input:unknown,provider?:AIProvider){
 const started=Date.now();const body=generateSchema.parse(input);
 const result=await begin(client,claims,'roadmap_generation',body.operationKey,createHash('sha256').update(JSON.stringify(body)).digest('hex'),started,body);
 if('noGaps' in result)return {code:'NO_GAPS',operation:null,state:await getState(client,claims)};
 const {op,replay}=result;
 if(replay)return {code:op.state==='succeeded'?'REPLAY':op.code,operation:metadata(op),state:await getState(client,claims)};
 try{
  const selected=await selectProvider(client,provider);const code=op.configurationVersion==='mock-v1'?'MOCK_PLAN_SAVED':'PLAN_SAVED';
  const snapshot=await getState(client,claims);assertRevision(snapshot.profile.planningRevision,op.inputRevision);
  const reviewed=await client.$transaction(async tx=>{await access(tx,claims,true);return selectedDirectionPlanning(tx,claims.id);},transactionOptions);
  const plan=reviewed
   ?await propose(client,claims,op,selected,{kind:'reviewed_roadmap',context:reviewed.context},output=>validateReviewedPlan(reviewed.context,output))
   :await propose(client,claims,op,selected,{kind:'roadmap_generation',profile:{hoursPerWeek:snapshot.profile.hoursPerWeek},skills:snapshot.skills.filter(s=>s.canonicalSkillId).map(s=>({canonicalSkillId:s.canonicalSkillId}))},output=>validateRoadmapOutput(output,snapshot.profile,snapshot.skills));
  await client.$transaction(async tx=>{
   await fence(tx,claims,op);
   if(reviewed){const current=await selectedDirectionPlanning(tx,claims.id);if(!current||JSON.stringify(current)!==JSON.stringify(reviewed))throw new DomainError('STALE_INPUT','Reviewed planning inputs or resources changed during generation.',409);}
   await tx.roadmap.updateMany({where:{userId:claims.id,status:'active'},data:{status:'archived'}});
   const planningSnapshot=reviewed?{kind:'reviewed-direction-v1',mode:op.configurationVersion==='mock-v1'?'mock':'groq',directionLabel:reviewed.directionLabel,context:reviewed.context,resources:reviewed.resources}:{hoursPerWeek:snapshot.profile.hoursPerWeek,confirmedSkillIds:snapshot.skills.flatMap(s=>s.canonicalSkillId?[s.canonicalSkillId]:[])};
   const roadmap=await tx.roadmap.create({data:{userId:claims.id,inputRevision:op.inputRevision,catalogueVersion:op.catalogueVersion,createdAt:await now(tx),deferredSkillIds:plan.deferredSkillIds,modelVersion:selected.model,promptVersion:reviewed?'reviewed-roadmap-v1':PROVIDER_PROMPT_VERSION,planningSnapshot,tasks:{create:plan.tasks.map((task,position)=>({...task,position}))}}});
   await finishBeforeDeadline(tx,op,{roadmapId:roadmap.id,code});
  },transactionOptions);
  return {code,operation:await operationStatus(client,claims,op.id),state:await getState(client,claims)};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}
export async function suggestPathways(client:PrismaClient,claims:Claims,input:unknown,provider?:AIProvider){
 const started=Date.now();const body=suggestPathwaysSchema.parse(input);
 const initial=await getState(client,claims);
 if(!initial.pathwayExploration)throw new DomainError('PREFERENCES_REQUIRED','Save your interests and work preferences before requesting suggestions.');
 const active=initial.processing?.mode==='groq'?await client.$transaction(async tx=>{await access(tx,claims,true);return activeRequirementSnapshot(tx);},transactionOptions):null;
 const vocabulary=active?reviewedPathwayVocabulary(active.library):capabilityLibrary;
 const fingerprint=createHash('sha256').update(JSON.stringify({body,libraryVersion:vocabulary.version})).digest('hex');
 const result=await begin(client,claims,'pathway_suggestions',body.operationKey,fingerprint,started,{...body,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false},true);
 if('noGaps' in result)throw new DomainError('INVALID_OPERATION','Invalid suggestion operation.');
 const {op,replay}=result;
 if(replay)return {code:op.state==='succeeded'?'REPLAY':op.code,operation:metadata(op),state:await getState(client,claims)};
 try{
  const snapshot=await getState(client,claims);assertRevision(snapshot.profile.planningRevision,op.inputRevision);
  const preferences=snapshot.pathwayExploration!.preferences;
  const live=op.configurationVersion!=='mock-v1';
  const confirmedSkillIds=live?await client.$transaction(async tx=>{
   await fence(tx,claims,op);const current=await activeRequirementSnapshot(tx);
   if(!current||current.library.version!==vocabulary.version)throw new DomainError('STALE_REQUIREMENTS','Reviewed suggestion inputs changed.',409);
   const rows=await tx.confirmedSkill.findMany({where:{userId:claims.id},include:{capabilityConfirmation:true}});
   return [...new Set(rows.flatMap(row=>{const c=row.capabilityConfirmation;return c&&current.library.capabilities.some(item=>item.id===c.capabilityId&&item.meaningVersion===c.meaningVersion)?[c.capabilityId]:[];}))];
  },transactionOptions):snapshot.skills.flatMap(skill=>skill.canonicalSkillId?[skill.canonicalSkillId]:[]);
  const selected=await selectProvider(client,provider);
  const suggestions=await propose(client,claims,op,selected,{kind:'pathway_suggestions',preferences,confirmedSkillIds,hoursPerWeek:snapshot.profile.hoursPerWeek,...(live?{library:vocabulary}:{})},output=>validatePathwaySuggestions(output,confirmedSkillIds,vocabulary).map(item=>({...item,generationMode:live?'groq' as const:'mock' as const})));
  await client.$transaction(async tx=>{
   await fence(tx,claims,op);
   await tx.pathwayExploration.update({where:{userId:claims.id},data:{suggestions,inputRevision:op.inputRevision,libraryVersion:vocabulary.version,operationId:op.id}});
   await finishBeforeDeadline(tx,op,{code:'PATHWAYS_READY'});
  },transactionOptions);
  return {code:'PATHWAYS_READY',operation:await operationStatus(client,claims,op.id),state:await getState(client,claims)};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}

export async function researchResourcePreview(client:PrismaClient,claims:Claims,input:unknown,provider?:AIProvider){
 const started=Date.now();const body=resourcePreviewRequestSchema.parse(input);
 const binding=createHash('sha256').update(JSON.stringify({...body,libraryVersion:capabilityLibrary.version})).digest('hex');
 const result=await begin(client,claims,'resource_research',body.operationKey,binding,started,{...body,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false},true,body);
 if('noGaps' in result)throw new DomainError('INVALID_OPERATION','Invalid research operation.');
 const {op,replay}=result;
 if(replay)return {code:op.state==='succeeded'?'REPLAY':op.code,operation:metadata(op),state:await getState(client,claims)};
 try{
  const snapshot=await getState(client,claims);assertRevision(snapshot.profile.planningRevision,op.inputRevision);
  const direction=snapshot.pathwayExploration!.suggestions.find(item=>item.id===body.suggestionId)!;
  const topic=capabilityLibrary.capabilities.find(item=>item.id===body.topicId)!;
  const context={pathwayId:direction.id,pathwayTitle:direction.title,topicId:topic.id,topicTitle:topic.label};
  const selected=await selectProvider(client,provider);
  // Native research and structured selection each reserve a separate attempt.
  // A failure does not trigger a hidden retry/third call; deliberate new-key retry only.
  const envelope=await propose(client,claims,op,selected,{kind:'resource_research',phase:'search',context},validateResearchEnvelope,1);
  const selection=await propose(client,claims,op,selected,{kind:'resource_research',phase:'select',context,candidates:envelope.candidates},output=>resourceSelectionSchema.parse(output),1);
  const pair=validateMockResourcePreview(context,envelope,selection);
  const preview=storedResourcePreviewSchema.parse({...pair,mode:'mock',model:selected.model,inputRevision:op.inputRevision,libraryVersion:capabilityLibrary.version,operationId:op.id});
  await client.$transaction(async tx=>{
   await fence(tx,claims,op);
   const row=await tx.pathwayExploration.findUniqueOrThrow({where:{userId:claims.id}});
   const previous=storedResourcePreviewsSchema.parse(row.resourcePreviews);
   const previews=storedResourcePreviewsSchema.parse([...previous.filter(item=>item.inputRevision===op.inputRevision&&item.topicId!==topic.id),preview]);
   await tx.pathwayExploration.update({where:{userId:claims.id},data:{resourcePreviews:previews}});
   await finishBeforeDeadline(tx,op,{code:'MOCK_RESOURCES_READY'});
  },transactionOptions);
  return {code:'MOCK_RESOURCES_READY',operation:await operationStatus(client,claims,op.id),state:await getState(client,claims)};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}

export async function researchReviewedResources(client:PrismaClient,claims:Claims,input:unknown,provider?:AIProvider,inspectPages=inspectResourcePages){
 const started=Date.now();const body=reviewedResourceRequestSchema.parse(input);
 const binding=createHash('sha256').update(JSON.stringify({scope:'reviewed-direction',...body})).digest('hex');
 const result=await begin(client,claims,'resource_research',body.operationKey,binding,started,{...body,expectedCatalogueVersion:catalogue.version,introductoryPlanAcknowledged:false},true,{topicId:body.topicId,reviewed:true});
 if('noGaps' in result)throw new DomainError('INVALID_OPERATION','Invalid resource operation.');
 const {op,replay}=result;
 if(replay)return {code:op.state==='succeeded'?'REPLAY':op.code,operation:metadata(op),state:await getState(client,claims)};
 try{
  const comparison=await client.$transaction(async tx=>{await access(tx,claims,true);return selectedDirectionComparison(tx,claims.id);},transactionOptions);
  if(!comparison)throw new DomainError('STALE_INPUT','The reviewed selection changed.',409);
  assertRevision(comparison.planningRevision,op.inputRevision);
  const topic=comparison.requirements.find(item=>item.id===body.topicId&&item.evidence==='not_established');
  if(!topic)throw new DomainError('STALE_INPUT','The selected topic is no longer a learning need.',409);
  const live=op.configurationVersion!=='mock-v1';
  const sourceContext=live?await client.$transaction(async tx=>{await fence(tx,claims,op);const current=await activeRequirementSnapshot(tx);const node=current?.library.capabilities.find(item=>item.id===topic.id);if(!current||!node)throw new DomainError('STALE_REQUIREMENTS','Reviewed topic changed.',409);return {officialDocumentationHosts:[...new Set(current.library.sources.filter(item=>node.sourceIds.includes(item.id)).map(item=>new URL(item.url).hostname))],officialDocumentationSources:current.library.sources.filter(item=>node.sourceIds.includes(item.id)).map(item=>item.url),topicTerms:[node.label,...node.aliases],...(node.scope?{learningScope:{includes:node.scope.includes,excludes:node.scope.excludes,startingKnowledge:node.scope.startingKnowledge}}:{})};},transactionOptions):{};
  const context={pathwayId:comparison.directionId,pathwayTitle:comparison.directionLabel,topicId:topic.id,topicTitle:topic.label,...sourceContext};
  const selected=await selectProvider(client,provider);
  const envelope=await propose(client,claims,op,selected,{kind:'resource_research',phase:'search',context},validateResearchEnvelope,1);
  await client.$transaction(tx=>fence(tx,claims,op),transactionOptions);
  const pages=live?await inspectPages(context,envelope.candidates,AbortSignal.timeout(Math.max(1,op.deadline.getTime()-Date.now()-3000))):undefined;
  const usableCandidates=pages?envelope.candidates.filter(candidate=>pages.some(page=>page.candidateId===candidate.id)):envelope.candidates;
  const selection=await propose(client,claims,op,selected,{kind:'resource_research',phase:'select',context,candidates:usableCandidates,...(pages?{pages}:{})},output=>pages?researchedSelectionSchema.parse(output):resourceSelectionSchema.parse(output),1);
  const pair=pages?validateDiscoveredPair(context,envelope.results,{documentationId:selection.documentationId,supportingId:selection.supportingId},verifiedResourceChecks(context,envelope.candidates,pages,selection),envelope.sources):validateMockResourcePreview(context,envelope,selection);
  const code=live?'RESOURCES_READY':'MOCK_REVIEWED_RESOURCES_READY';
  const preview=reviewedResourcePreviewSchema.parse({...pair,mode:live?'groq':'mock',model:selected.model,inputRevision:op.inputRevision,libraryVersion:comparison.libraryVersion,requirementSetId:comparison.requirementSetId,operationId:op.id});
  await client.$transaction(async tx=>{
   await fence(tx,claims,op);
   const current=await selectedDirectionComparison(tx,claims.id);
   if(current?.requirementSetId!==comparison.requirementSetId)throw new DomainError('STALE_INPUT','Reviewed requirements changed during research.',409);
   const row=await tx.reviewedDirection.findUniqueOrThrow({where:{userId:claims.id}});
   const old=reviewedResourcePreviewsSchema.parse(row.resourcePreviews);
   const resourcePreviews=reviewedResourcePreviewsSchema.parse([...old.filter(item=>item.inputRevision===op.inputRevision&&item.topicId!==topic.id),preview]);
   await tx.reviewedDirection.update({where:{userId:claims.id},data:{resourcePreviews}});
   await finishBeforeDeadline(tx,op,{code});
  },transactionOptions);
  return {code,operation:await operationStatus(client,claims,op.id),state:await getState(client,claims)};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}

export async function extractSkills(client:PrismaClient,claims:Claims,bytes:Uint8Array,key:unknown,provider?:AIProvider){
 const started=Date.now();const operationKey=z.string().uuid().parse(key);
 if(bytes.length>AI_LIMITS.bytes)throw new DomainError('PDF_BYTE_LIMIT','Use a PDF no larger than 2 MiB.',413);
 const result=await begin(client,claims,'cv_extraction',operationKey,fingerprint(bytes),started);
 if('noGaps' in result)throw new DomainError('INVALID_OPERATION','Invalid extraction operation.');
 const {op,replay}=result;
 if(replay)return {code:'EXTRACTION_STATUS_ONLY',operation:metadata(op),candidates:[],warnings:['Extraction evidence is not stored. Deliberately upload again with a new key or enter skills manually.']};
 try{
  const selected=await selectProvider(client,provider);
  const parsed=await parsePdf(bytes,op.deadline.getTime());
  const state=await getState(client,claims);
  const prepared=prepareCvText(parsed.text,[claims.email,state.name,...state.name.split(/\s+/).filter(n=>n.length>2)]);
  const candidates=await propose(client,claims,op,selected,{kind:'cv_extraction',text:prepared.text,blocks:prepared.blocks},output=>validateExtraction(output,prepared.text,prepared.blocks));
  await client.$transaction(async tx=>{await fence(tx,claims,op);await finishBeforeDeadline(tx,op,{code:candidates.length?'CANDIDATES_READY':'NO_EVIDENCE'});},transactionOptions);
  // A final access/consent check before temporary evidence delivery, including revoke/re-grant.
  await client.$transaction(async tx=>{await access(tx,claims,true);const c=await consent(tx,claims,'cv_extraction');if(c.sequence!==op.consentSequence)throw new DomainError('CONSENT_REQUIRED','Consent changed; extraction evidence has been discarded.',403);},transactionOptions);
  return {code:candidates.length?'CANDIDATES_READY':'NO_EVIDENCE',operation:await operationStatus(client,claims,op.id),candidates:candidates.map(c=>({...c,candidateReference:signCandidate(claims,op.consentSequence,op.id,c.skillId,c.label)})),warnings:[...parsed.warnings,...prepared.warnings,`${op.configurationVersion==='mock-v1'?'Mock':'Groq'} extraction; synthetic inputs only. Review each candidate. Identification removal is limited and does not guarantee anonymity.`]};
 }catch(error){const safe=safeError(error);await finishFailure(client,claims,op,safe);throw safe;}
}
