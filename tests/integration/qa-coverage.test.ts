import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { admitGoogle, deleteAccount, getState, patchTask, putConsent, putProfile, putSkills, type Claims } from '../../src/lib/store';
import { extractSkills, generateRoadmap } from '../../src/lib/ai-operations';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { mockProvider, ProviderFailure, type AIProvider } from '../../src/lib/ai-provider';
import { syntheticPdf } from '../synthetic-pdf';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('BLOCKED: QA integration cases require a separate migrated TEST_DATABASE_URL.');
const first = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const second = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
let claims: Claims;
let email: string;
let budgetId: string;
const pdf = syntheticPdf();
const request = (revision = 2, key = crypto.randomUUID(), introductoryPlanAcknowledged = false) => ({ operationKey: key, expectedPlanningRevision: revision, expectedCatalogueVersion: catalogue.version, introductoryPlanAcknowledged });
const attempts = () => first.aIAttempt.count({ where: { operation: { userId: claims.id } } });

beforeAll(async () => {
  await first.catalogueRevision.upsert({ where: { id: 'active' }, update: {}, create: { id: 'active', version: catalogue.version, revision: 1 } });
});
beforeEach(async () => {
  vi.stubEnv('AI_MODE', 'mock');
  vi.stubEnv('AI_SIGNING_SECRET', 'synthetic-qa-integration-signing-secret');
  budgetId = `qa-${crypto.randomUUID()}`;
  vi.stubEnv('AI_BUDGET_ID', budgetId);
  await first.fundingBudget.create({ data: { id: budgetId, mode: 'mock', currency: 'MOCK', pricingVersion: 'mock-v1', ceiling: 50, expiresAt: new Date(Date.now() + 3600000) } });
  email = `qa-${crypto.randomUUID()}@example.invalid`;
  await first.invitation.create({ data: { email } });
  const user = await admitGoogle(first, crypto.randomUUID(), email, 'Synthetic QA Learner');
  claims = { id: user.id, email, sessionVersion: 0 };
  await putProfile(first, claims, { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: 5, expectedRevision: 0 });
  await putSkills(first, claims, { entries: catalogue.skills.slice(0, 3).map(skill => ({ canonicalSkillId: skill.id, label: skill.label })), removals: [], expectedRevision: 1 });
});
afterEach(async () => {
  await first.user.deleteMany({ where: { email } });
  await first.invitation.deleteMany({ where: { email } });
  await first.fundingBudget.deleteMany({ where: { id: budgetId } });
  vi.unstubAllEnvs();
});
afterAll(async () => { await first.$disconnect(); await second.$disconnect(); });

describe('CV-05 / R04-R05 / T03: consent gates across the real database', () => {
  it('CV-05a rejects missing extraction consent before provider reservation', async () => {
    const provider: AIProvider = { model: 'must-not-run', respond: vi.fn(mockProvider.respond) };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), provider)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(provider.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(0);
  });
  it('CV-05b rejects outdated consent before provider reservation', async () => {
    await first.consent.create({ data: { userId: claims.id, purpose: 'cv_extraction', granted: true, policyVersion: 'outdated-synthetic-notice' } });
    const provider: AIProvider = { model: 'must-not-run', respond: vi.fn(mockProvider.respond) };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), provider)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(provider.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(0);
  });
  it('CV-05c withdrawal during provider work cancels evidence delivery and retry', async () => {
    await putConsent(first, claims, { purpose: 'cv_extraction', granted: true, policyVersion: POLICY_VERSION });
    let release!: () => void;
    let entered!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    let calls = 0;
    const provider: AIProvider = { model: 'controlled-synthetic', async respond(input, signal) { calls++; entered(); await wait; return mockProvider.respond(input, signal); } };
    const running = extractSkills(first, claims, pdf, crypto.randomUUID(), provider);
    const rejected = expect(running).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    await ready;
    try { await putConsent(second, claims, { purpose: 'cv_extraction', granted: false, policyVersion: POLICY_VERSION }); }
    finally { release(); }
    await rejected;
    expect(calls).toBe(1);
    expect(await attempts()).toBe(1);
    expect((await getState(first, claims)).skills).toHaveLength(3);
  }, 15000);
});

