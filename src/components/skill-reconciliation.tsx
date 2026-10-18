'use client';
import { useEffect, useState } from 'react';
import type { AppState } from '@/lib/types';

type Availability={available:false}|{available:true;version:string;revision:number;reviewedOn:string};
type Candidate={capabilityId:string;label:string;meaning:string;meaningVersion:string;requiresConfirmation:boolean};
type Preview={version:string;expectedRevision:number;reviewToken:string;entries:{skillKey:string;label:string;source:string;candidates:Candidate[]}[]};

export function SkillReconciliation({state,onSaved,onAccessEnded}:{state:AppState;onSaved:(next:AppState)=>void;onAccessEnded:()=>void}){
 const [availability,setAvailability]=useState<Availability|null>(null);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [choices,setChoices]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{text:string;error:boolean}|null>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   setBusy(true);setPreview(null);setChoices({});
   try{
    const activeResponse=await fetch('/api/requirements/active',{cache:'no-store',signal:controller.signal});
    const activeBody=await activeResponse.json();if(controller.signal.aborted)return;
    if(activeResponse.status===401||activeBody.code==='ACCESS_ENDED'){onAccessEnded();return;}
    if(!activeResponse.ok)throw new Error(activeBody.message||'Requirement status is unavailable.');
    const active=activeBody.data as Availability;setAvailability(active);
    if(!active.available)return;
    const response=await fetch(`/api/skills/reconciliation?version=${encodeURIComponent(active.version)}`,{cache:'no-store',signal:controller.signal});
    const body=await response.json();if(controller.signal.aborted)return;
    if(response.status===401||body.code==='ACCESS_ENDED'){onAccessEnded();return;}
    if(!response.ok)throw new Error(body.message||'Skill review is unavailable.');
    setPreview(body.data as Preview);
   }catch(error){if(!controller.signal.aborted)setMessage({text:error instanceof Error?error.message:'Could not load skill review.',error:true});}
   finally{if(!controller.signal.aborted)setBusy(false);}
  }
  void load();return()=>controller.abort();
 // Only committed inventory/revision changes refresh this transient review.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[state.profile.planningRevision,state.skills,refresh]);
 async function save(){
  if(!preview||busy)return;
  const confirmations=Object.entries(choices).filter(([,id])=>id).map(([skillKey,capabilityId])=>({skillKey,capabilityId}));
  if(!confirmations.length)return;
  setBusy(true);setMessage(null);
  try{
   const response=await fetch('/api/skills/reconciliation',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:preview.version,expectedRevision:preview.expectedRevision,reviewToken:preview.reviewToken,confirmations}),cache:'no-store'});
   const body=await response.json();
   if(response.status===401||body.code==='ACCESS_ENDED'){onAccessEnded();return;}
   if(!response.ok)throw new Error(body.message||'Unable to confirm these mappings. Refresh the review and try again.');
   onSaved(body.data as AppState);setChoices({});setMessage({text:'Reviewed mappings saved. Your original skill labels and sources remain in your inventory.',error:false});
  }catch(error){setMessage({text:error instanceof Error?error.message:'Unable to confirm mappings.',error:true});}
  finally{setBusy(false);}
 }
 return <section className="card skill-reconciliation" aria-label="Reviewed skill mapping">
  <div className="section-heading"><div><h2>Review how your skills match</h2><p>Mappings count only after you confirm the current capability meaning.</p></div></div>
  {availability?.available===false&&<p className="inline-note">Reviewed QA requirements are not active yet. Your saved skills remain available; this review will appear when approved content is activated.</p>}
  {availability?.available&&<p className="small muted">Requirement version {availability.version} · reviewed {availability.reviewedOn}. This review records your experience, not proficiency.</p>}
  {busy&&!preview&&<p role="status">Loading skill review…</p>}
  {preview&&<><p className="small muted">Select only meanings that accurately describe your saved skills. Leave uncertain suggestions unconfirmed. This temporary review expires after 15 minutes.</p>
   {preview.entries.map(entry=><div className="mapping-entry" role="group" aria-label={`Review mapping for ${entry.label}`} key={entry.skillKey}>
    <strong>{entry.label}</strong><span className="small muted">Saved as {entry.source==='cv'?'CV-confirmed':'self-reported'}.</span>
    {!entry.candidates.length?<p className="small muted">No reviewed mapping proposed. This skill stays in your inventory.</p>:<>
     <label htmlFor={`review-${entry.skillKey}`}>Reviewed capability</label>
     <select id={`review-${entry.skillKey}`} value={choices[entry.skillKey]??entry.candidates.find(candidate=>!candidate.requiresConfirmation)?.capabilityId??''} onChange={event=>setChoices(previous=>({...previous,[entry.skillKey]:event.target.value}))} disabled={busy}>
      <option value="">{entry.candidates.some(candidate=>!candidate.requiresConfirmation)?'Keep existing mapping without changes':'Leave for review'}</option>{entry.candidates.map(candidate=><option key={candidate.capabilityId} value={candidate.capabilityId}>{candidate.label}{candidate.requiresConfirmation?' · confirm':' · already confirmed'}</option>)}
     </select>
     {choices[entry.skillKey]&&<p className="mapping-meaning">{entry.candidates.find(candidate=>candidate.capabilityId===choices[entry.skillKey])?.meaning}</p>}
     {entry.candidates.some(candidate=>!candidate.requiresConfirmation)&&<p className="small muted">A mapping for the current meaning is already confirmed.</p>}
    </>}
   </div>)}
   <div className="form-footer"><button className="button secondary" type="button" disabled={busy} onClick={()=>setRefresh(value=>value+1)}>Refresh review</button><button className="button primary" type="button" disabled={busy||!Object.values(choices).some(Boolean)} onClick={()=>void save()}>Confirm selected mappings</button></div>
  </>}
  {!preview&&!busy&&<button className="button secondary" type="button" onClick={()=>{setMessage(null);setRefresh(value=>value+1)}}>Refresh review</button>}
  {message&&<p role={message.error?'alert':'status'}>{message.text}</p>}
 </section>;
}
