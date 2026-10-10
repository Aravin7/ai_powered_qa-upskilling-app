import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { catalogue } from '../../src/lib/catalogue';
import { POLICY_VERSION } from '../../src/lib/domain';
import { syntheticPdf } from '../synthetic-pdf';
const e2eOrigin = `http://127.0.0.1:${process.env.E2E_PORT ?? '3000'}`;

test.skip(process.env.RUN_AUTHENTICATED_E2E !== 'true', 'Requires a separately migrated TEST_DATABASE_URL and a synthetic signed session; this is not Google OAuth.');
test.setTimeout(90000);

async function fixture(context: BrowserContext, page: Page) {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL!, max: 3 }) });
  const email = `qa-api-${crypto.randomUUID()}@example.invalid`;
  const budgetId = process.env.AI_BUDGET_ID!;
  try {
    await client.invitation.create({ data: { email } });
    const user = await client.user.create({ data: { email, googleSubject: crypto.randomUUID(), name: 'Synthetic Learner', profile: { create: {} } } });
    await client.catalogueRevision.upsert({ where: { id: 'active' }, update: {}, create: { id: 'active', version: catalogue.version, revision: 1 } });
    await client.fundingBudget.upsert({ where: { id: budgetId }, update: {}, create: { id: budgetId, mode: 'mock', currency: 'MOCK', pricingVersion: 'mock-v1', ceiling: 30, expiresAt: new Date(Date.now() + 3600000) } });
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { uid: user.id, email, sessionVersion: 0, name: user.name }, maxAge: 3600 });
    await context.addCookies([{ name: 'next-auth.session-token', value: token, url: e2eOrigin, httpOnly: true, sameSite: 'Lax' }]);
    expect((await page.request.get('/api/me')).status()).toBe(200);
    return { client, user, email, budgetId };
  } catch (error) {
    await client.user.deleteMany({ where: { email } });
    await client.invitation.deleteMany({ where: { email } });
    await client.$disconnect();
    throw error;
  }
}
async function cleanup(data: Awaited<ReturnType<typeof fixture>>) {
  await data.client.user.deleteMany({ where: { email: data.email } });
  await data.client.invitation.deleteMany({ where: { email: data.email } });
  await data.client.$disconnect();
}
test.afterAll(async () => {
  if (process.env.RUN_AUTHENTICATED_E2E !== 'true') return;
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL!, max: 1 }) });
  try { await client.fundingBudget.deleteMany({ where: { id: process.env.AI_BUDGET_ID! } }); }
  finally { await client.$disconnect(); }
});
const origin = { origin: e2eOrigin };

test('WF-03a / R03 / T02: private profile API rejects invalid hours before onboarding advances', async ({ context, page }) => {
  const data = await fixture(context, page);
  try {
    for (const value of [0, 41, 1.5, '5']) {
      const response = await page.request.put('/api/profile', { headers: origin, data: { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: value, expectedRevision: 0 } });
      expect(response.status()).toBe(400);
      expect((await response.json()).code).toBe('INVALID_INPUT');
      expect((await data.client.profile.findUniqueOrThrow({ where: { userId: data.user.id } })).confirmed).toBe(false);
    }
    const one = await page.request.put('/api/profile', { headers: origin, data: { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: 1, expectedRevision: 0 } });
    expect(one.status()).toBe(200);
    expect((await one.json()).data.profile.hoursPerWeek).toBe(1);
    const forty = await page.request.put('/api/profile', { headers: origin, data: { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: 40, expectedRevision: 1 } });
    expect(forty.status()).toBe(200);
    expect((await forty.json()).data.profile.hoursPerWeek).toBe(40);
  } finally { await cleanup(data); }
});

test('CV-05d / R04-R05 / T03-T04: private upload requires CV consent and leaves inventory unconfirmed', async ({ context, page }) => {
  const data = await fixture(context, page);
  try {
    const upload = () => page.request.post('/api/cv/extract', { headers: origin, multipart: { file: { name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from(syntheticPdf()) }, operationKey: crypto.randomUUID() } });
    const denied = await upload();
    expect(denied.status()).toBe(403);
    expect((await denied.json()).code).toBe('CONSENT_REQUIRED');
    expect(await data.client.aIAttempt.count({ where: { operation: { userId: data.user.id } } })).toBe(0);
    const consent = await page.request.put('/api/consent', { headers: origin, data: { purpose: 'cv_extraction', granted: true, policyVersion: POLICY_VERSION } });
    expect(consent.status()).toBe(200);
    const accepted = await upload();
    expect(accepted.status()).toBe(200);
    expect((await accepted.json()).data.candidates).toHaveLength(3);
    expect(await data.client.confirmedSkill.count({ where: { userId: data.user.id } })).toBe(0);
  } finally { await cleanup(data); }
});

test('WF-05a / R05-R07 / T05-T06: manual skills and deterministic gaps work without CV consent', async ({ context, page }) => {
  const data = await fixture(context, page);
  try {
    const profile = await page.request.put('/api/profile', { headers: origin, data: { currentRole: 'QA engineer', yearsExperience: 6, hoursPerWeek: 5, expectedRevision: 0 } });
    expect(profile.status()).toBe(200);
    const saved = await page.request.put('/api/skills', { headers: origin, data: { entries: catalogue.skills.slice(0, 3).map(skill => ({ canonicalSkillId: skill.id, label: skill.label })), removals: [], expectedRevision: 1 } });
    expect(saved.status()).toBe(200);
    const gaps = await page.request.get('/api/gaps?priority=critical&skillId=forged');
    expect(gaps.status()).toBe(200);
    const answer = (await gaps.json()).data;
    expect(answer.gaps.map((skill: { id: string }) => skill.id)).toEqual(catalogue.skills.slice(3).map(skill => skill.id));
    expect(answer.catalogueVersion).toBe(catalogue.version);
    expect((await page.request.get('/api/me')).status()).toBe(200);
    expect(await data.client.consent.count({ where: { userId: data.user.id, purpose: 'cv_extraction' } })).toBe(0);
  } finally { await cleanup(data); }
});