describe('CV-07/CV-08/CV-09/CV-10 / R05-R11 / T04-T05', () => {
  beforeEach(async () => { await putConsent(first, claims, { purpose: 'cv_extraction', granted: true, policyVersion: POLICY_VERSION }); });
  it('CV-07a merges candidates; omission needs explicit removal and failed save preserves inventory', async () => {
    const before = await getState(first, claims);
    const result = await extractSkills(first, claims, syntheticPdf(['Synthetic QA fixture only.', 'I built synthetic Playwright tests for a local sample application.']), crypto.randomUUID());
    expect((await getState(first, claims)).skills).toEqual(before.skills);
    await expect(putSkills(first, claims, { entries: result.candidates.map(candidate => ({ canonicalSkillId: candidate.skillId, label: candidate.label, candidateReference: candidate.candidateReference })), removals: [], expectedRevision: 2 })).rejects.toMatchObject({ code: 'EXPLICIT_REMOVAL_REQUIRED' });
    expect((await getState(first, claims)).skills).toEqual(before.skills);
  });
  it('CV-08d forged reference fails; edited candidate is saved only as manual', async () => {
    const original = await getState(first, claims);
    const extracted = await extractSkills(first, claims, syntheticPdf(['I used Playwright on a synthetic application.']), crypto.randomUUID());
    const candidate = extracted.candidates.find(item => item.skillId === 'automation')!;
    const entries = original.skills.map(skill => ({ canonicalSkillId: skill.canonicalSkillId, label: skill.label }));
    await expect(putSkills(first, claims, { entries: [...entries, { canonicalSkillId: null, label: 'Synthetic exploratory testing', candidateReference: candidate.candidateReference + 'forged' }], removals: [], expectedRevision: 2 })).rejects.toMatchObject({ code: 'CANDIDATE_EXPIRED' });
    expect((await getState(first, claims)).skills).toEqual(original.skills);
    const saved = await putSkills(first, claims, { entries: [...entries, { canonicalSkillId: null, label: 'Synthetic exploratory testing' }], removals: [], expectedRevision: 2 });
    expect(saved.skills.find(skill => skill.label === 'Synthetic exploratory testing')?.source).toBe('manual');
  });
  it('CV-09a invalid mocked response then valid mocked response consumes exactly two attempts', async () => {
    let calls = 0;
    const provider: AIProvider = { model: 'recovering-synthetic', async respond(input, signal) { calls++; return calls === 1 ? {} : mockProvider.respond(input, signal); } };
    const result = await extractSkills(first, claims, pdf, crypto.randomUUID(), provider);
    expect(result.code).toBe('CANDIDATES_READY');
    expect(calls).toBe(2);
    expect(await attempts()).toBe(2);
  });
  it('CV-09b refusal is controlled and does not mutate inventory', async () => {
    const old = (await getState(first, claims)).skills;
    let calls = 0;
    const provider: AIProvider = { model: 'refusing-synthetic', async respond() { calls++; throw new ProviderFailure('PROVIDER_REFUSED', false); } };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), provider)).rejects.toMatchObject({ code: 'PROVIDER_REFUSED' });
    expect(calls).toBe(1);
    expect(await attempts()).toBe(1);
    expect((await getState(first, claims)).skills).toEqual(old);
  });
  it('CV-09c provider timeout uses only two reserved attempts and preserves inventory', async () => {
    const old = (await getState(first, claims)).skills;
    let calls = 0;
    const stalled: AIProvider = { model: 'stalled-synthetic', async respond() { calls++; return new Promise<never>(() => {}); } };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), stalled)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(calls).toBe(2);
    expect(await attempts()).toBe(2);
    expect((await getState(first, claims)).skills).toEqual(old);
  }, 35000);
  it('CV-10a minimizes contact details before the server-side provider boundary', async () => {
    let observed = '';
    const provider: AIProvider = { model: 'capture-synthetic', async respond(input, signal) { if (input.kind === 'cv_extraction') observed = input.text; return mockProvider.respond(input, signal); } };
    const source = syntheticPdf(['Synthetic Learner', 'Email: synthetic.person@example.invalid', 'Phone: +94 123456789', 'I used Playwright for synthetic browser tests.']);
    await extractSkills(first, claims, source, crypto.randomUUID(), provider);
    expect(observed).toContain('Playwright');
    expect(observed).not.toMatch(/synthetic.person@|123456789|Synthetic Learner/);
    const records = await first.aIOperation.findMany({ where: { userId: claims.id } });
    expect(JSON.stringify(records)).not.toContain('Playwright');
  });
});

