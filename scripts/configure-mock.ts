import 'dotenv/config';
import { db } from '../src/lib/db';
import { catalogue } from '../src/lib/catalogue';
import { mockConfiguration } from '../src/lib/ai-config';
const config=mockConfiguration();
const client=db();
try{
 // Creation only. Rerunning setup never replenishes consumed units or rewrites a published revision.
 await client.fundingBudget.upsert({where:{id:config.budgetId},update:{},create:{id:config.budgetId,mode:'mock',currency:'MOCK',pricingVersion:'mock-v1',ceiling:100,expiresAt:new Date(Date.now()+7*86400000)}});
 await client.catalogueRevision.upsert({where:{id:'active'},update:{},create:{id:'active',version:catalogue.version,revision:1}});
 console.log('Local mock configuration ready: 100 synthetic reservation units for 7 days on first creation; existing balances are unchanged. No paid calls enabled.');
}finally{await client.$disconnect();}
