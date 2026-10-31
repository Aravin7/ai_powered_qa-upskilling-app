import { createHash } from 'node:crypto';
import { catalogue } from '../../src/lib/catalogue';
import {
  GROQ_MODEL,
  GROQ_NOTICE,
  GROQ_NATIVE_TOOL_LIMIT,
  type GroqConfiguration,
} from '../../src/lib/ai-execution';

export function syntheticGroqConfiguration(): GroqConfiguration {
  return {
    model: GROQ_MODEL,
    catalogueVersion: catalogue.version,
    maxOutputTokens: 4096,
    maxRequestBytes: 64000,
    ceilingRequests: 20,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    freePlanConfirmed: true,
    privacyNotice: GROQ_NOTICE,
    dataScope: 'synthetic-only',
  };
}

// Historical native-search fixture. No real account permission is asserted.
export function syntheticWorkflowConfiguration(): GroqConfiguration {
  const config = syntheticGroqConfiguration();
  config.privacyNotice =
    'Synthetic mocked workflow notice only. Groq and native search receive ' +
    'topic/direction labels and reviewed public source hosts; application ' +
    'page checks inspect public pages. No real permission, provider terms, ' +
    'billing or retention approval is asserted by this fixture.';
  config.workflow = {
    approvalReference: 'Synthetic test approval only',
    providerTermsReference: 'Synthetic free-tool test terms',
    privacyTermsReference: 'Synthetic privacy test terms',
    approvedNoticeSha256: createHash('sha256').update(config.privacyNotice).digest('hex'),
    freeNativeToolsConfirmed: true,
    maximumCharge: 0,
    nativeOrchestration: 'provider-managed-no-hard-call-cap',
    maxReportedToolCalls: GROQ_NATIVE_TOOL_LIMIT,
  };
  return config;
}

// LLM-only test fixture; HTTP is intercepted. This is NOT live authorization.
export function syntheticLLMWorkflowConfiguration(): GroqConfiguration {
  const config = syntheticGroqConfiguration();
  config.privacyNotice = [
    'Synthetic local QA learning-roadmap test.',
    'Groq receives reviewed QA direction and topic information,',
    'confirmed capability IDs and weekly learning capacity.',
    'The LLM suggests resource URLs without Browser Search.',
    'The application independently checks public resource pages,',
    'relevance and access conditions before storing resources.',
    'No real provider billing, retention approval or professional',
    'resource review is asserted by this synthetic test fixture.',
  ].join(' ');
  config.llmWorkflow = {
    resourceMode: 'llm-only',
    approvalReference: 'Synthetic LLM-only test fixture',
    providerTermsReference: 'Synthetic provider terms fixture',
    privacyTermsReference: 'Synthetic privacy terms fixture',
    approvedNoticeSha256: createHash('sha256').update(config.privacyNotice).digest('hex'),
    maximumCharge: 0,
  };
  return config;
}
