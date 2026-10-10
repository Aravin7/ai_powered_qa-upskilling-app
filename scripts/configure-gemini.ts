import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { db } from '../src/lib/db';
import { catalogue } from '../src/lib/catalogue';
import { pilotSchema, configurationVersion, reservationMicroUsd } from '../src/lib/gemini-pilot';
const budgetId=process.env.AI_BUDGET_ID;
const argument=process.argv[2];
if(!budgetId||!argument)throw new Error('Set AI_BUDGET_ID and supply a private approved configuration file, or --revoke.');
const client=db();
try{
 if(argument==='--revoke'){
  await client.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});
  console.log('Funding disabled. Further dispatch and late activation are blocked.');
 }else{
  const bytes=await readFile(argument);
  if(bytes.length>16384)throw new Error('Configuration exceeds 16 KiB.');
  const pilot=pilotSchema.parse(JSON.parse(bytes.toString('utf8')));
  if(new Date(pilot.expiresAt)<=new Date()||new Date(pilot.pricingVerifiedAt)>new Date())throw new Error('Approval/price dates are not current.');
  if(!catalogue.reviewed||catalogue.version!==pilot.catalogueVersion)throw new Error('A matching reviewed catalogue is required.');
  const version=configurationVersion(pilot);reservationMicroUsd(pilot);
  await client.$transaction(async tx=>{
   const existing=await tx.fundingBudget.findUnique({where:{id:budgetId}});
   if(existing){if(existing.pricingVersion!==version||existing.mode!=='gemini'||!existing.enabled)throw new Error('Existing budget differs or is revoked. Use a new approved budget ID; no balances are reset.');return;}
   await tx.fundingBudget.create({data:{id:budgetId,mode:'gemini',currency:'USD_MICRO',pricingVersion:version,ceiling:pilot.ceilingMicroUsd,expiresAt:new Date(pilot.expiresAt),configuration:pilot}});
   await tx.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
  });
  console.log('Approved Gemini funding recorded; existing balances were preserved. No provider request was made.');
 }
}finally{await client.$disconnect();}
