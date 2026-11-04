import 'dotenv/config';
import { db } from '../src/lib/db';
import { catalogue } from '../src/lib/catalogue';
import { configurationVersion, groqConfigurationSchema, workflowApprovalSchema, llmWorkflowApprovalSchema, GROQ_MODEL, GROQ_NOTICE } from '../src/lib/ai-execution';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
if(process.env.NODE_ENV==='production')throw new Error('Groq assignment demo is local only.');
const budgetId=process.env.AI_BUDGET_ID;
if(!budgetId)throw new Error('Set AI_BUDGET_ID=local-groq-demo-v1.');
const client=db();
const workflowIndex=process.argv.indexOf('--workflow-config');
// An approval file must name exactly one mode; installing this script enables neither.
const workflowFileSchema=z.union([
 z.object({privacyNotice:z.string().trim().min(40).max(3000),workflow:workflowApprovalSchema}).strict(),
 z.object({privacyNotice:z.string().trim().min(40).max(3000),llmWorkflow:llmWorkflowApprovalSchema}).strict(),
]);
const workflow=workflowIndex<0?undefined:workflowFileSchema.parse(JSON.parse(readFileSync(process.argv[workflowIndex+1]??'', 'utf8')));
try{
 if(process.argv[2]==='--revoke'){
  await client.fundingBudget.update({where:{id:budgetId},data:{enabled:false}});
  console.log('Groq dispatch and late activation disabled.');
 }else{
  if(process.env.AI_MODE!=='groq'||process.env.GROQ_FREE_PLAN_CONFIRMED!=='true'||!process.env.GROQ_API_KEY)
   throw new Error('Set AI_MODE=groq, GROQ_API_KEY and GROQ_FREE_PLAN_CONFIRMED=true after checking your account is on the Free Plan.');
  await client.$transaction(async tx=>{
   const existing=await tx.fundingBudget.findUnique({where:{id:budgetId}});
   if(existing){
    const config=groqConfigurationSchema.parse(existing.configuration);
    if(existing.mode!=='groq'||existing.currency!=='REQUESTS'||existing.pricingVersion!==configurationVersion(config)||existing.ceiling!==config.ceilingRequests||existing.expiresAt.toISOString()!==config.expiresAt||!existing.enabled||existing.expiresAt<=new Date())
     throw new Error('Existing allowance differs, expired or was revoked. Use a new budget ID; counters are never reset.');
    if(workflow){const next=groqConfigurationSchema.parse({...config,...workflow});await tx.fundingBudget.update({where:{id:budgetId},data:{configuration:next,pricingVersion:configurationVersion(next)}});}
    return;
   }
   const config=groqConfigurationSchema.parse({model:GROQ_MODEL,catalogueVersion:catalogue.version,maxOutputTokens:4096,maxRequestBytes:64000,
    ceilingRequests:20,expiresAt:new Date(Date.now()+7*86400000).toISOString(),freePlanConfirmed:true,dataScope:'synthetic-only',privacyNotice:GROQ_NOTICE,...workflow});
   await tx.fundingBudget.create({data:{id:budgetId,mode:'groq',currency:'REQUESTS',pricingVersion:configurationVersion(config),ceiling:config.ceilingRequests,expiresAt:new Date(config.expiresAt),configuration:config}});
   await tx.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
  });
  console.log('Local Groq allowance configured: at most 20 attempts over seven days, five/user/hour. No API request made; existing counters preserved.');
  if(workflow)console.log('Workflow approval metadata recorded without resetting counters or expiry. Renew consent under the changed notice before processing.');
 }
}finally{await client.$disconnect();}
