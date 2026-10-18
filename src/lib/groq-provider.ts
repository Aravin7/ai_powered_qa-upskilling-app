import { AI_LIMITS } from './ai-config';
import { GROQ_MODEL } from './ai-execution';
import { ProviderFailure, type AIProvider, type ProviderInput } from './ai-provider';
import { providerRequest } from './ai-provider-request';
import { DomainError } from './domain';

type Options={apiKey:string;model:string;maxOutputTokens?:number;maxRequestBytes?:number;fetchImpl?:typeof fetch};
const strings={type:'array',items:{type:'string'}};
const extractionSchema={type:'object',additionalProperties:false,required:['skills'],properties:{skills:{type:'array',items:{
 type:'object',additionalProperties:false,required:['skillId','label','evidenceExcerpt','sourceId'],
 properties:{skillId:{type:['string','null']},label:{type:'string'},evidenceExcerpt:{type:'string'},sourceId:{type:['string','null']}},
}}}};
// Use a closed root object. Cross-field conditions and all size/business limits remain server validated.
const roadmapSchema={type:'object',additionalProperties:false,required:['outcome','reason','constraintCode','deferredSkillIds','tasks'],properties:{
 outcome:{type:'string',enum:['plan','infeasible']},reason:{type:['string','null']},
 constraintCode:{type:['string','null'],enum:['duration_policy','capacity','prerequisite_or_content','undetermined',null]},
 deferredSkillIds:strings,tasks:{type:'array',items:{type:'object',additionalProperties:false,
 required:['week','kind','title','activity','completionCriterion','skillIds','resourceIds','estimatedMinutes'],properties:{
 week:{type:'integer'},kind:{type:'string',enum:['learning','practical']},title:{type:'string'},activity:{type:'string'},completionCriterion:{type:'string'},
 skillIds:strings,resourceIds:strings,estimatedMinutes:{type:'integer'},
 }}},
}};
async function boundedBody(response:Response){
 if(!response.body)throw new ProviderFailure('PROVIDER_INCOMPLETE');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
  if(length>AI_LIMITS.outputBytes*2)throw new ProviderFailure('PROVIDER_INCOMPLETE',false);chunks.push(value);
 }}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return JSON.parse(new TextDecoder().decode(bytes)) as unknown;}catch{throw new ProviderFailure('PROVIDER_INCOMPLETE');}
}
export function createGroqProvider({apiKey,model,maxOutputTokens=4096,maxRequestBytes=64000,fetchImpl=fetch}:Options):AIProvider{
 if(!apiKey||model!==GROQ_MODEL)throw new Error('Groq needs a server key and the configured fixed model.');
 function requestBody(input:ProviderInput){
  if(input.kind==='pathway_suggestions')throw new DomainError('PATHWAY_LIVE_DISABLED','Live pathway suggestions need reviewed capabilities and an updated approved disclosure. Local mock exploration remains available.',503);
  const prompt=providerRequest(input);
  const body=JSON.stringify({model,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],
   max_completion_tokens:maxOutputTokens,reasoning_effort:'low',include_reasoning:false,stream:false,
   response_format:{type:'json_schema',json_schema:{name:input.kind,strict:true,schema:input.kind==='cv_extraction'?extractionSchema:roadmapSchema}}});
  if(Buffer.byteLength(body)>maxRequestBytes)throw new DomainError('PROVIDER_INPUT_LIMIT','Minimized provider request exceeds the byte ceiling. Use manual entry or a smaller CV.',422);
  return body;
 }
 return {model,checkInput(input){requestBody(input);},async respond(input,signal){
  signal.throwIfAborted();const body=requestBody(input);let response:Response;
  try{response=await fetchImpl('https://api.groq.com/openai/v1/chat/completions',{method:'POST',cache:'no-store',redirect:'error',signal,
   headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},body});
  }catch(error){if(signal.aborted)throw error;throw new ProviderFailure('PROVIDER_UNAVAILABLE');}
  // Never expose echoed provider error bodies. Rate limits require a deliberate later retry.
  if(response.status===429)throw new DomainError('PROVIDER_RATE_LIMIT','Groq rate limit reached. Wait before a deliberate retry; existing data is preserved.',429);
  if(!response.ok)throw new ProviderFailure('PROVIDER_UNAVAILABLE',response.status>=500,response.status);
  let raw:unknown;
  try{raw=await boundedBody(response);}catch(error){if(error instanceof ProviderFailure||signal.aborted)throw error;throw new ProviderFailure('PROVIDER_UNAVAILABLE');}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ProviderFailure('PROVIDER_INCOMPLETE');
  const envelope=raw as {choices?:{finish_reason?:string;message?:{content?:unknown;refusal?:unknown;tool_calls?:unknown}}[]};
  const choice=Array.isArray(envelope.choices)?envelope.choices[0]:undefined;
  if(choice?.message?.refusal||choice?.finish_reason==='content_filter')throw new ProviderFailure('PROVIDER_REFUSED',false);
  if(!choice||choice.finish_reason!=='stop'||choice.message?.tool_calls)throw new ProviderFailure('PROVIDER_INCOMPLETE');
  const output=choice.message?.content;
  if(typeof output!=='string'||!output||Buffer.byteLength(output)>AI_LIMITS.outputBytes)throw new ProviderFailure('PROVIDER_INCOMPLETE');
  try{return JSON.parse(output) as unknown;}catch{throw new ProviderFailure('PROVIDER_INCOMPLETE');}
 }};
}
