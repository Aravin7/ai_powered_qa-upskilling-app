import { describe,expect,it,vi } from 'vitest';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';
import { validateExtraction,validateRoadmapOutput } from '../src/lib/ai-output';
import { catalogue } from '../src/lib/catalogue';
import { demoState } from '../src/lib/domain';
import { reviewedPlanContext, validateReviewedPlan, mockReviewedPlan } from '../src/lib/reviewed-roadmap';
import { syntheticReviewedLibrary } from './fixtures/reviewed-planning';
import { mockPathwayOutput, validatePathwaySuggestions, type PathwayProviderInput } from '../src/lib/pathways';
import { validateResearchEnvelope } from '../src/lib/resource-preview';
import type { NativeResearchDiagnostic } from '../src/lib/groq-resource-research';
import { timedProviderResponse, providerAttemptTimeout } from '../src/lib/ai-provider';
const envelope=(output:unknown)=>new Response(JSON.stringify({id:'synthetic-intercepted-request',choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
const create=(http:typeof fetch,options={})=>createGroqProvider({apiKey:'synthetic-test-key',model:GROQ_MODEL,fetchImpl:http,...options});
describe('Groq server adapter with intercepted fetch, no live AI',()=>{
 it('GR-A14: search gets 20s while preserving downstream time and ordinary 12s calls',()=>{
  const context={pathwayId:'synthetic-qa',pathwayTitle:'Synthetic QA',topicId:'ci',topicTitle:'Continuous integration'};
  const search={kind:'resource_research' as const,phase:'search' as const,context};
  expect(providerAttemptTimeout(search,45000)).toBe(20000);
  expect(providerAttemptTimeout(search,35000)).toBe(15000);
  expect(()=>providerAttemptTimeout(search,20000)).toThrow(expect.objectContaining({code:'DEADLINE'}));
  expect(providerAttemptTimeout({kind:'resource_research',phase:'select',context,candidates:[]},45000)).toBe(12000);
  expect(providerAttemptTimeout({kind:'cv_extraction',text:'Synthetic'},45000)).toBe(12000);
  expect(providerAttemptTimeout({kind:'cv_extraction',text:'Synthetic'},8000)).toBe(5000);
 });
 it('GR-A11: distinguishes connection failure from interrupted response without echoing errors',async()=>{
  const input={kind:'cv_extraction' as const,text:'Synthetic experience.'};
  const failed=vi.fn(async()=>{throw new Error('private network details');});
  await expect(create(failed).respond(input,new AbortController().signal)).rejects.toMatchObject({code:'PROVIDER_CONNECTION_FAILED'});
  expect(failed).toHaveBeenCalledTimes(1);
  const interrupted=vi.fn(async()=>new Response(new ReadableStream({start(controller){controller.error(new Error('private body details'));}})));
  await expect(create(interrupted).respond(input,new AbortController().signal)).rejects.toMatchObject({code:'PROVIDER_RESPONSE_INTERRUPTED'});
  expect(interrupted).toHaveBeenCalledTimes(1);
 });
 it.each([false,true])('GR-A12: timeout remains distinct when abort rejection races it (%s)',async rejectOnAbort=>{
  vi.useFakeTimers();
  try{
   let signal:AbortSignal|undefined;
   const respond=vi.fn((_input:unknown,current:AbortSignal)=>{signal=current;return new Promise<never>((_,reject)=>{
    if(rejectOnAbort)current.addEventListener('abort',()=>reject(new Error('abort transport details')),{once:true});
   });});
   const result=timedProviderResponse({model:'synthetic',respond},{kind:'cv_extraction',text:'Synthetic'},12000);
   const check=expect(result).rejects.toMatchObject({code:'PROVIDER_TIMEOUT'});
   await vi.advanceTimersByTimeAsync(12000);await check;
   expect(signal!.aborted).toBe(true);expect(respond).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  }finally{vi.useRealTimers();}
 });
 it('GR-A13: completed timed request clears its timer',async()=>{
  vi.useFakeTimers();try{
   const respond=vi.fn(async()=>({skills:[]}));
   await expect(timedProviderResponse({model:'synthetic',respond},{kind:'cv_extraction',text:'Synthetic'},12000)).resolves.toEqual({skills:[]});
   expect(vi.getTimerCount()).toBe(0);
  }finally{vi.useRealTimers();}
 });
 it('GR-A10 / US15: excess native browsing returns a specific terminal error after one dispatch',async()=>{
  const context={pathwayId:'synthetic-qa',pathwayTitle:'Synthetic QA',topicId:'ci',topicTitle:'Continuous integration'};
  const http=vi.fn(async()=>new Response(JSON.stringify({id:'synthetic-limit-request',choices:[{finish_reason:'stop',message:{content:'{}',executed_tools:Array.from({length:4},(_,index)=>({type:'browser_search',index}))}}]})));
  const provider=create(http,{nativeResearch:{approvalReference:'synthetic only',maxNativeToolCalls:2}});
  await expect(provider.respond({kind:'resource_research',phase:'search',context},new AbortController().signal)).rejects.toMatchObject({code:'RESOURCE_TOOL_LIMIT',status:502});
  expect(http).toHaveBeenCalledTimes(1);
 });
 it('GR-A9 / T15: reports missing native metadata after one intercepted request without echoing content',async()=>{
  const context={pathwayId:'synthetic-qa',pathwayTitle:'Synthetic QA',topicId:'ci',topicTitle:'Continuous integration'};
  const http=vi.fn(async()=>envelope({results:[],privateText:'Synthetic content that must not appear in diagnostics'}));
  const events:NativeResearchDiagnostic[]=[];
  const provider=create(http,{nativeResearch:{approvalReference:'synthetic only',maxNativeToolCalls:2},onResearchDiagnostic:(event:NativeResearchDiagnostic)=>events.push(event)});
  await expect(provider.respond({kind:'resource_research',phase:'search',context},new AbortController().signal)).rejects.toThrow();
  expect(http).toHaveBeenCalledTimes(1);expect(events).toMatchObject([{stage:'native_metadata',outcome:'rejected',toolCount:null}]);
 });
 it('GR-A1 / R04: strict extraction includes only the minimized request contract',async()=>{
  const text='I designed boundary and negative test cases for a synthetic sign-in form.';
  const http=vi.fn(async()=>envelope({skills:[{skillId:'test-design',label:'Test design',evidenceExcerpt:text}]}));
  const result=await create(http).respond({kind:'cv_extraction',text},new AbortController().signal);
  expect(validateExtraction(result,text).map(skill=>skill.skillId)).toEqual(['test-design']);
  expect(http).toHaveBeenCalledTimes(1);const [url,options]=http.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');expect(options.headers).toMatchObject({Authorization:'Bearer synthetic-test-key'});
  const body=JSON.parse(String(options.body));expect(body.model).toBe(GROQ_MODEL);expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.response_format.json_schema.schema.required).toEqual(['skills']);expect(body.messages[0].content).toContain('untrusted data');
  expect(body.messages[1].content).toContain(text);expect(body.tools).toBeUndefined();expect(body.stream).toBe(false);
 });
 it('GR-A2 / R07: validates a complete roadmap through the existing business validator',async()=>{
  const state=demoState();const output={outcome:'plan',reason:null,constraintCode:null,deferredSkillIds:[],tasks:catalogue.skills.slice(3).map((skill,index)=>({
   week:index+1,kind:index===4?'practical':'learning',title:skill.label,activity:skill.activity,completionCriterion:skill.outcome,skillIds:[skill.id],resourceIds:[...skill.resourceIds],estimatedMinutes:skill.minutes,
  }))};
  const http=vi.fn(async()=>envelope(output));const result=await create(http).respond({kind:'roadmap_generation',profile:{hoursPerWeek:5},skills:state.skills},new AbortController().signal);
  expect(validateRoadmapOutput(result,{...state.profile,hoursPerWeek:5},state.skills).tasks).toHaveLength(5);
  const body=JSON.parse(String((http.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(body.messages[1].content).not.toMatch(/minimizedCvText|userId|email|https?:\/\//);expect(body.response_format.json_schema.schema.type).toBe('object');
 });
 it('GR-A6 / R07/R11: sends only server-compiled reviewed activities and validates a strict schedule',async()=>{
  const library=syntheticReviewedLibrary(4,true);
  const context=reviewedPlanContext({library,selection:{directionId:'qa',deferredCapabilityIds:[]},inventory:[],hoursPerWeek:5,
   resources:library.capabilities.map(item=>({topicId:item.id,documentationId:`${item.id}-doc`,supportingId:`${item.id}-lesson`}))});
  const output=mockReviewedPlan(context);const http=vi.fn(async()=>envelope(output));
  const result=await create(http,{planningApprovalReference:'synthetic approval fixture only'}).respond({kind:'reviewed_roadmap',context},new AbortController().signal);
  expect(validateReviewedPlan(context,result).tasks).toHaveLength(context.activities.length);
  const body=JSON.parse(String((http.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  const prompt=JSON.parse(body.messages[1].content);
  expect(body.response_format.json_schema.strict).toBe(true);expect(body.tools).toBeUndefined();
  expect(prompt.activities).toHaveLength(context.activities.length);expect(prompt.activities[0].resourceIds).toEqual(context.activities[0].task.resourceIds);
  expect(body.messages[0].content).toMatch(/exactly once/);expect(body.messages[1].content).not.toMatch(/email|cvText|https?:\/\//);
  expect(http).toHaveBeenCalledTimes(1);
 });
 it('GR-A7 / T15: strict direction output remains subject to capability/experience validation',async()=>{
  const input:PathwayProviderInput={kind:'pathway_suggestions',preferences:{interests:['delivery'],preferredWork:'automation',codingPreference:'some'},confirmedSkillIds:['automation'],hoursPerWeek:5};
  const http=vi.fn(async()=>envelope(mockPathwayOutput(input)));
  const result=await create(http,{planningApprovalReference:'synthetic approval fixture only'}).respond(input,new AbortController().signal);
  expect(validatePathwaySuggestions(result,input.confirmedSkillIds)).toHaveLength(1);
  const body=JSON.parse(String((http.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(body.response_format.json_schema.schema.required).toEqual(['suggestions']);expect(body.tools).toBeUndefined();
 });
 it('GR-A8 / T15: native search uses genuine tool sources and selection is a separate tool-free request',async()=>{
  const context={pathwayId:'synthetic-qa',pathwayTitle:'Synthetic QA',topicId:'ci',topicTitle:'Continuous integration'};
  const urls=['https://docs.example.org/ci','https://lessons.example.org/ci'];
  const content=JSON.stringify({results:urls.map((url,index)=>({url,kind:index?'tutorial':'documentation'}))});
  const http=vi.fn(async()=>new Response(JSON.stringify({id:'synthetic-intercepted-request',choices:[{finish_reason:'stop',message:{content,executed_tools:[{type:'browser_search',arguments:'{}',index:0},{type:'browser.open',index:1,browser_results:urls.map((url,index)=>({url,title:`Native synthetic page ${index}`,content:'Synthetic CI documentation and lesson.'}))}]}}]})));
  const adapter=create(http,{nativeResearch:{approvalReference:'synthetic test approval only',maxNativeToolCalls:2}});
  const found=validateResearchEnvelope(await adapter.respond({kind:'resource_research',phase:'search',context},new AbortController().signal));
  expect(found.sources.map(source=>source.url)).toEqual(urls);
  const body=JSON.parse(String((http.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(body.tools).toEqual([{type:'browser_search'}]);expect(body.response_format).toBeUndefined();
  expect(body.messages[1].content).not.toMatch(/email|cvText|confirmedSkillIds/);
  const selected=vi.fn(async()=>envelope({documentationId:found.candidates[0].id,supportingId:found.candidates[1].id}));
  await create(selected,{nativeResearch:{approvalReference:'synthetic test approval only',maxNativeToolCalls:2}}).respond({kind:'resource_research',phase:'select',context,candidates:found.candidates},new AbortController().signal);
  const selectBody=JSON.parse(String((selected.mock.calls[0] as unknown as [string,RequestInit])[1].body));
  expect(selectBody.tools).toBeUndefined();expect(selectBody.response_format.json_schema.strict).toBe(true);expect(http).toHaveBeenCalledTimes(1);expect(selected).toHaveBeenCalledTimes(1);
 });
 it.each([401,429])('GR-A3 / R11: HTTP %i produces one request without hidden retries',async status=>{
  const http=vi.fn(async()=>new Response('private echoed error must not surface',{status}));
  await expect(create(http).respond({kind:'cv_extraction',text:'I used Playwright.'},new AbortController().signal)).rejects.toMatchObject({code:status===429?'PROVIDER_RATE_LIMIT':'PROVIDER_UNAVAILABLE'});
  expect(http).toHaveBeenCalledTimes(1);
 });
 it.each([
  [{choices:[{finish_reason:'content_filter',message:{content:null}}]},'PROVIDER_REFUSED'],
  [{choices:[{finish_reason:'stop',message:{refusal:'refused',content:null}}]},'PROVIDER_REFUSED'],
  [{choices:[{finish_reason:'length',message:{content:'{}'}}]},'PROVIDER_INCOMPLETE'],
  [{choices:[{finish_reason:'stop',message:{content:'{'}}]},'PROVIDER_INCOMPLETE'],
  [null,'PROVIDER_INCOMPLETE'],
 ])('GR-A4 / R04/R07: rejects refused, truncated or malformed envelopes %#',async(raw,code)=>{
  await expect(create(vi.fn(async()=>new Response(JSON.stringify(raw)))).respond({kind:'cv_extraction',text:'I used Playwright.'},new AbortController().signal)).rejects.toMatchObject({code});
 });
 it('GR-A5 / R11: oversized input and cancellation prevent dispatch',async()=>{
  const http=vi.fn(async()=>envelope({skills:[]}));
  expect(()=>create(http,{maxRequestBytes:1}).checkInput!({kind:'cv_extraction',text:'Synthetic text'})).toThrow();
  const controller=new AbortController();controller.abort();
  await expect(create(http).respond({kind:'cv_extraction',text:'Synthetic text'},controller.signal)).rejects.toThrow();expect(http).not.toHaveBeenCalled();
 });
});
it("GR-A15: differing native titles for the same URL retain provenance",async()=>{const {parseGroqNativeResearch}=await import("../src/lib/groq-resource-research");const urls=["https://docs.example.org/ci","https://lessons.example.org/ci"];const result=parseGroqNativeResearch({content:JSON.stringify({results:urls.map((url,i)=>({url,kind:i?"tutorial":"documentation"}))}),executed_tools:[{type:"browser_search",index:0,search_results:{results:urls.map((url,i)=>({url,title:`Search ${i}`}))}},{type:"browser.open",index:1,browser_results:urls.map((url,i)=>({url,title:`Open ${i}`,content:"Synthetic CI guidance"}))}]},6,"synthetic-duplicate-title");expect(result.results).toHaveLength(2);expect(result.results[0].title).toBe("Open 0");expect(result.sources[0].citation).toMatchObject({toolIndex:1,resultType:"browser"});});
it("GR-A16: empty native titles fall back to source hostnames",async()=>{const {parseGroqNativeResearch}=await import("../src/lib/groq-resource-research");const urls=["https://docs.example.org/ci","https://lessons.example.org/ci"];const message={content:JSON.stringify({results:urls.map((url,i)=>({url,kind:i?"tutorial":"documentation"}))}),executed_tools:[{type:"browser_search",index:0,search_results:{results:urls.map(url=>({url,title:""}))}}]};const found=validateResearchEnvelope(parseGroqNativeResearch(message,6,"synthetic-empty-titles"));expect(found.candidates).toHaveLength(2);expect(found.candidates[0].title).toBe("docs.example.org");expect(found.candidates[1].title).toBe("lessons.example.org");expect(found.candidates[0].citation).toMatchObject({toolIndex:0,resultType:"search"});});
it("GR-A17: optional search metadata does not block valid sourced resources",async()=>{const {parseGroqNativeResearch}=await import("../src/lib/groq-resource-research");const urls=["https://docs.example.org/ci","https://lessons.example.org/ci"];const message={content:JSON.stringify({results:urls.map((url,i)=>({url,kind:i?"tutorial":"documentation"}))}),executed_tools:[{type:"browser_search",index:0,search_results:{results:[{title:"Result without URL"},{url:urls[0]},{url:urls[1],title:"CI lesson"}]}}]};const result=validateResearchEnvelope(parseGroqNativeResearch(message,6,"synthetic-optional-fields"));expect(result.candidates).toHaveLength(2);expect(result.candidates[0].title).toBe("docs.example.org");expect(result.candidates[1].title).toBe("CI lesson");expect(result.candidates.every(c=>c.citation)).toBe(true);});
