// Imported only by server services. A key alone can never enable paid dispatch.
import { DomainError } from './domain';
export const AI_LIMITS = { bytes: 2 * 1024 * 1024, pages: 10, text: 20000, candidates: 40, parserMs: 8000, totalMs: 45000, providerMs: 12000, outputBytes: 100000 } as const;
export function mockConfiguration() {
 if(process.env.NODE_ENV==='production'||process.env.AI_MODE!=='mock')throw new DomainError('AI_DISABLED','Only explicitly configured local mock processing is available. Paid AI is disabled.',503);
 const secret=process.env.AI_SIGNING_SECRET;
 if(!secret||secret.length<32)throw new DomainError('AI_CONFIGURATION','Configure a server signing secret of at least 32 characters.',503);
 if(!process.env.AI_BUDGET_ID)throw new DomainError('FUNDING_STOP','Configure the shared mock budget before processing.',503);
 return {secret,budgetId:process.env.AI_BUDGET_ID};
}
