'use client';
import { useRef, useState, useEffect } from 'react';
export type Candidate={skillId:string|null;label:string;evidenceExcerpt:string;candidateReference:string};
export function CvUpload({enabled,onCandidates,onAccessEnded}:{enabled:boolean;onCandidates:(candidates:Candidate[])=>void;onAccessEnded:()=>void}){
 const [file,setFile]=useState<File|null>(null);const [pending,setPending]=useState(false);const [message,setMessage]=useState('');
 const controller=useRef<AbortController|null>(null);
 const active=useRef(true);
 const latestCandidates=useRef(onCandidates);
 useEffect(()=>{latestCandidates.current=onCandidates;},[onCandidates]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();}},[]);
 async function extract(){
  if(!file||pending)return;
  if(file.size>2*1024*1024){setMessage('Use a PDF no larger than 2 MiB. Manual entry remains available.');return;}
  setPending(true);setMessage('Reading PDF and checking mock candidates…');
  const request=new AbortController();controller.current=request;
  const data=new FormData();data.set('file',file);data.set('operationKey',crypto.randomUUID());
  try{
   const res=await fetch('/api/cv/extract',{method:'POST',body:data,signal:request.signal,cache:'no-store'});const out=await res.json();
   if(!active.current)return;
   if(res.status===401||out.code==='ACCESS_ENDED'){onAccessEnded();return;}
   if(!res.ok)throw new Error(`${out.code}: ${out.message}`);
   latestCandidates.current(out.data.candidates);
   setMessage(`${out.data.code==='NO_EVIDENCE'?'No supported evidence found; enter skills manually.':'Review the candidates below, then confirm skills.'} ${out.data.warnings.join(' ')}`);
  }catch(error){if(active.current)setMessage(error instanceof Error?error.message:'Extraction failed. Enter skills manually; saved skills are preserved.');}
  finally{if(active.current)setPending(false);}
 }
 return <div className="card"><h3>Optional PDF CV extraction · mock provider</h3><p>Synthetic PDFs only: up to 2 MiB, 10 pages and 20,000 characters. No OCR. Files and evidence are transient; only confirmed skills are saved. Manual entry is always available.</p>{!enabled&&<p>Enable CV extraction consent in Privacy & settings first.</p>}<label>Choose synthetic PDF<input type="file" accept="application/pdf,.pdf" disabled={!enabled||pending} onChange={e=>setFile(e.target.files?.[0]??null)}/></label><button type="button" className="button secondary" disabled={!enabled||!file||pending} onClick={()=>void extract()}>{pending?'Extracting…':'Extract candidate skills'}</button>{message&&<p role="status">{message}</p>}</div>;
}
