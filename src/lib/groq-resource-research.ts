import { GROQ_MODEL, GROQ_NATIVE_TOOL_LIMIT } from './ai-execution';
import { resourceResearchPrompt } from './resource-discovery';
import { resourceCandidates, searchResultsSchema } from './resource-discovery';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { DomainError } from './domain';

// Dispatch requires server-held workflow approval and shared reservation/fences.
// Groq documents browser_search as incompatible with response_format json_schema.
// A later structured extraction is a separate accounted attempt, not a free retry.
export function groqResourceResearchRequest(context: unknown,maxNativeToolCalls=GROQ_NATIVE_TOOL_LIMIT) {
  z.number().int().min(1).max(GROQ_NATIVE_TOOL_LIMIT).parse(maxNativeToolCalls);
  const prompt = resourceResearchPrompt(context);
  return {
    model: GROQ_MODEL,
    messages: [{ role: 'system', content: prompt.system+` Use at most ${maxNativeToolCalls} native browser tool executions in total. Keep research focused on this single topic, combine searches/retrieval where supported and stop when a suitable pair is substantiated. The application independently retrieves candidate pages afterward. Do not continue browsing to collect extra alternatives. This instruction is not a technical tool-call cap; output exceeding the configured count will be rejected.`+' Return only {"results":[{"url":"exact native source URL","kind":"documentation|tutorial|course|video"}]}, with two to four candidates. Source URLs must occur in your native browser tool results. Native tool metadata supplies titles and provenance separately; do not add prose, invented citations or other fields.' }, { role: 'user', content: prompt.user }],
    tools: [{ type: 'browser_search' }],
    tool_choice: 'required',
    reasoning_effort: 'low',
    max_completion_tokens: 2048,
    stream: false,
  } as const;
}

// Native metadata contract from Groq's published ChatCompletionMessage types.
// Model-written source IDs, URLs and citation markers cannot substitute for it.
const page=z.object({url:z.string().url().max(2048),title:z.string().min(1).max(240),content:z.string().max(100000).optional()}).passthrough();
// The request enables browser_search; executed metadata also reports browser.open
// for page navigation (observed in the authorised synthetic run, 21 October 2026).
// Keep an explicit allowlist rather than accepting arbitrary tool types.
const tool=z.object({type:z.enum(['browser_search','browser.open','browser.find']),index:z.number().int().nonnegative(),browser_results:z.array(page).max(20).optional(),
 search_results:z.object({results:z.array(page).max(20).optional()}).passthrough().nullable().optional(),
}).passthrough();
const output=z.object({results:z.array(z.object({url:z.string().url().max(2048),kind:searchResultsSchema.element.shape.kind}).strict()).min(2).max(4)}).strict();

export type NativeResearchDiagnostic={stage:'native_metadata'|'research_json'|'candidate_schema'|'source_binding'|'resource_urls'|'accepted';outcome:'rejected'|'accepted';toolCount:number|null;issues?:{field:string;code:string;receivedType:string;toolType?:string}[]};
export function parseGroqNativeResearch(message:unknown,maxNativeToolCalls:number,requestId:string,report?:(event:NativeResearchDiagnostic)=>void){
 z.number().int().min(1).max(GROQ_NATIVE_TOOL_LIMIT).parse(maxNativeToolCalls);
 const tools=message&&typeof message==='object'?'executed_tools' in message?message.executed_tools:undefined:undefined;
 const toolCount=Array.isArray(tools)?tools.length:null;
 const emit=(stage:NativeResearchDiagnostic['stage'],outcome:NativeResearchDiagnostic['outcome'],issues?:NativeResearchDiagnostic['issues'])=>{try{report?.({stage,outcome,toolCount,...(issues?{issues}:{})});}catch{/* Observability cannot alter validation or trigger a retry. */}};
 const check=<T>(stage:NativeResearchDiagnostic['stage'],validate:()=>T):T=>{try{return validate();}catch(error){
  const issues=stage==='native_metadata'&&error instanceof z.ZodError?error.issues.slice(0,12).map(issue=>{
   const allowed=new Set(['content','executed_tools','type','index','browser_results','search_results','results','url','title']);
   let value:unknown=message;for(const key of issue.path)value=value&&typeof value==='object'?Reflect.get(value,key):undefined;
   const toolTypes=['browser_search','browser','search','web_search','browser.search','browser.open','browser.find','code_interpreter'];
   return {field:issue.path.map(key=>typeof key==='number'?'*':allowed.has(String(key))?String(key):'other').join('.'),code:issue.code,receivedType:value===null?'null':Array.isArray(value)?'array':typeof value,...(issue.path.at(-1)==='type'?{toolType:typeof value==='string'&&toolTypes.includes(value)?value:'unrecognized'}:{})};
  }):undefined;
  emit(stage,'rejected',issues);throw error;}
};
 z.string().min(1).max(120).parse(requestId);
 // Distinguish an orchestration limit from correctable model JSON. Never retry
 // the same provider-managed search merely to try to get a smaller tool count.
 if(toolCount!==null&&toolCount>maxNativeToolCalls){
  emit('native_metadata','rejected');
  throw new DomainError('RESOURCE_TOOL_LIMIT',`Resource search exceeded the configured browser-tool limit (${toolCount}/${maxNativeToolCalls}). No resources were saved. Existing plans and progress are preserved.`,502);
 }
 const parsed=check('native_metadata',()=>z.object({content:z.string().min(1).max(100000),executed_tools:z.array(tool).min(1).max(maxNativeToolCalls)}).passthrough().parse(message));
 const pages=new Map<string,{page:z.infer<typeof page>;citation:{requestId:string;toolIndex:number;resultIndex:number;resultType:'browser'|'search'}}>();
 for(const item of parsed.executed_tools)for(const [resultType,records] of [['browser',item.browser_results??[]],['search',item.search_results?.results??[]]] as const)for(const [resultIndex,result] of records.entries()){
  const previous=pages.get(result.url);
  if(previous&&previous.page.title!==result.title)throw new DomainError('UNGROUNDED_RESOURCE','Conflicting native source metadata needs a fresh research request.',502);
  if(!previous||!previous.page.content)pages.set(result.url,{page:result,citation:{requestId,toolIndex:item.index,resultIndex,resultType}});
 }
 if(pages.size>20)throw new DomainError('INVALID_OUTPUT','Native search returned too many sources.',502);
 const proposed:unknown=check('research_json',()=>{try{return JSON.parse(parsed.content);}catch{throw new DomainError('INVALID_OUTPUT','Native research did not return the required resource object.',502);}});
 const candidates=check('candidate_schema',()=>output.parse(proposed));
 const results=check('source_binding',()=>candidates.results.map(item=>{
  const source=pages.get(item.url);
  if(!source)throw new DomainError('UNGROUNDED_RESOURCE','A proposed URL was not returned by the native browser tool.',502);
  return {sourceId:`groq-${createHash('sha256').update(source.page.url).digest('hex')}`,url:source.page.url,title:source.page.title,publisher:new URL(source.page.url).hostname,kind:item.kind};
 }));
 const sources=results.map(item=>({id:item.sourceId,url:item.url,citation:pages.get(item.url)!.citation}));
 check('resource_urls',()=>resourceCandidates(results,sources));
 emit('accepted','accepted');
 return {results,sources};
}
