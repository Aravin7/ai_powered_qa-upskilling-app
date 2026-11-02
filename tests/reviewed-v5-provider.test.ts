import { describe, expect, it, vi } from 'vitest';
import { requirementDraft } from '../src/lib/requirement-draft';
import { compareDirectionRequirements } from '../src/lib/requirements';
import { reviewedPlanContext, mockReviewedPlan, validateReviewedPlan } from '../src/lib/reviewed-roadmap';
import { createGroqProvider } from '../src/lib/groq-provider';
import { GROQ_MODEL } from '../src/lib/ai-execution';

it('v5 six-hour context accepts a compact intercepted Groq schedule and reconstructs server tasks',async()=>{
 const library=requirementDraft;const now=new Date('2026-11-03T12:00:00Z');
 const selection={directionId:'ai-assisted-qa',deferredCapabilityIds:[]};
 const inventory=['test-design','automation','ci','api-testing'].map(id=>{const skill=library.capabilities.find(item=>item.id===id)!;return {canonicalSkillId:id,label:skill.label,meaningVersion:skill.meaningVersion};});
 const gaps=compareDirectionRequirements(library,selection,inventory,now).requirements.filter(item=>item.evidence==='not_established');
 const resources=gaps.map(gap=>({topicId:gap.id,documentationId:gap.sourceIds[0],supportingId:gap.sourceIds[1],additionalIds:gap.sourceIds.slice(2)}));
 const context=reviewedPlanContext({library,selection,inventory,resources,hoursPerWeek:6,now});
 expect(context.activities).toHaveLength(10);expect(context.totalMinutes).toBe(520);
 const schedule=mockReviewedPlan(context);
 const http=vi.fn(async(_url: unknown, _init?: RequestInit)=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(schedule)}}]})));
 const provider=createGroqProvider({apiKey:'synthetic-key',model:GROQ_MODEL,planningApprovalReference:'synthetic',fetchImpl:http});
 const output=await provider.respond({kind:'reviewed_roadmap',context},new AbortController().signal);
 const result=validateReviewedPlan(context,output);
 expect(result.tasks).toHaveLength(10);
 for(const [index,entry] of schedule.tasks.entries())expect(result.tasks[index]).toEqual({...context.activities.find(item=>item.id===entry.activityId)!.task,week:entry.week});
 const body=JSON.parse(String(http.mock.calls[0][1]?.body));
 expect(body.response_format.json_schema.schema.properties.tasks.items.required).toEqual(['activityId','week']);
 expect(body.response_format.json_schema.strict).toBe(true);expect(http).toHaveBeenCalledTimes(1);
});
