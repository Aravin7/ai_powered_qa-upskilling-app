'use client';
import { capabilityLibrary, type PathwaySuggestion } from '@/lib/pathways';
import type { AppState } from '@/lib/types';

export function ResourcePreviews({state,direction,pending,stale,onRequest}:{
 state:AppState;direction:PathwaySuggestion;pending:boolean;stale:boolean;
 onRequest:(path:string,method:string,body:unknown)=>Promise<AppState|undefined>;
}){
 return <section className="card" aria-label="Mock learning resource previews"><h2>Explore topic resources</h2>
  <p>Development preview only. No live LLM search or real page verification occurs. Each successful preview uses two shared attempts: research, then structured selection. Failures preserve saved previews and your existing plan.</p>
  <p className="inline-note">Sources below are synthetic placeholders, displayed without clickable links. They are not learning recommendations or professionally reviewed material.</p>
  {direction.capabilityIds.map(topicId=>{
   const topic=capabilityLibrary.capabilities.find(item=>item.id===topicId)!;
   const preview=state.pathwayExploration?.resourcePreviews?.find(item=>item.pathwayId===direction.id&&item.topicId===topicId&&item.inputRevision===state.profile.planningRevision&&item.libraryVersion===capabilityLibrary.version);
   return <details key={topicId}><summary>{topic.label}</summary>
    <button className="button secondary" disabled={pending||stale||state.processing?.mode!=='mock'||!state.consents.roadmap_generation} onClick={()=>void onRequest('pathways/resources','POST',{operationKey:crypto.randomUUID(),expectedPlanningRevision:state.profile.planningRevision,suggestionId:direction.id,topicId})}>Preview mock resources: {topic.label}</button>
    {preview&&<div role="region" aria-label={`Saved mock resources: ${topic.label}`}><p>Saved synthetic preview · {preview.model} · no professional review</p>{preview.resources.map((resource,index)=><article key={resource.id} className="card"><h3>{index===0?'Documentation fixture':'Supporting lesson fixture'}</h3><p>{resource.title}</p><p>{resource.publisher}</p><p className="small muted">Placeholder: {resource.url}</p><p>{resource.accessNote}</p></article>)}</div>}
   </details>;
  })}
 </section>;
}
