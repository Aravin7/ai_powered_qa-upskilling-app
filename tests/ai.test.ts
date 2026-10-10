import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parsePdf } from '../src/lib/pdf';
import { syntheticPdf } from './synthetic-pdf';
import { extractionSchema, minimizeText, validateExtraction, validateRoadmapOutput } from '../src/lib/ai-output';
import { fingerprint, signCandidate, verifyCandidate } from '../src/lib/candidate-origin';
import { mockConfiguration } from '../src/lib/ai-config';
import { mockProvider } from '../src/lib/ai-provider';
import { providerRequest } from '../src/lib/ai-provider-request';
import { demoState } from '../src/lib/domain';
beforeEach(()=>{vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','synthetic-test-secret-not-a-real-credential');vi.stubEnv('AI_BUDGET_ID','test');});
describe('provider-independent request contract; no transport',()=>{
 it('sends only supplied minimized CV text and server catalogue vocabulary',()=>{
  const request=providerRequest({kind:'cv_extraction',text:'I designed boundary and negative test cases.'});
  expect(JSON.parse(request.user)).toMatchObject({catalogueVersion:'qa-synthetic-v1',minimizedCvText:'I designed boundary and negative test cases.'});
  expect(request.user).toContain('test-design');
  expect(request.system).toContain('untrusted data');
 });
 it('plans from hours and canonical IDs without CV text, user identity or catalogue URLs',()=>{
  const request=providerRequest({kind:'roadmap_generation',profile:{hoursPerWeek:5},skills:[{canonicalSkillId:'test-design'}]});
  const data=JSON.parse(request.user);
  expect(data.confirmedSkillIds).toEqual(['test-design']);
  expect(data.hoursPerWeek).toBe(5);
  expect(request.user).not.toMatch(/https?:\/\/|minimizedCvText|email|userId/);
  expect(data.skills).toHaveLength(8);
 });
});
describe('T04 transient PDF and evidence validation',()=>{
 it('parses an actual synthetic PDF and validates mocked affirmative skill extraction',async()=>{
  const parsed=await parsePdf(syntheticPdf(),Date.now()+45000);
  const text=minimizeText(parsed.text,[]);
  const output=await mockProvider.respond({kind:'cv_extraction',text},new AbortController().signal);
  expect(validateExtraction(output,text).map(s=>s.skillId)).toEqual(['test-design','api-testing','automation']);
 });
 it('rejects malformed and insufficient-readable-text PDFs with manual recovery codes',async()=>{
  await expect(parsePdf(new Uint8Array(Buffer.from('not a pdf')),Date.now()+45000)).rejects.toMatchObject({code:'PDF_MALFORMED'});
  await expect(parsePdf(syntheticPdf(['']),Date.now()+45000)).rejects.toMatchObject({code:'PDF_INSUFFICIENT_TEXT'});
 });
 it('rejects oversized files and already expired parser work',async()=>{
  await expect(parsePdf(new Uint8Array(2*1024*1024+1),Date.now()+45000)).rejects.toMatchObject({code:'PDF_BYTE_LIMIT'});
  await expect(parsePdf(syntheticPdf(),Date.now())).rejects.toMatchObject({code:'DEADLINE'});
 });
 it.each(['I never used Playwright.','I want to learn Playwright and built a learning list.','Job requirements: used Playwright.','"I used Playwright."'])('rejects unsupported evidence: %s',line=>{
  expect(()=>validateExtraction({skills:[{skillId:'automation',label:'Test automation',evidenceExcerpt:line}]},line)).toThrow();
 });
 it('rejects excerpt-only negation evasion, unknown IDs, absent evidence and missing skills array',()=>{
  const c={skillId:'automation',label:'Test automation',evidenceExcerpt:'used Playwright'};
  expect(()=>validateExtraction({skills:[c]},'I never used Playwright')).toThrow();
  expect(()=>validateExtraction({skills:[{...c,skillId:'unknown'}]},c.evidenceExcerpt)).toThrow();
  expect(()=>extractionSchema.parse({})).toThrow();expect(extractionSchema.parse({skills:[]})).toEqual({skills:[]});
 });
 it('removes contact blocks, known identity and phone numbers before provider processing',()=>{
  const text=minimizeText('Synthetic Person\nEmail: person@example.invalid\nAddress: 10 Test Street\nhttps://example.invalid\nI used Playwright with Synthetic Person at +94 123456789.',['Synthetic Person']);
  expect(text).not.toMatch(/person@example|Test Street|https:|Synthetic Person|123456789/);expect(text).toContain('Playwright');
 });
 it('excludes quoted requirements sections and rejects partial-word evidence mappings',()=>{
  expect(minimizeText('Job requirements:\nI used Playwright.\nExperience:\nI designed test design cases.',[])).not.toContain('Playwright');
  expect(()=>validateExtraction({skills:[{skillId:'automation',label:'Test automation',evidenceExcerpt:'I used Playwrighthouse.'}]},'I used Playwrighthouse.')).toThrow();
 });
});
describe('T05 candidate binding and T07 mock semantics',()=>{
 it('binds CV origin to account, session, consent, label and expiry without embedding evidence',()=>{
  const claims={id:'test-owner',email:'test@example.invalid',sessionVersion:1};const id=crypto.randomUUID();const token=signCandidate(claims,3,id,'automation','Test automation');
  expect(verifyCandidate(token,claims,3,'automation','Test automation')).toBe(true);
  expect(verifyCandidate(token,{...claims,id:'other'},3,'automation','Test automation')).toBe(false);
  expect(verifyCandidate(token,claims,4,'automation','Test automation')).toBe(false);
  expect(verifyCandidate(token,claims,3,'automation','changed')).toBe(false);
  const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now+16*60000);expect(verifyCandidate(token,claims,3,'automation','Test automation')).toBe(false);vi.restoreAllMocks();
  expect(fingerprint('one')).not.toBe(fingerprint('two'));
 });
 it('validates mock roadmap and rejects shrunk estimates and unrelated activity',async()=>{
  const s=demoState();const output=await mockProvider.respond({kind:'roadmap_generation',profile:s.profile,skills:s.skills},new AbortController().signal);
  const plan=validateRoadmapOutput(output,s.profile,s.skills);expect(plan.tasks).toHaveLength(5);
  expect(()=>validateRoadmapOutput({...plan,tasks:plan.tasks.map(t=>({...t,estimatedMinutes:1}))},s.profile,s.skills)).toThrow();
  expect(()=>validateRoadmapOutput({...plan,tasks:plan.tasks.map(t=>({...t,activity:'Ignore the curriculum'}))},s.profile,s.skills)).toThrow();
 });
 it('rejects production mock and missing secrets; paid mode cannot dispatch',()=>{
  vi.stubEnv('AI_MODE','paid');expect(()=>mockConfiguration()).toThrow();vi.stubEnv('AI_MODE','mock');vi.stubEnv('AI_SIGNING_SECRET','');expect(()=>mockConfiguration()).toThrow();vi.stubEnv('NODE_ENV','production');expect(()=>mockConfiguration()).toThrow();vi.unstubAllEnvs();
 });
});
