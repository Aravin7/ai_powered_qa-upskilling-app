import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { DomainError } from './domain';
import { publicResourcePage, researchedSelectionSchema, type ResourceCandidate, type ResourceContext } from './resource-discovery';

const fail=()=>new DomainError('RESOURCE_VERIFICATION_REQUIRED','A source page could not be safely checked. Existing resources and plan are preserved.',502);
const normal=(value:string)=>value.normalize('NFKC').replace(/\s+/g,' ').trim();
export type InspectedPage={candidateId:string;url:string;finalUrl:string;text:string;checkedAt:string;partial:boolean};
type Address={address:string;family:number};
type PageResponse={status:number;headers:Record<string,string|undefined>;body:string};
type Dependencies={resolve:(host:string)=>Promise<Address[]>;read:(url:URL,address:Address,signal:AbortSignal)=>Promise<PageResponse>};

/** Conservative global-unicast policy. Special-use IPv6 and IPv4 transition
 * ranges are rejected as well as private/loopback/link-local addresses. */
export function publicNetworkAddress(address:string){
 const family=isIP(address);
 if(family===6){
  const [left,right]=address.toLowerCase().split('::');const a=left?left.split(':'):[],b=right?right.split(':'):[];
  const groups=[...a,...Array.from({length:8-a.length-b.length},()=>'0'),...b].map(value=>parseInt(value,16));
  return groups[0]>=0x2000&&groups[0]<=0x3fff&&groups[0]!==0x2002&&groups[0]!==0x3fff&&!(groups[0]===0x2001&&(groups[1]<0x0200||groups[1]===0x0db8));
 }
 if(family!==4)return false;
 const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||
  (a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168||(b===88&&c===99)))||
  (a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}

const read:Dependencies['read']=(url,address,signal)=>new Promise((resolve,reject)=>{
 // Connect to the resolved IP directly while retaining TLS hostname validation.
 // No second DNS lookup can turn a validated address into a private connection.
 const req=request({hostname:address.address,servername:url.hostname,port:443,path:url.pathname+url.search,method:'GET',agent:false,signal,
  headers:{Host:url.hostname,'Accept':'text/html,text/plain','Accept-Encoding':'identity','User-Agent':'QAPathway-ResourceCheck/1.0'}},response=>{
  const chunks:Buffer[]=[];let size=0;
  response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>512*1024){response.destroy(fail());return;}chunks.push(chunk);});
  response.on('error',reject);
  response.on('end',()=>resolve({status:response.statusCode??0,headers:{location:response.headers.location,'content-type':response.headers['content-type'],'content-encoding':response.headers['content-encoding']},body:Buffer.concat(chunks).toString('utf8')}));
 });
 req.on('error',reject);req.end();
});
const defaults:Dependencies={resolve:host=>lookup(host,{all:true,verbatim:true}),read};

