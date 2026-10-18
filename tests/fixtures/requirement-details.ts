// Synthetic contract data only; never import into application content.
export function syntheticPlanningDetails(id:string,prerequisites:string[]=[]){
 return {scope:{includes:[`Synthetic included scope for ${id}`],excludes:['Production proficiency claims'],startingKnowledge:['Synthetic fixture starting knowledge'],prerequisiteRationale:prerequisites.map(capabilityId=>({capabilityId,reason:`Synthetic prerequisite for ${id}`}))},
  effort:{readingMinutes:20,setupMinutes:10,practiceMinutes:60,reviewMinutes:20,troubleshootingMinutes:10,troubleshootingLimit:'Synthetic bounded allowance; no mastery claim.',sharedSetup:{id:'synthetic-fixture-setup',activity:'Prepare the local synthetic fixture.'}}};
}
