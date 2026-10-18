'use client';
import { useRef, useState, useEffect } from 'react';
export type Candidate={skillId:string|null;label:string;evidenceExcerpt:string;candidateReference:string;sourceId?:string;evidenceType?:'demonstrated'|'listed'};
type PreparedBlock={id:string;section:string;text:string};
type PreparedPreview={blocks:PreparedBlock[];warnings:string[]};
async function postPdf(path:string,file:File){
 const data=new FormData();data.set('file',file);data.set('operationKey',crypto.randomUUID());
 return fetch(path,{method:'POST',body:data,cache:'no-store'});
}
export function CvUpload({enabled,onCandidates,onAccessEnded,provider='mock provider'}:{enabled:boolean;onCandidates:(candidates:Candidate[])=>void;onAccessEnded:()=>void;provider?:string}){
 const [file,setFile]=useState<File|null>(null);const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 const [preview,setPreview]=useState<PreparedPreview|null>(null);const [approved,setApproved]=useState(false);
 const controller=useRef<AbortController|null>(null);
 const active=useRef(true);
 const latestCandidates=useRef(onCandidates);
 useEffect(()=>{latestCandidates.current=onCandidates;},[onCandidates]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();}},[]);
 async function request(path:string){
  if(!file||pending)return;
  if(file.size>2*1024*1024){setMessage('Use a PDF no larger than 2 MiB. Manual entry remains available.');return;}
  setPending(true);setMessage(path.endsWith('/prepare')?'Reading PDF and preparing a private preview…':'Sending the reviewed PDF text for skill suggestions…');
  const requestController=new AbortController();controller.current=requestController;
  try{
   const res=await postPdf(path,file);const out=await res.json();
   if(!active.current)return;
   if(res.status===401||out.code==='ACCESS_ENDED'){onAccessEnded();return;}
   if(!res.ok)throw new Error(`${out.code}: ${out.message}`);
   if(path.endsWith('/prepare')){
    setPreview(out.data);setApproved(false);
    setMessage('Review the prepared text below. If personal, location, employer or education details remain, cancel and redact the PDF before continuing.');
   }else{
    latestCandidates.current(out.data.candidates);
    setPreview(null);setApproved(false);
    setMessage(`${out.data.code==='NO_EVIDENCE'?'No supported evidence found; enter skills manually.':'Review the candidates below, then confirm skills.'} ${out.data.warnings.join(' ')}`);
   }
  }catch(error){if(active.current)setMessage(error instanceof Error?error.message:'CV processing failed. Enter skills manually; saved skills are preserved.');}
  finally{if(active.current)setPending(false);}
 }
 return <div className="card">
  <h3>Optional PDF CV extraction · {provider}</h3>
  <p>Synthetic PDFs only: up to 2 MiB, 10 pages and 20,000 characters. No OCR. Relevant professional sections are retained; detectable personal, company, client and project details are removed. Redaction is imperfect. Files and evidence are transient; only confirmed skills are saved. Manual entry is always available.</p>
  {!enabled&&<p>Enable CV extraction consent in Privacy & settings first.</p>}
  <label>Choose synthetic PDF<input type="file" accept="application/pdf,.pdf" disabled={!enabled||pending} onChange={e=>{setFile(e.target.files?.[0]??null);setPreview(null);setApproved(false);setMessage('');}}/></label>
  {!preview&&<button type="button" className="button secondary" disabled={!enabled||!file||pending} onClick={()=>void request('/api/cv/prepare')}>{pending?'Preparing preview…':'Prepare private preview'}</button>}
  {preview&&<section aria-label="Prepared CV text review">
   <h4>Review before sending to {provider}</h4>
   {preview.warnings.map((warning,index)=><p className="small muted" key={`${index}-${warning}`}>{warning}</p>)}
   <div className="cv-preview">{preview.blocks.map(block=><article key={block.id}><strong>{block.section}</strong><p>{block.text}</p></article>)}</div>
   <p className="small muted">This preview is temporary. If it contains details you want removed, cancel, redact your PDF on your device and select the corrected file.</p>
   <label className="check-label"><input type="checkbox" checked={approved} disabled={!enabled||pending} onChange={e=>setApproved(e.target.checked)}/>I reviewed this prepared text and want to send it for skill suggestions.</label>
   <div className="actions"><button type="button" className="button secondary" disabled={pending} onClick={()=>{setPreview(null);setApproved(false);setMessage('Preview cancelled. Your saved skills are unchanged.');}}>Cancel preview</button><button type="button" className="button primary" disabled={!enabled||!approved||pending} onClick={()=>void request('/api/cv/extract')}>{pending?'Processing…':'Send reviewed text for skill suggestions'}</button></div>
  </section>}
  {message&&<p role="status">{message}</p>}
 </div>;
}