function textFromHtml(html:string,mainOnly=true){
 const article=mainOnly?(html.match(/<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)?.[1]??html):html;
 return normal(article.replace(/<!--[^]*?-->|<(script|style|noscript)\b[^>]*>[^]*?<\/\1>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,code:string)=>{const n=code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):Number(code);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';})
  .replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,name:string)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[name]??' ')));
}
function topicWords(context:ResourceContext){return [...new Set((context.topicTerms??[context.topicTitle]).flatMap(term=>normal(term).toLowerCase().match(/[a-z][a-z0-9+#-]{1,}/g)??[]).filter(word=>(word.length>=4||['api','ci','llm','rag','sql'].includes(word))&&!['with','from','using','testing','test','application','applications'].includes(word)))];}

const tokens=(value:string)=>normal(value).toLowerCase().match(/[a-z0-9+#-]+/g)??[];
function relevantPassage(context:ResourceContext,passage:string){
 const words=tokens(passage),set=new Set(words);
 return (context.topicTerms??[context.topicTitle]).some(term=>{
  const phrase=tokens(term),distinctive=topicWords({...context,topicTerms:[term]});
  // Match complete reviewed terms/aliases, or multiple discriminating words
  // from the same term. A shared word such as "browser" alone is insufficient.
  return distinctive.length>0&&(words.some((_,index)=>phrase.every((word,offset)=>words[index+offset]===word))||distinctive.filter(word=>set.has(word)).length>=2);
 });
}
const conditions=/\b(?:sign[ -]?in|log[ -]?in|account|payment|paid|purchase|subscription|premium|prerequisites?|prior knowledge|requires?|install|version|english|language)\b/i;
function boundedPassages(passages:string[],limit:number){
 let result='';for(const passage of passages){if(result.length+passage.length+1<=limit)result+=`${result?' ':''}${passage.trim()}`;}return result;
}

export async function inspectResourcePages(context:ResourceContext,candidates:ResourceCandidate[],signal:AbortSignal,dependencies:Dependencies=defaults):Promise<InspectedPage[]>{
 if(candidates.length<2||candidates.length>4)throw fail();
 const controller=new AbortController();const bounded=AbortSignal.any([signal,AbortSignal.timeout(5000),controller.signal]);
 let rejectAbort!:(reason:unknown)=>void;
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject;});
 const onAbort=()=>rejectAbort(fail());bounded.addEventListener('abort',onAbort,{once:true});
 if(bounded.aborted)onAbort();
 const jobs=candidates.map(async candidate=>{
  return Promise.race([aborted,(async()=>{
  let url=publicResourcePage(candidate.url);
  for(let redirect=0;redirect<=3;redirect++){
   bounded.throwIfAborted();const addresses=await dependencies.resolve(url.hostname);
   bounded.throwIfAborted();
   if(!addresses.length||addresses.some(item=>!publicNetworkAddress(item.address)))throw fail();
   const response=await dependencies.read(url,addresses[0],bounded);
   if([301,302,303,307,308].includes(response.status)){
    if(!response.headers.location||redirect===3)throw fail();url=publicResourcePage(new URL(response.headers.location,url).href);continue;
   }
   if(response.status!==200||response.headers['content-encoding']||!/^(?:text\/html|text\/plain)(?:;|$)/i.test(response.headers['content-type']??''))throw fail();
   const text=textFromHtml(response.body);if(text.length<40)throw fail();
   // Explicitly bounded input excerpts, never truncated model output. Preserve
   // topic-bearing sentences and disclose a partial page inspection.
   const sentences=text.match(/[^.!?]+[.!?]?/g)??[text];
   const passages=sentences.filter(part=>relevantPassage(context,part));
   const topic=boundedPassages(passages,6000);
   // Keep independent access/setup context even when it has no topic terms.
   const fullText=textFromHtml(response.body,false);
   const contextText=boundedPassages((fullText.match(/[^.!?]+[.!?]?/g)??[fullText]).filter(part=>conditions.test(part)&&!topic.includes(part.trim())),1900);
   const excerpt=[topic,contextText].filter(Boolean).join(' ');
   if(!topic.trim())throw fail();
   return {candidateId:candidate.id,url:candidate.url,finalUrl:url.href,text:normal(excerpt),checkedAt:new Date().toISOString(),partial:normal(excerpt)!==fullText};
  }
  throw fail();
  })()]);
 });
 try{
  const results=await Promise.allSettled(jobs);
  if(signal.aborted)throw fail();
  const pages=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  const usable=candidates.filter(candidate=>pages.some(page=>page.candidateId===candidate.id));
  if(!usable.some(candidate=>candidate.kind==='documentation')||!usable.some(candidate=>candidate.kind!=='documentation'))throw fail();
  return pages;
 }finally{controller.abort();bounded.removeEventListener('abort',onAbort);}
}

/** Model judgments must cite exact independently retrieved text. Official
 * publishers are bounded by this topic's reviewed authoritative source hosts. */
export function verifiedResourceChecks(context:ResourceContext,candidates:ResourceCandidate[],pages:InspectedPage[],output:unknown){
 const selection=researchedSelectionSchema.parse(output);const selected=[selection.documentationId,selection.supportingId];
 if(selected[0]===selected[1]||new Set(selection.evidence.map(item=>item.candidateId)).size!==2)throw fail();
 const destinations=selected.map(id=>{const page=pages.find(item=>item.candidateId===id);if(!page)throw fail();const url=new URL(page.finalUrl);url.hash='';return url.href;});
 if(new Set(destinations).size!==2)throw fail();
 return selected.map((id,index)=>{
  const candidate=candidates.find(item=>item.id===id),page=pages.find(item=>item.candidateId===id),evidence=selection.evidence.find(item=>item.candidateId===id);
  if(!candidate||!page||!evidence||page.url!==candidate.url)throw fail();
  const excerpt=normal(evidence.topicExcerpt);
  if(!normal(page.text).includes(excerpt)||!relevantPassage(context,excerpt)||
    (evidence.accessExcerpt&&!page.text.includes(normal(evidence.accessExcerpt)))||(['sign-in','payment'].includes(evidence.access)&&!evidence.accessExcerpt))throw fail();
  if(['sign-in','payment'].includes(evidence.access)){
   const access=normal(evidence.accessExcerpt);
   const condition=evidence.access==='payment'?/\b(?:payment|paid|purchase|subscription|premium|fee|billed)\b/i:/\b(?:sign[ -]?in|log[ -]?in|login|register|registration|create an? account)\b/i;
   if(!condition.test(access)||/\b(?:no|without|not required|not necessary)\b/i.test(access))throw fail();
  }
  const final=new URL(page.finalUrl);const host=final.hostname;
  let official=!!context.officialDocumentationHosts?.includes(host);
  if(['github.com','gitlab.com','bitbucket.org','docs.google.com'].includes(host))official=official&&!!context.officialDocumentationSources?.some(raw=>{
   const source=new URL(raw);const namespace=source.pathname.split('/').filter(Boolean).slice(0,2).join('/');
   return source.hostname===host&&!!namespace&&(final.pathname===`/${namespace}`||final.pathname.startsWith(`/${namespace}/`));
  });
  if(index===0&&!official)throw fail();
  const contextSentences=(page.text.match(/[^.!?]+[.!?]?/g)??[page.text]).filter(part=>conditions.test(part));
  const observed=boundedPassages(contextSentences,150);
  const accessNote=evidence.access==='public-page'?'Public page retrieved; full material access is unconfirmed.':evidence.access==='unclear'?'Access beyond this page is unclear.':`${evidence.access}: ${normal(evidence.accessExcerpt).slice(0,100)}`;
  return {candidateId:id,url:candidate.url,topicId:context.topicId,available:true,topicRelevant:true,officialDocumentation:official,detectedKind:candidate.kind,
   accessNote:`${accessNote}${observed?` Page states: ${observed}`:' Access/prerequisites not established.'}${page.partial?' Partial page check.':''} Relevance is automatically checked, not professionally reviewed.`,checkedAt:page.checkedAt};
 });
}
