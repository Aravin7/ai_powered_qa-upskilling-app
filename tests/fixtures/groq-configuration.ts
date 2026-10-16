import { catalogue } from '../../src/lib/catalogue';
import { GROQ_MODEL, GROQ_NOTICE, type GroqConfiguration } from '../../src/lib/ai-execution';
export function syntheticGroqConfiguration():GroqConfiguration{return {
 model:GROQ_MODEL,catalogueVersion:catalogue.version,maxOutputTokens:4096,maxRequestBytes:64000,
 ceilingRequests:20,expiresAt:new Date(Date.now()+3600000).toISOString(),freePlanConfirmed:true,
 privacyNotice:GROQ_NOTICE,dataScope:'synthetic-only',
};}
