import { getServerSession } from 'next-auth';
import { ZodError } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { DomainError, compare, consentSchema, generateSchema } from '@/lib/domain';
import { getState, putProfile, putSkills, putConsent, patchTask, deleteAccount } from '@/lib/store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function response(code:string,message:string,data:unknown,status=200){return Response.json({code,message,data},{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}
async function readJson(req:Request){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new DomainError('CONTENT_TYPE','Use a JSON request.',415);
 const reader=req.body?.getReader();if(!reader)throw new DomainError('EMPTY_BODY','A request body is required.');
 let bytes=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>32768){await reader.cancel();throw new DomainError('TOO_LARGE','Request exceeds 32 KiB.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DomainError('INVALID_JSON','The request must contain valid JSON.');}
}
async function handler(req:Request,ctx:{params:Promise<{path:string[]}>}){
 try{
  if(req.method!=='GET'){
   const expected=process.env.NEXTAUTH_URL;
   if(!expected||req.headers.get('origin')!==new URL(expected).origin)throw new DomainError('ORIGIN_DENIED','Request origin is not allowed.',403);
  }
  const session=await getServerSession(authOptions);
  if(!session?.user.id||!session.user.email)throw new DomainError('SIGN_IN_REQUIRED','Sign in with your invited Google account.',401);
  const claims={id:session.user.id,email:session.user.email,sessionVersion:session.user.sessionVersion};
  const client=db(); const state=await getState(client,claims);
  const path=(await ctx.params).path.join('/');let data:unknown;
  if(req.method==='GET'&&path==='me')data=state;
  else if(req.method==='GET'&&path==='gaps')data=compare(state.skills);
  else if(req.method==='GET'&&path==='roadmap')data=state.roadmap;
  else if(req.method==='PUT'&&path==='profile')data=await putProfile(client,claims,await readJson(req));
  else if(req.method==='PUT'&&path==='skills')data=await putSkills(client,claims,await readJson(req));
  else if(req.method==='PUT'&&path==='consent')data=await putConsent(client,claims,consentSchema.parse(await readJson(req)));
  else if(req.method==='PATCH'&&/^roadmap\/tasks\/[a-zA-Z0-9-]{1,80}$/.test(path))data=await patchTask(client,claims,path.split('/')[2],await readJson(req));
  else if(req.method==='DELETE'&&path==='account'){
   const body=await readJson(req);if(!body||Object.keys(body).length!==1||body.confirmation!=='DELETE')throw new DomainError('CONFIRMATION_REQUIRED','Type DELETE to confirm.');
   data=await deleteAccount(client,claims);
  }else if(req.method==='POST'&&path==='roadmaps/generate'){
   generateSchema.parse(await readJson(req));
   if(compare(state.skills).noGaps)return response('NO_GAPS','No missing listed requirements; this does not certify competence.',null);
   throw new DomainError('LIVE_AI_UNAVAILABLE','Live AI is not enabled in this first build. Your existing data is preserved.',503);
  }else if(req.method==='POST'&&path==='cv/extract'){
   throw new DomainError('EXTRACTION_UNAVAILABLE','CV processing is not enabled in this build. Enter skills manually; no file was processed.',503);
  }else throw new DomainError('NOT_FOUND','Route not found.',404);
  return response('OK','Saved.',data);
 }catch(e){
  if(e instanceof DomainError)return response(e.code,e.message,null,e.status);
  if(e instanceof ZodError)return response('INVALID_INPUT','Check the field values and try again.',null,400);
  return response('SERVICE_UNAVAILABLE','The service could not complete this request. Your previous saved data is preserved.',null,503);
 }
}
export {handler as GET,handler as PUT,handler as POST,handler as PATCH,handler as DELETE};
