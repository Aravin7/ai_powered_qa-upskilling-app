'use client';
import { useState } from 'react';
import { capabilityLibrary, interestLabels, type PathwayPreferences } from '@/lib/pathways';
import type { AppState } from '@/lib/types';
import { ResourcePreviews } from './resource-previews';

export function PathwayExplorer({state,mode,pending,onRequest}:{
 state:AppState;mode:'live'|'demo';pending:boolean;
 onRequest:(path:string,method:string,body:unknown)=>Promise<AppState|undefined>;
}){
 const saved=state.pathwayExploration;
 const [interests,setInterests]=useState<PathwayPreferences['interests']>(saved?.preferences.interests??[]);
 const [preferredWork,setPreferredWork]=useState<PathwayPreferences['preferredWork']>(saved?.preferences.preferredWork??'exploration');
 const [codingPreference,setCodingPreference]=useState<PathwayPreferences['codingPreference']>(saved?.preferences.codingPreference??'open');
 const [showAll,setShowAll]=useState(false);
 const preferences={interests:[...interests].sort(),preferredWork,codingPreference};
 const dirty=!saved||JSON.stringify(saved.preferences)!==JSON.stringify(preferences);
 const stale=!!saved&&(saved.inputRevision!==state.profile.planningRevision||saved.libraryVersion!==capabilityLibrary.version);
 const selected=saved?.suggestions.find(s=>s.id===saved.selectedSuggestionId);
 if(mode==='demo')return <section className="card"><h2>Explore QA directions</h2><p>Saved pathway exploration is available in the signed-in local mock workspace. This browser-only demo retains its original sample pathway.</p></section>;
 return <>
  <section className="card profile-form pathway-preferences"><h2>What would you like to explore?</h2><p>Choose interests, rather than a fixed career destination. Suggestions combine relevant QA capabilities and do not assess proficiency or job suitability.</p>
   <fieldset disabled={pending}><legend>QA learning interests</legend>{Object.entries(interestLabels).map(([id,label])=><label className="check-label" key={id}><input type="checkbox" checked={interests.includes(id as PathwayPreferences['interests'][number])} onChange={event=>setInterests(event.target.checked?[...interests,id as PathwayPreferences['interests'][number]]:interests.filter(item=>item!==id))}/>{label}</label>)}</fieldset>
   <label htmlFor="pathway-work">Preferred work</label><select id="pathway-work" disabled={pending} value={preferredWork} onChange={event=>setPreferredWork(event.target.value as PathwayPreferences['preferredWork'])}><option value="exploration">Exploratory testing</option><option value="automation">Building test automation</option><option value="analysis">Analysis and evaluation</option><option value="delivery">Delivery and CI/CD</option></select>
   <label htmlFor="pathway-coding">Coding preference</label><select id="pathway-coding" disabled={pending} value={codingPreference} onChange={event=>setCodingPreference(event.target.value as PathwayPreferences['codingPreference'])}><option value="open">Open to coding</option><option value="some">Some coding</option><option value="low-code">Prefer less coding</option></select>
   <p>{state.profile.hoursPerWeek} saved learning hours per week. Change availability in My profile. Saving changed preferences clears previous suggestions and your reviewed or provisional selection; existing plans and progress are preserved.</p>
   <button className="button secondary" disabled={pending||!interests.length} onClick={()=>void onRequest('pathways/preferences','PUT',{preferences,expectedPlanningRevision:state.profile.planningRevision})}>Save exploration preferences</button>
   {dirty&&<p className="small muted">Save preferences before generating suggestions.</p>}
  </section>
  <section className="card"><h2>Suggested directions</h2><p>Local mock suggestions · synthetic capability data · not live AI advice. New combinations remain provisional until their requirements are reviewed. Unmatched skills remain in your inventory but are not silently mapped.</p>
   {state.processing?.mode!=='mock'&&<p className="inline-note">Live pathway suggestions are disabled pending reviewed capability data and an updated processing notice. Existing CV and sample-roadmap features remain available.</p>}
   {!state.consents.roadmap_generation&&<p className="inline-note">Enable current learning-roadmap consent in Privacy &amp; settings before requesting suggestions.</p>}
   {stale&&<p role="status">Saved inputs changed. Clear any provisional selection, then request fresh suggestions.</p>}
   {selected&&<div className="inline-note"><strong>Direction of interest: {selected.title}</strong><p>Saved as provisional. This is not an authoritative target: gap comparison and new plan generation are blocked until reviewed requirements are available. Your existing plan and progress remain available.</p><button className="button secondary" disabled={pending} onClick={()=>void onRequest('pathways/select','PUT',{suggestionId:null,expectedPlanningRevision:state.profile.planningRevision})}>Clear provisional direction</button></div>}
   <button className="button primary" disabled={pending||dirty||!saved||!!selected||!!state.reviewedDirection||state.processing?.mode!=='mock'||!state.consents.roadmap_generation||!state.profile.confirmed||!state.profile.inventoryConfirmed} onClick={()=>void onRequest('pathways/suggest','POST',{operationKey:crypto.randomUUID(),expectedPlanningRevision:state.profile.planningRevision})}>{pending?'Processing…':'Suggest mock QA directions'}</button>
   {(showAll?saved?.suggestions:saved?.suggestions.slice(0,3))?.map(suggestion=><article className="card" key={suggestion.id}><span className="pill">PROVISIONAL</span><h3>{suggestion.title}</h3><p>{suggestion.why}</p><h4>Confirmed transferable self-report</h4><p>{suggestion.transferableSkillIds.map(id=>state.skills.find(skill=>skill.canonicalSkillId===id)?.label??id).join(', ')||'No mapped transferable evidence is established.'}</p><h4>Topics to explore, pending requirements review</h4><ul>{suggestion.capabilityIds.map(id=><li key={id}>{capabilityLibrary.capabilities.find(capability=>capability.id===id)?.label??id}</li>)}</ul><h4>Practical work to consider</h4><p>{suggestion.practicalWork}</p><p className="small muted">{suggestion.uncertainty}</p><p className="small muted">Source: {capabilityLibrary.provenance} Version: {suggestion.libraryVersion}.</p><button className="button secondary" disabled={pending||stale||dirty||!!selected} onClick={()=>void onRequest('pathways/select','PUT',{suggestionId:suggestion.id,expectedPlanningRevision:state.profile.planningRevision})}>Save direction of interest: {suggestion.title}</button></article>)}
   {!showAll&&(saved?.suggestions.length??0)>3&&<button className="text-button" onClick={()=>setShowAll(true)}>Explore more suggestions</button>}
  </section>
  {selected&&<ResourcePreviews state={state} direction={selected} pending={pending} stale={stale||dirty} onRequest={onRequest}/>}
 </>;
}
