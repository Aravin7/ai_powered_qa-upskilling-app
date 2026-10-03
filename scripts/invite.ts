import 'dotenv/config';
import { db } from '../src/lib/db';
const email=process.argv[2]?.trim().toLowerCase();
const revoke=process.argv.includes('--revoke');
if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Usage: npm run db:invite -- email@example.com [--revoke]');
const client=db();
try{await client.invitation.upsert({where:{email},create:{email,active:!revoke},update:{active:!revoke}});console.log(revoke?'Invitation revoked.':'Invitation active. Use synthetic inputs only until admission gates are met.');}finally{await client.$disconnect();}
