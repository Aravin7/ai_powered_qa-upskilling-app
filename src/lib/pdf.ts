import { spawn } from 'node:child_process';
import path from 'node:path';
import { DomainError } from './domain';
import { AI_LIMITS } from './ai-config';
export async function parsePdf(bytes:Uint8Array,deadline:number):Promise<{text:string;warnings:string[]}>{
 if(bytes.length>AI_LIMITS.bytes)throw new DomainError('PDF_BYTE_LIMIT','Use a PDF no larger than 2 MiB.',413);
 if(!Buffer.from(bytes.subarray(0,8)).toString().startsWith('%PDF-'))throw new DomainError('PDF_MALFORMED','This is not a readable PDF. Use manual entry.',422);
 const remaining=Math.min(AI_LIMITS.parserMs,deadline-Date.now()-2000);
 if(remaining<=0)throw new DomainError('DEADLINE','Processing deadline reached.',504);
 return new Promise((resolve,reject)=>{
  // Process isolation also contains native parser faults; stdout/stderr cannot leak CV text.
  const worker=spawn(process.execPath,['--max-old-space-size=64',path.join(process.cwd(),'scripts/pdf-worker.cjs')],{stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced',windowsHide:true,env:{NODE_ENV:process.env.NODE_ENV,SystemRoot:process.env.SystemRoot,PATH:process.env.PATH}});
  let settled=false;
  const finish=(error:DomainError|null,result?:{text:string;warnings:string[]})=>{if(settled)return;settled=true;clearTimeout(timer);if(worker.exitCode!==null||worker.signalCode!==null){if(error)reject(error);else resolve(result!);return;}worker.once('exit',()=>error?reject(error):resolve(result!));worker.kill();};
  const timer=setTimeout(()=>finish(new DomainError('PDF_TIMEOUT','PDF processing timed out. Use manual entry or a smaller PDF.',504)),remaining);
  worker.once('message',(result:{code?:string;text:string;warnings:string[]})=>result.code?finish(new DomainError(result.code,'PDF could not be processed. Try a readable, unencrypted PDF within 10 pages and 20,000 characters, or enter skills manually.',422)):finish(null,result));
  worker.once('error',()=>finish(new DomainError('PDF_UNSUPPORTED','PDF processing failed. Manual entry remains available.',422)));
  worker.once('exit',()=>{if(!settled)finish(new DomainError('PDF_UNSUPPORTED','PDF processing ended without readable text.',422));});
  worker.send({bytes,pages:AI_LIMITS.pages,text:AI_LIMITS.text});
 });
}
export async function readPdfUpload(req:Request){
 if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new DomainError('CONTENT_TYPE','Upload a PDF as multipart form data.',415);
 const reader=req.body?.getReader();if(!reader)throw new DomainError('EMPTY_BODY','Choose a PDF.');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>AI_LIMITS.bytes+16384){await reader.cancel();throw new DomainError('PDF_BYTE_LIMIT','Upload exceeds 2 MiB.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 let form:FormData;
 try{form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();}catch{throw new DomainError('INVALID_UPLOAD','Invalid multipart upload.');}
 if([...form.keys()].sort().join(',')!=='file,operationKey')throw new DomainError('INVALID_UPLOAD','Provide one PDF and one operation key.');
 const file=form.get('file');if(!(file instanceof File))throw new DomainError('INVALID_UPLOAD','Choose an actual PDF file.');
 if(file.size>AI_LIMITS.bytes)throw new DomainError('PDF_BYTE_LIMIT','Use a PDF no larger than 2 MiB.',413);
 return {bytes:new Uint8Array(await file.arrayBuffer()),operationKey:form.get('operationKey')};
}
