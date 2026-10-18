export type Profile = { currentRole: string; yearsExperience: number; hoursPerWeek: number; confirmed: boolean; inventoryConfirmed: boolean; planningRevision: number };
export type SkillEntry = { key: string; canonicalSkillId: string | null; label: string; source: 'manual' | 'cv' };
export type Purpose = 'cv_extraction' | 'roadmap_generation';
export type ConsentState = Record<Purpose, boolean>;
export type Task = { id: string; week: number; kind: 'learning' | 'practical'; title: string; activity: string; completionCriterion: string; skillIds: string[]; resourceIds: string[]; estimatedMinutes: number; completed: boolean; revision: number };
export type Roadmap = { id: string; inputRevision: number; catalogueVersion: string; createdAt: string; tasks: Task[]; deferredSkillIds: string[]; reviewed?:{mode:'mock';directionLabel:string;libraryVersion:string;requirementSetId:string;current:boolean;resources:import('./reviewed-resources').ReviewedResourcePreview[]} };
export type ProcessingDisclosure={mode:'mock'|'groq'|'disabled';policyVersion:string;provider:string;notice:string};
export type AppState = { name: string; profile: Profile; skills: SkillEntry[]; consents: ConsentState; roadmap: Roadmap | null; archivedRoadmaps: Roadmap[]; processing?:ProcessingDisclosure; pathwayExploration?:import('./pathways').PathwayExploration|null; reviewedDirection?:{snapshotVersion:string;directionId:string;label:string;deferredCapabilityIds:string[];requirementSetId:string;current:boolean;resourcePreviews:import('./reviewed-resources').ReviewedResourcePreview[]}|null };
