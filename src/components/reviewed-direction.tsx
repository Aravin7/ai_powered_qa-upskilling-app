'use client';
import { useEffect, useState } from 'react';
import type { AppState } from '@/lib/types';
import type { reviewedDirectionOptions } from '@/lib/reviewed-direction';

type Options=Awaited<ReturnType<typeof reviewedDirectionOptions>>;
export function ReviewedDirection({state,pending,onRequest,onAccessEnded}:{state:AppState;pending:boolean;onRequest:(path:string,method:string,body:unknown)=>Promise<AppState|undefined>;onAccessEnded:()=>void}){
 const [data,setData]=useState<Options|null>(null);const [error,setError]=useState('');const [refresh,setRefresh]=useState(0);
 const [direction,setDirection]=useState(state.reviewedDirection?.directionId??'');
 const [deferred,setDeferred]=useState<string[]>(state.reviewedDirection?.deferredCapabilityIds??[]);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/pathways/reviewed',{cache:'no-store',signal:controller.signal}).then(async response=>{
   const out=await response.json();if(controller.signal.aborted)return;
   if(response.status===401||out.code==='ACCESS_ENDED'){onAccessEnded();return;}
   if(!response.ok)throw new Error(out.message||'Unable to load reviewed directions.');
   setData(out.data);setError('');
  }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Unable to load reviewed directions.');});
  return()=>controller.abort();
 },[refresh,onAccessEnded]);
 const selected=data?.available?data.options.find(item=>item.id===direction):undefined;
 const comparison=data?.available?data.comparison:null;
 return <section className="card profile-form reviewed-direction" aria-label="Reviewed direction and gaps"><h2>Reviewed direction and learning needs</h2>
  <p>Choose a direction with reviewed requirements. Your confirmed skill mappings are compared on the server; missing evidence does not mean inability.</p>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status">Loading reviewed directions…</p>}
  <button className="text-button" disabled={pending} onClick={()=>setRefresh(value=>value+1)}>Refresh reviewed directions</button>
  {data&&!data.available&&<p role="status">No reviewed directions are active yet. Your skills and existing plan remain saved.</p>}
  {data?.stale&&<p role="alert">The requirement version changed. Review the current direction and skill meanings before using a new comparison.</p>}
  {data?.available&&<>
   <p className="small muted">Requirement version: {data.version}</p>
   <label>Reviewed QA direction<select value={direction} disabled={pending} onChange={event=>{setDirection(event.target.value);setDeferred([]);}}><option value="">Choose a reviewed direction</option>{data.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
   {selected&&<><ul>{selected.requirements.map(item=><li key={item.id}>{item.label} · {item.mandatory?'required':'optional'}</li>)}</ul>
    {!!selected.optionalRoots.length&&<fieldset disabled={pending}><legend>Optional topics to defer</legend>{selected.optionalRoots.map(item=><label key={item.id} className="check-label"><input type="checkbox" checked={deferred.includes(item.id)} onChange={event=>setDeferred(event.target.checked?[...deferred,item.id]:deferred.filter(id=>id!==item.id))}/>{item.label}</label>)}<p className="small muted">Prerequisites needed by retained topics cannot be deferred.</p></fieldset>}
   </>}
   <button className="button primary" disabled={pending||!selected||!state.profile.confirmed||!state.profile.inventoryConfirmed} onClick={()=>void onRequest('pathways/reviewed','PUT',{version:data.version,directionId:direction,deferredCapabilityIds:deferred,expectedPlanningRevision:state.profile.planningRevision})}>Save reviewed direction</button>
  </>}
  {state.reviewedDirection&&<button className="button secondary" disabled={pending} onClick={()=>void onRequest('pathways/reviewed','PUT',{version:state.reviewedDirection!.snapshotVersion,directionId:null,deferredCapabilityIds:[],expectedPlanningRevision:state.profile.planningRevision})}>Clear reviewed direction</button>}
  {comparison&&<div aria-label="Saved direction comparison" role="region"><h3>Saved comparison: {comparison.directionLabel}</h3>
   <p>{comparison.outcome==='no_gaps'?'No missing listed requirements. This does not certify competence.':comparison.outcome==='review_required'?'Some skill meanings need confirmation in My skills before planning.':'Learning needs identified from the selected requirements.'}</p>
   <p>{comparison.strengthIds.length} confirmed self-reported matches · {comparison.mandatoryGapIds.length} required learning needs · {comparison.optionalGapIds.length} optional learning needs · {comparison.reconfirmationIds.length} need review</p>
   <ul>{comparison.requirements.map(item=><li key={item.id}><strong>{item.label}</strong> · {item.priority} · {item.evidence==='confirmed_self_report'?'Confirmed self-report':item.evidence==='reconfirmation_required'?'Review skill meaning':'Not established'}</li>)}</ul>
   {!!comparison.deferredCapabilityIds.length&&<p>Deferred topics: {comparison.deferredCapabilityIds.join(', ')}.</p>}
   <p>Skills outside this direction remain in your inventory. Research each retained learning topic, then generate a plan from Learning roadmap. {state.processing?.mode==='mock'?'Mock research uses synthetic placeholders.':'Live research requires approved provider-search settings; automatic checks are not professional review.'}</p>
   {comparison.outcome==='gaps'&&<div aria-label="Reviewed topic resources" role="region">{comparison.requirements.filter(item=>item.evidence==='not_established').map(item=>{
    const pair=state.reviewedDirection?.resourcePreviews.find(pair=>pair.topicId===item.id&&pair.inputRevision===state.profile.planningRevision&&pair.requirementSetId===comparison.requirementSetId);
    return <article key={item.id}><h4>{item.label}</h4>{pair?<><p>{pair.mode==='mock'?'Synthetic documentation and supporting resource saved. No live page check.':'Documentation and supporting material saved with native sources and automatic topic/page checks. Not professionally reviewed.'}</p>{pair.resources.map(resource=><p key={resource.id}>{pair.mode==='groq'&&resource.reviewStatus==='automatically_checked'?<a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}</a>:<span>{resource.title} · synthetic placeholder</span>}<small> {resource.accessNote}</small></p>)}</>:<p>Resources have not been researched for the current saved inputs.</p>}
     <button className="button secondary" disabled={pending||!state.consents.roadmap_generation||!state.processing?.connectedWorkflow} onClick={()=>void onRequest('pathways/reviewed/resources','POST',{operationKey:crypto.randomUUID(),expectedPlanningRevision:state.profile.planningRevision,topicId:item.id})}>{pair?'Refresh':'Research'} {state.processing?.mode==='mock'?'mock ':''}resources for {item.label}</button>
    </article>;
   })}</div>}
  </div>}
 </section>;
}
