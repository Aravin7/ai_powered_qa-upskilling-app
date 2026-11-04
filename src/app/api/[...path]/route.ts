import { getServerSession } from 'next-auth';
import { ZodError } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { DomainError, compare, consentSchema, generateSchema } from '@/lib/domain';
import { getState, putProfile, putSkills, putConsent, patchTask, deleteAccount, endSession, putPathwayPreferences, selectPathway } from '@/lib/store';
import { extractSkills, generateRoadmap, operationStatus, suggestPathways, researchResourcePreview, researchReviewedResources } from '@/lib/ai-operations';
import { parsePdf, readPdfUpload } from '@/lib/pdf';
import { prepareCvText } from '@/lib/cv-text';
import { confirmSkillReconciliation, currentSkillReviewAvailability, previewSkillReconciliation } from '@/lib/skill-reconciliation';
import { getReviewedGaps, reviewedDirectionOptions, saveReviewedDirection } from '@/lib/reviewed-direction';
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
  else if(req.method==='GET'&&path==='pathways/reviewed')data=await reviewedDirectionOptions(client,claims);
  else if(req.method==='PUT'&&path==='pathways/reviewed')data=await saveReviewedDirection(client,claims,await readJson(req));
  else if(req.method==='POST'&&path==='pathways/reviewed/resources'){
   const result=await researchReviewedResources(client,claims,await readJson(req));
   return response(result.code,result.code==='RESOURCES_READY'?'Topic resources saved with automatic source/page checks; not professional review.':'Synthetic topic resource operation status; no live page checks.',result);
  }
  else if(req.method==='GET'&&path==='requirements/active')data=await currentSkillReviewAvailability(client,claims);
  else if(req.method==='GET'&&path==='skills/reconciliation'){
   const version=new URL(req.url).searchParams.get('version');
   data=await previewSkillReconciliation(client,claims,version);
  }
  else if(req.method==='PUT'&&path==='skills/reconciliation'){
   await confirmSkillReconciliation(client,claims,await readJson(req));
   data=await getState(client,claims);
  }
  else if(req.method==='GET'&&path==='gaps'){
   const reviewed=await getReviewedGaps(client,claims);
   if(reviewed)return response('OK','Comparison of confirmed self-report; this does not certify competence.',reviewed);
   if(state.pathwayExploration?.selectedSuggestionId)throw new DomainError('CONTENT_REVIEW_REQUIRED','The selected provisional direction has no reviewed requirement set. Existing plan and progress are preserved.',409);
   if(state.processing?.mode!=='mock')throw new DomainError('DIRECTION_REQUIRED','Select a reviewed QA direction in Explore directions before comparing learning needs.',409);
   data=compare(state.skills);
  }
  else if(req.method==='GET'&&path==='roadmap')data=state.roadmap;
  else if(req.method==='POST'&&path==='session/end'){await endSession(client,claims);data=null;}
  else if(req.method==='GET'&&/^ai\/operations\/[a-zA-Z0-9-]{1,80}$/.test(path))data=await operationStatus(client,claims,path.split('/')[2]);
  else if(req.method==='POST'&&path==='pathways/resources'){
   const result=await researchResourcePreview(client,claims,await readJson(req));
   return response(result.code,'Synthetic resource preview only; no live web search or real page verification.',result);
  }
  else if(req.method==='PUT'&&path==='profile')data=await putProfile(client,claims,await readJson(req));
  else if(req.method==='PUT'&&path==='pathways/preferences')data=await putPathwayPreferences(client,claims,await readJson(req));
  else if(req.method==='PUT'&&path==='pathways/select')data=await selectPathway(client,claims,await readJson(req));
  else if(req.method==='POST'&&path==='pathways/suggest'){
   const result=await suggestPathways(client,claims,await readJson(req));
   return response(result.code,'Direction suggestion operation status; suggestions do not certify skills or suitability.',result);
  }
  else if(req.method==='PUT'&&path==='skills')data=await putSkills(client,claims,await readJson(req));
  else if(req.method==='PUT'&&path==='consent')data=await putConsent(client,claims,consentSchema.parse(await readJson(req)));
  else if(req.method==='PATCH'&&/^roadmap\/tasks\/[a-zA-Z0-9-]{1,80}$/.test(path))data=await patchTask(client,claims,path.split('/')[2],await readJson(req));
  else if(req.method==='DELETE'&&path==='account'){
   const body=await readJson(req);if(!body||Object.keys(body).length!==1||body.confirmation!=='DELETE')throw new DomainError('CONFIRMATION_REQUIRED','Type DELETE to confirm.');
   data=await deleteAccount(client,claims);
  }else if(req.method==='POST'&&path==='roadmaps/generate'){
   const result=await generateRoadmap(client,claims,generateSchema.parse(await readJson(req)));
   return response(result.code,result.code==='NO_GAPS'?'No missing listed requirements; this does not certify competence.':'Learning roadmap operation status.',result);
  }else if(req.method==='POST'&&path==='cv/prepare'){
   if(!state.consents.cv_extraction)throw new DomainError('CONSENT_REQUIRED','Enable CV extraction consent before preparing a preview.',403);
   const upload=await readPdfUpload(req);
   const parsed=await parsePdf(upload.bytes,Date.now()+45000);
   const current=await getState(client,claims);
   if(!current.consents.cv_extraction)throw new DomainError('CONSENT_REQUIRED','CV extraction consent changed; preview was discarded.',403);
   const prepared=prepareCvText(parsed.text,[claims.email,current.name,...current.name.split(/\s+/).filter(n=>n.length>2)]);
   data={blocks:prepared.blocks,warnings:[...parsed.warnings,...prepared.warnings]};
  }else if(req.method==='POST'&&path==='cv/extract'){
   if(!state.consents.cv_extraction)throw new DomainError('CONSENT_REQUIRED','Enable CV extraction consent before uploading.',403);
   const upload=await readPdfUpload(req);
   data=await extractSkills(client,claims,upload.bytes,upload.operationKey);
  }else throw new DomainError('NOT_FOUND','Route not found.',404);
  return response('OK','Saved.',data);
 }catch(e){
  if(e instanceof DomainError)return response(e.code,e.message,null,e.status);
  if(e instanceof ZodError)return response('INVALID_INPUT','Check the field values and try again.',null,400);
  return response('SERVICE_UNAVAILABLE','The service could not complete this request. Your previous saved data is preserved.',null,503);
 }
}
export {handler as GET,handler as PUT,handler as POST,handler as PATCH,handler as DELETE};
