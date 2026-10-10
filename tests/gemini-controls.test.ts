import { expect,it } from 'vitest';
import { configurationVersion,pilotSchema,reservationMicroUsd } from '../src/lib/gemini-pilot';
import { syntheticGeminiPilot } from './fixtures/gemini-pilot';
it('G-01 / R11: refuses alias, missing approval and zero prices rather than defaulting',()=>{
 const pilot=syntheticGeminiPilot();
 for(const changes of [{model:'gemini-flash-latest'},{approvedBy:''},{privacyNotice:''},{inputMicroUsdPerMillion:0},{expiresAt:new Date(Date.now()+172800000).toISOString()},{unknown:true}])expect(pilotSchema.safeParse({...pilot,...changes}).success).toBe(false);
});
it('G-02 / R11: conservatively reserves full model input plus bounded output with integer rounding',()=>{
 const pilot={...syntheticGeminiPilot(),maxBillableInputTokens:11,maxOutputTokens:7,inputMicroUsdPerMillion:3,outputMicroUsdPerMillion:5};
 expect(reservationMicroUsd(pilot)).toBe(1);
 expect(reservationMicroUsd(syntheticGeminiPilot())).toBe(101);
});
it('G-03 / R03/R11: changing model, price, notice or expiry changes the configuration/consent version',()=>{
 const pilot=syntheticGeminiPilot();const version=configurationVersion(pilot);
 for(const changes of [{model:'gemini-3.5-flash'},{inputMicroUsdPerMillion:101},{privacyNotice:pilot.privacyNotice+' Changed.'},{expiresAt:new Date(Date.now()+7200000).toISOString()}])expect(configurationVersion({...pilot,...changes})).not.toBe(version);
});
