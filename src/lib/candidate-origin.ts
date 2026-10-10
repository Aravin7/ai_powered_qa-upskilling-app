import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { mockConfiguration } from './ai-config';
import type { Claims } from './store';
export function fingerprint(value:string|Uint8Array){return createHmac('sha256',mockConfiguration().secret).update(value).digest('hex')}
const payloadSchema=z.object({owner:z.string(),session:z.number().int(),consent:z.number().int(),operation:z.string().uuid(),binding:z.string(),expires:z.number()}).strict();
export function signCandidate(claims:Claims,consent:number,operation:string,skillId:string|null,label:string){
 const payload=Buffer.from(JSON.stringify({owner:claims.id,session:claims.sessionVersion,consent,operation,binding:fingerprint(JSON.stringify([skillId,label])),expires:Date.now()+15*60*1000})).toString('base64url');
 return `${payload}.${fingerprint(payload)}`;
}
export function verifyCandidate(token:string,claims:Claims,consent:number,skillId:string|null,label:string){
 try{
  const [payload,signature,...extra]=token.split('.');if(extra.length||!signature)return false;
  const expected=Buffer.from(fingerprint(payload));const actual=Buffer.from(signature);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
  const data=payloadSchema.parse(JSON.parse(Buffer.from(payload,'base64url').toString('utf8')));
  return data.owner===claims.id&&data.session===claims.sessionVersion&&data.consent===consent&&data.expires>Date.now()&&data.binding===fingerprint(JSON.stringify([skillId,label]));
 }catch{return false;}
}
