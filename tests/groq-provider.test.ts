import { describe,expect,it,vi } from 'vitest';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';
import { validateExtraction,validateRoadmapOutput } from '../src/lib/ai-output';
import { catalogue } from '../src/lib/catalogue';
import { demoState } from '../src/lib/domain';
const envelope=(output:unknown)=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(output)}}]}));
const create=(http:typeof fetch,options={})=>createGroqProvider({apiKey:'synthetic-test-key',model:GROQ_MODEL,fetchImpl:http,...options});
describe('Groq server adapter with intercepted fetch, no live AI',()=>{
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
