import { expect,it } from 'vitest';
import { configurationVersion,groqConfigurationSchema } from '../src/lib/ai-execution';
import { syntheticGroqConfiguration, syntheticWorkflowConfiguration } from './fixtures/groq-configuration';
it('GR-01 / R11: fixed model, confirmed free account and synthetic scope are mandatory',()=>{
 const config=syntheticGroqConfiguration();
 for(const changes of [{model:'gemini-flash-latest'},{freePlanConfirmed:false},{dataScope:'real-cvs'},{ceilingRequests:0},{unknown:true}])expect(groqConfigurationSchema.safeParse({...config,...changes}).success).toBe(false);
});
it('GR-02 / R03/R11: notice, allowance, expiry and request limits bind consent and operations',()=>{
 const config=syntheticGroqConfiguration();const version=configurationVersion(config);
 for(const changes of [{ceilingRequests:10},{privacyNotice:config.privacyNotice+' Changed.'},{maxOutputTokens:2048},{expiresAt:new Date(Date.now()+7200000).toISOString()}])expect(configurationVersion({...config,...changes})).not.toBe(version);
});
it('GR-03 / R03/R11: connected workflow approval binds its exact notice and permits no paid native-tool fallback',()=>{
 const config=syntheticWorkflowConfiguration();expect(groqConfigurationSchema.safeParse(config).success).toBe(true);
 expect(configurationVersion(config)).not.toBe(configurationVersion(syntheticGroqConfiguration()));
 for(const change of [{maximumCharge:1},{freeNativeToolsConfirmed:false},{approvalReference:''},{approvedNoticeSha256:'0'.repeat(64)},{maxReportedToolCalls:0}])expect(groqConfigurationSchema.safeParse({...config,workflow:{...config.workflow,...change}}).success).toBe(false);
 expect(groqConfigurationSchema.safeParse({...config,privacyNotice:config.privacyNotice+' Changed.'}).success).toBe(false);
});
it('GR-04: native browser allowance defaults to six, rejects seven and changes the configuration binding',()=>{
 const config=syntheticWorkflowConfiguration();
 expect(config.workflow!.maxReportedToolCalls).toBe(6);
 const {maxReportedToolCalls:omitted,...workflow}=config.workflow!;void omitted;
 expect(groqConfigurationSchema.parse({...config,workflow}).workflow!.maxReportedToolCalls).toBe(6);
 expect(groqConfigurationSchema.safeParse({...config,workflow:{...workflow,maxReportedToolCalls:7}}).success).toBe(false);
 expect(configurationVersion(config)).not.toBe(configurationVersion({...config,workflow:{...workflow,maxReportedToolCalls:2}}));
});
