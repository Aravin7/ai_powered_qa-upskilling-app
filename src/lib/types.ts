export type Profile = { currentRole: string; yearsExperience: number; hoursPerWeek: number; confirmed: boolean; inventoryConfirmed: boolean; planningRevision: number };
export type SkillEntry = { key: string; canonicalSkillId: string | null; label: string; source: 'manual' | 'cv' };
export type Purpose = 'cv_extraction' | 'roadmap_generation';
export type ConsentState = Record<Purpose, boolean>;
export type Task = { id: string; week: number; kind: 'learning' | 'practical'; title: string; activity: string; completionCriterion: string; skillIds: string[]; resourceIds: string[]; estimatedMinutes: number; completed: boolean; revision: number };
export type Roadmap = { id: string; inputRevision: number; catalogueVersion: string; createdAt: string; tasks: Task[]; deferredSkillIds: string[] };
export type AppState = { name: string; profile: Profile; skills: SkillEntry[]; consents: ConsentState; roadmap: Roadmap | null; archivedRoadmaps: Roadmap[] };
