import { describe, expect, it } from 'vitest';
import { requirementDraft } from '../src/lib/requirement-draft';
import {
  capabilityMeaningIdentity,
  directionWorkload,
  publicationReadyLibrary,
  requirementContentDigest,
  validateRequirementLibrary,
  type RequirementLibrary,
} from '../src/lib/requirements';
import { syntheticPlanningDetails } from './fixtures/requirement-details';

const now = new Date('2026-10-23T12:00:00Z');

function fixture(): RequirementLibrary {
  const node = (id: string, prerequisites: string[]) => ({
    id,
    label: id,
    meaningVersion: 'synthetic-content-v1',
    meaning: `Synthetic ${id}`,
    level: 'foundation' as const,
    aliases: [],
    priority: 'important' as const,
    prerequisites,
    sourceIds: ['fixture'],
    minutes: 120,
    activity: 'Synthetic activity',
    outcome: 'Synthetic outcome',
    ...syntheticPlanningDetails(id, prerequisites),
  });

  const library: RequirementLibrary = {
    version: 'synthetic-content-v1',
    audience: 'experienced-qa',
    createdOn: '2026-10-18',
    sources: [
      {
        id: 'fixture',
        title: 'Synthetic source',
        url: 'https://example.org/fixture',
        checkedOn: '2026-10-18',
      },
    ],
    capabilities: [
      node('design', []),
      node('automation', ['design']),
      node('ci', ['automation']),
      node('observability', []),
    ],
    directionRules: [
      {
        id: 'delivery',
        label: 'Synthetic delivery',
        requirements: [
          { capabilityId: 'ci', priority: 'critical' },
          { capabilityId: 'observability', priority: 'nice' },
        ],
      },
    ],
    review: null,
  };

  library.review = {
    reviewer: 'Synthetic fixture only',
    reviewedOn: '2026-10-18',
    contentDigest: requirementContentDigest(library, now),
  };

  return library;
}

const selected = {
  directionId: 'delivery',
  deferredCapabilityIds: ['observability'],
};

describe('R06/R07/R12 complete scope and honest effort, synthetic only', () => {
  it('RC-01: approved v5 has complete scope, effort and reviewed direction rules', () => {
    const library = validateRequirementLibrary(requirementDraft, now);
    expect(library.version).toBe('qa-capabilities-draft-v5');
    expect(library.capabilities).toHaveLength(14);
    expect(library.directionRules).toHaveLength(5);
    expect(library.review).toMatchObject({
      reviewer: 'Tharindu Perera',
      reviewedOn: '2026-10-22',
    });
    expect(library.review!.contentDigest).toBe(
      requirementContentDigest(library, now),
    );
    expect(library.capabilities.every(node => node.scope && node.effort)).toBe(true);
    expect(library.capabilities.find(node => node.id === 'observability')!.prerequisites).toEqual(['api-testing', 'llm-evaluation']);
    expect(library.capabilities.find(node => node.id === 'llm-evaluation')!.prerequisites).toEqual(['api-testing', 'ai-basics']);
    expect(library.capabilities.find(node => node.id === 'test-design')!.meaningVersion).toBe('draft-v4');
    expect(library.capabilities.find(node => node.id === 'llm-evaluation')!.meaningVersion).toBe('draft-v4-r3');
    expect(library.capabilities.find(node => node.id === 'ai-security')!.prerequisites).toContain('llm-evaluation');
    expect(library.capabilities.find(node => node.id === 'load-testing')!.priority).toBe('nice');
    expect(library.capabilities.find(node => node.id === 'generated-test-review')).toBeDefined();
    expect(library.capabilities.find(node => node.id === 'ci')!.aliases).not.toContain('ci/cd');

    expect(publicationReadyLibrary(library, now)).toBeDefined();

    const unreviewed = structuredClone(library);
    unreviewed.review = null;
    expect(() => publicationReadyLibrary(unreviewed, now)).toThrow(/dated content review/);
  });

  it('RC-02: a reviewed digest cannot publish legacy content without complete details', () => {
    const library = fixture();
    delete library.capabilities[0].scope;
    library.review!.contentDigest = requirementContentDigest(library, now);
    expect(() => publicationReadyLibrary(library, now)).toThrow(/scope boundaries/);
  });

  it.each([
    'readingMinutes',
    'setupMinutes',
    'practiceMinutes',
    'reviewMinutes',
    'troubleshootingMinutes',
  ] as const)('RC-03: mismatched %s is rejected, never clamped', field => {
    const library = fixture();
    library.capabilities[0].effort![field]++;
    expect(() => validateRequirementLibrary(library, now)).toThrow(/components/);
  });

  it('RC-04: every prerequisite must have exactly one rationale', () => {
    const library = fixture();
    library.capabilities[1].scope!.prerequisiteRationale = [];
    expect(() => validateRequirementLibrary(library, now)).toThrow(/rationale/);
  });

  it('RC-05: shared setup ID cannot hide different work or effort', () => {
    const library = fixture();
    library.capabilities[1].effort!.sharedSetup!.activity = 'Different setup';
    expect(() => validateRequirementLibrary(library, now)).toThrow(/Shared setup/);
  });

  it('RC-06: sum includes shared setup once and retains honest topic work', () => {
    const workload = directionWorkload(fixture(), selected, [], now);
    expect(workload.topics.map(topic => topic.minutes)).toEqual([110, 110, 110]);
    expect(workload.sharedSetups).toHaveLength(1);
    expect(workload.totalMinutes).toBe(340);
    expect(directionWorkload(fixture(), selected, ['design', 'automation'], now).totalMinutes).toBe(120);
    expect(directionWorkload(fixture(), selected, ['design', 'automation', 'ci'], now)).toMatchObject({
      topics: [],
      sharedSetups: [],
      totalMinutes: 0,
    });
  });

  it('RC-07: scope changes alter meaning identity; effort changes require a new reviewed digest', () => {
    const library = fixture();
    const old = capabilityMeaningIdentity(library.capabilities[0]);
    library.capabilities[0].scope!.excludes = ['A changed boundary'];
    expect(capabilityMeaningIdentity(library.capabilities[0])).not.toBe(old);
    expect(() => publicationReadyLibrary(library, now)).toThrow(/dated content review/);

    const effort = fixture();
    effort.capabilities[0].effort!.readingMinutes += 10;
    effort.capabilities[0].minutes += 10;
    expect(() => publicationReadyLibrary(effort, now)).toThrow(/dated content review/);
  });

  it('RC-08: empty scope and troubleshooting limitation fail strict validation', () => {
    const library = fixture();
    library.capabilities[0].scope!.includes = [];
    expect(() => validateRequirementLibrary(library, now)).toThrow();

    const other = fixture();
    other.capabilities[0].effort!.troubleshootingLimit = '';
    expect(() => validateRequirementLibrary(other, now)).toThrow();
  });

  it('RC-09: nonzero setup without identity and foreign confirmed workload IDs are rejected', () => {
    const library = fixture();
    library.capabilities[0].effort!.sharedSetup = null;
    expect(() => validateRequirementLibrary(library, now)).toThrow(/setup/);
    expect(() => directionWorkload(fixture(), selected, ['foreign'], now)).toThrow(/selected requirements/);
  });
});