describe('RM-02/RM-04/RM-08/RM-09 / R07-R11 / T07-T09', () => {
  beforeEach(async () => { await putConsent(first, claims, { purpose: 'roadmap_generation', granted: true, policyVersion: POLICY_VERSION }); });
  it('RM-02a permits roadmap generation when CV consent was declined', async () => {
    expect((await getState(first, claims)).consents.cv_extraction).toBe(false);
    expect((await generateRoadmap(first, claims, request())).code).toBe('MOCK_PLAN_SAVED');
  });
  it('RM-02b rejects outdated roadmap consent with zero dispatch', async () => {
    await first.consent.create({ data: { userId: claims.id, purpose: 'roadmap_generation', granted: true, policyVersion: 'outdated-synthetic-notice' } });
    const provider: AIProvider = { model: 'must-not-run', respond: vi.fn(mockProvider.respond) };
    await expect(generateRoadmap(first, claims, request(), provider)).rejects.toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(provider.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(0);
  });
  it('RM-04a requires introductory acknowledgement before dispatch for empty inventory', async () => {
    const before = await getState(first, claims);
    await putSkills(first, claims, { entries: [], removals: before.skills.map(skill => skill.key), expectedRevision: 2 });
    const provider: AIProvider = { model: 'spy-synthetic', respond: vi.fn(mockProvider.respond) };
    await expect(generateRoadmap(first, claims, request(3), provider)).rejects.toMatchObject({ code: 'ACKNOWLEDGMENT_REQUIRED' });
    expect(provider.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(0);
    expect((await generateRoadmap(first, claims, request(3, crypto.randomUUID(), true), provider)).code).toBe('MOCK_PLAN_SAVED');
  });
  it('RM-08a no-op profile save during provider work does not invalidate activation', async () => {
    let release!: () => void;
    let entered!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const provider: AIProvider = { model: 'controlled-synthetic', async respond(input, signal) { entered(); await wait; return mockProvider.respond(input, signal); } };
    const running = generateRoadmap(first, claims, request(), provider);
    await ready;
    try {
      const unchanged = await putProfile(second, claims, { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: 5, expectedRevision: 2 });
      expect(unchanged.profile.planningRevision).toBe(2);
    } finally { release(); }
    expect((await running).code).toBe('MOCK_PLAN_SAVED');
  }, 15000);
  it('RM-09a terminal failure replays metadata; deliberate new key can succeed', async () => {
    let calls = 0;
    const provider: AIProvider = { model: 'invalid-synthetic', async respond() { calls++; return { outcome: 'plan', tasks: [{ week: 99 }] }; } };
    const key = crypto.randomUUID();
    await expect(generateRoadmap(first, claims, request(2, key), provider)).rejects.toMatchObject({ code: 'INVALID_OUTPUT' });
    expect((await generateRoadmap(second, claims, request(2, key), provider)).code).toBe('INVALID_OUTPUT');
    expect(calls).toBe(2);
    expect(await attempts()).toBe(2);
    expect((await generateRoadmap(first, claims, request())).code).toBe('MOCK_PLAN_SAVED');
    expect(await attempts()).toBe(3);
  });
  it('RM-07d invalid-then-valid roadmap output activates only the validated second proposal', async () => {
    let calls = 0;
    const provider: AIProvider = { model: 'recovering-synthetic', async respond(input, signal) { calls++; return calls === 1 ? {} : mockProvider.respond(input, signal); } };
    const result = await generateRoadmap(first, claims, request(), provider);
    expect(result.code).toBe('MOCK_PLAN_SAVED');
    expect(result.state.roadmap?.tasks).toHaveLength(5);
    expect(calls).toBe(2);
    expect(await attempts()).toBe(2);
    expect(await first.roadmap.count({ where: { userId: claims.id, status: 'active' } })).toBe(1);
  });
  it('RM-07e a nonretryable refusal preserves a completed active plan', async () => {
    const initial = await generateRoadmap(first, claims, request());
    await patchTask(first, claims, initial.state.roadmap!.tasks[0].id, { completed: true, expectedTaskRevision: 0 });
    const old = (await getState(first, claims)).roadmap;
    let calls = 0;
    const refusing: AIProvider = { model: 'refusing-synthetic', async respond() { calls++; throw new ProviderFailure('PROVIDER_REFUSED', false); } };
    await expect(generateRoadmap(second, claims, request(), refusing)).rejects.toMatchObject({ code: 'PROVIDER_REFUSED' });
    expect(calls).toBe(1);
    expect((await getState(first, claims)).roadmap).toEqual(old);
    expect(await first.roadmap.count({ where: { userId: claims.id, status: 'active' } })).toBe(1);
  });
  it('RM-08b a skill edit during provider work rejects stale plan activation', async () => {
    let release!: () => void;
    let entered!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const provider: AIProvider = { model: 'controlled-synthetic', async respond(input, signal) { entered(); await wait; return mockProvider.respond(input, signal); } };
    const running = generateRoadmap(first, claims, request(), provider);
    const rejected = expect(running).rejects.toMatchObject({ code: 'STALE_INPUT' });
    await ready;
    try {
      const old = await getState(second, claims);
      const changed = await putSkills(second, claims, { entries: [...old.skills.map(skill => ({ canonicalSkillId: skill.canonicalSkillId, label: skill.label })), { canonicalSkillId: null, label: 'Synthetic exploratory testing' }], removals: [], expectedRevision: 2 });
      expect(changed.profile.planningRevision).toBe(3);
    } finally { release(); }
    await rejected;
    expect(await first.roadmap.count({ where: { userId: claims.id } })).toBe(0);
  }, 15000);
});

describe('WF-09 / R10 / T10: deletion during extraction', () => {
  it('WF-09a provider result after deletion cannot restore account or skills', async () => {
    await putConsent(first, claims, { purpose: 'cv_extraction', granted: true, policyVersion: POLICY_VERSION });
    let release!: () => void;
    let entered!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const provider: AIProvider = { model: 'controlled-synthetic', async respond(input, signal) { entered(); await wait; return mockProvider.respond(input, signal); } };
    const running = extractSkills(first, claims, pdf, crypto.randomUUID(), provider);
    const rejected = expect(running).rejects.toBeInstanceOf(Error);
    await ready;
    try { await deleteAccount(second, claims); }
    finally { release(); }
    await rejected;
    expect(await first.user.findUnique({ where: { id: claims.id } })).toBeNull();
    expect(await first.confirmedSkill.count({ where: { userId: claims.id } })).toBe(0);
  }, 15000);
});

describe('RM-10 / R11 / T11: controls shared by both AI operations', () => {
  beforeEach(async () => {
    await putConsent(first, claims, { purpose: 'cv_extraction', granted: true, policyVersion: POLICY_VERSION });
    await putConsent(first, claims, { purpose: 'roadmap_generation', granted: true, policyVersion: POLICY_VERSION });
  });
  it('RM-10a five rolling-hour attempts are shared across roadmap and CV dispatch', async () => {
    const incomplete: AIProvider = { model: 'incomplete-synthetic', async respond() { throw new ProviderFailure('PROVIDER_INCOMPLETE'); } };
    for (let index = 0; index < 2; index++) {
      await expect(generateRoadmap(first, claims, request(), incomplete)).rejects.toMatchObject({ code: 'PROVIDER_INCOMPLETE' });
    }
    const refusing: AIProvider = { model: 'refusing-synthetic', async respond() { throw new ProviderFailure('PROVIDER_REFUSED', false); } };
    await expect(extractSkills(second, claims, pdf, crypto.randomUUID(), refusing)).rejects.toMatchObject({ code: 'PROVIDER_REFUSED' });
    expect(await attempts()).toBe(5);
    const spy: AIProvider = { model: 'must-not-run', respond: vi.fn(mockProvider.respond) };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), spy)).rejects.toMatchObject({ code: 'QUOTA_EXHAUSTED' });
    expect(spy.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(5);
  }, 15000);
  it('RM-10b exhausted shared funding blocks CV dispatch before provider invocation', async () => {
    await first.fundingBudget.update({ where: { id: budgetId }, data: { ceiling: 0 } });
    const provider: AIProvider = { model: 'must-not-run', respond: vi.fn(mockProvider.respond) };
    await expect(extractSkills(first, claims, pdf, crypto.randomUUID(), provider)).rejects.toMatchObject({ code: 'FUNDING_STOP' });
    expect(provider.respond).not.toHaveBeenCalled();
    expect(await attempts()).toBe(0);
  });
});
