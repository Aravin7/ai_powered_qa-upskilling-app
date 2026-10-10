import { catalogue } from '../../src/lib/catalogue';
import type { GeminiPilot } from '../../src/lib/gemini-pilot';
// Fictional prices/approval/notice for isolated tests. Not approval for live use.
export function syntheticGeminiPilot():GeminiPilot{return {
 model:'gemini-3.6-flash',catalogueVersion:catalogue.version,maxBillableInputTokens:1000000,maxOutputTokens:4096,maxRequestBytes:64000,
 inputMicroUsdPerMillion:100,outputMicroUsdPerMillion:100,ceilingMicroUsd:100000,
 pricingReference:'https://ai.google.dev/gemini-api/docs/pricing',pricingVerifiedAt:new Date(Date.now()-60000).toISOString(),pricingValidUntil:new Date(Date.now()+86400000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),
 approvedBy:'Synthetic operator',approvalReference:'synthetic-fixture-only',privacyNotice:'Synthetic test notice: no network requests leave the intercepted provider boundary. No real approval or provider retention claim.',dataScope:'synthetic-only',
};}
