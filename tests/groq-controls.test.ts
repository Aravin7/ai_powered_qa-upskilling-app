import { expect,it } from 'vitest';
import { configurationVersion,groqConfigurationSchema } from '../src/lib/ai-execution';
import { syntheticGroqConfiguration } from './fixtures/groq-configuration';
it('GR-01 / R11: fixed model, confirmed free account and synthetic scope are mandatory',()=>{
 const config=syntheticGroqConfiguration();
 for(const changes of [{model:'gemini-flash-latest'},{freePlanConfirmed:false},{dataScope:'real-cvs'},{ceilingRequests:0},{unknown:true}])expect(groqConfigurationSchema.safeParse({...config,...changes}).success).toBe(false);
});
it('GR-02 / R03/R11: notice, allowance, expiry and request limits bind consent and operations',()=>{
 const config=syntheticGroqConfiguration();const version=configurationVersion(config);
 for(const changes of [{ceilingRequests:10},{privacyNotice:config.privacyNotice+' Changed.'},{maxOutputTokens:2048},{expiresAt:new Date(Date.now()+7200000).toISOString()}])expect(configurationVersion({...config,...changes})).not.toBe(version);
});
