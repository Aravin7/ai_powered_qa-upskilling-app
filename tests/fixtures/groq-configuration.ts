import { catalogue } from '../../src/lib/catalogue';
import { GROQ_MODEL, GROQ_NOTICE, GROQ_NATIVE_TOOL_LIMIT, type GroqConfiguration } from '../../src/lib/ai-execution';
import { createHash } from 'node:crypto';
export function syntheticGroqConfiguration():GroqConfiguration{return {
 model:GROQ_MODEL,catalogueVersion:catalogue.version,maxOutputTokens:4096,maxRequestBytes:64000,
 ceilingRequests:20,expiresAt:new Date(Date.now()+3600000).toISOString(),freePlanConfirmed:true,
 privacyNotice:GROQ_NOTICE,dataScope:'synthetic-only',
};}
export function syntheticWorkflowConfiguration():GroqConfiguration{
 const config=syntheticGroqConfiguration();
 config.privacyNotice='Synthetic mocked workflow notice only. Groq and native search receive topic/direction labels and reviewed public source hosts; application page checks inspect public pages. No real permission, provider terms, billing or retention approval is asserted by this test fixture.';
 config.workflow={approvalReference:'Synthetic test approval only',providerTermsReference:'Synthetic free-tool test terms',privacyTermsReference:'Synthetic privacy test terms',approvedNoticeSha256:createHash('sha256').update(config.privacyNotice).digest('hex'),freeNativeToolsConfirmed:true,maximumCharge:0,nativeOrchestration:'provider-managed-no-hard-call-cap',maxReportedToolCalls:GROQ_NATIVE_TOOL_LIMIT};
 return config;
}
