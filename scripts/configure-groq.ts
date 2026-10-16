import 'dotenv/config';
import { db } from '../src/lib/db';
import { catalogue } from '../src/lib/catalogue';
import { configurationVersion, groqConfigurationSchema, GROQ_MODEL, GROQ_NOTICE } from '../src/lib/ai-execution';
if(process.env.NODE_ENV==='production')throw new Error('Groq assignment demo is local only.');
const budgetId=process.env.AI_BUDGET_ID;
if(!budgetId)throw new Error('Set AI_BUDGET_ID=local-groq-demo-v1.');
const client=db();
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
    return;
   }
   const config=groqConfigurationSchema.parse({model:GROQ_MODEL,catalogueVersion:catalogue.version,maxOutputTokens:4096,maxRequestBytes:64000,
    ceilingRequests:20,expiresAt:new Date(Date.now()+7*86400000).toISOString(),freePlanConfirmed:true,dataScope:'synthetic-only',privacyNotice:GROQ_NOTICE});
   await tx.fundingBudget.create({data:{id:budgetId,mode:'groq',currency:'REQUESTS',pricingVersion:configurationVersion(config),ceiling:config.ceilingRequests,expiresAt:new Date(config.expiresAt),configuration:config}});
   await tx.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
  });
  console.log('Local Groq allowance configured: at most 20 attempts over seven days, five/user/hour. No API request made; existing counters preserved.');
 }
}finally{await client.$disconnect();}
