import { describe, expect, it } from 'vitest';
import { requirementDraft } from '../src/lib/requirement-draft';
import {
  compileDirectionRequirements,
  compareDirectionRequirements,
  compileSelectedRequirements,
  compareSelectedRequirements,
  requirementContentDigest,
  validateRequirementLibrary,
  type RequirementLibrary,
} from '../src/lib/requirements';

// Fixed test date: after the v5 draft's source-check dates.
const now = new Date('2026-10-23T12:00:00.000Z');

function fixture(): RequirementLibrary {
  const capability = (
    id: string,
    priority: 'important' | 'nice',
    prerequisites: string[],
  ) => ({
    id,
    label: id,
    meaningVersion: 'v1',
    meaning: `Synthetic meaning of ${id}`,
    aliases: [],
    level: 'foundation' as const,
    priority,
    prerequisites,
    sourceIds: ['fixture-source'],
    minutes: 120,
    activity: `Synthetic activity: ${id}`,
    outcome: `Synthetic outcome: ${id}`,
  });

  const library: RequirementLibrary = {
    version: 'synthetic-review-test-v1',
    audience: 'experienced-qa',
    createdOn: '2026-10-17',
    sources: [
      {
        id: 'fixture-source',
        title: 'Synthetic source',
        url: 'https://docs.example.org/testing',
        checkedOn: '2026-10-17',
      },
    ],
    capabilities: [
      capability('design', 'nice', []),
      capability('automation', 'important', ['design']),
      capability('ci', 'important', ['automation']),
      capability('observability', 'nice', []),
    ],
    directionRules: [],
    review: null,
  };

  // Synthetic review metadata is for testing only.
  // It is NOT a real professional content approval.
  library.review = {
    reviewer: 'Synthetic test reviewer only',
    reviewedOn: '2026-10-17',
    contentDigest: requirementContentDigest(library, now),
  };

  return library;
}

const known = (
  canonicalSkillId: string,
  meaningVersion = 'v1',
) => ({
  canonicalSkillId,
  label: canonicalSkillId,
  meaningVersion,
});

describe(
  'R06/T06/T12/T15 reviewed requirement compilation - approved v5 and synthetic cases, no provider/DB',
  () => {
    it('RQ-01: approved v5 directions compile; unreviewed or changed content stays blocked', () => {
      const draft = validateRequirementLibrary(requirementDraft, now);

      expect(draft.version).toBe('qa-capabilities-draft-v5');
      expect(draft.capabilities).toHaveLength(14);
      expect(draft.directionRules).toHaveLength(5);
      expect(draft.review).toMatchObject({
        reviewer: 'Tharindu Perera',
        reviewedOn: '2026-10-22',
      });
      expect(draft.review!.contentDigest).toBe(
        requirementContentDigest(draft, now),
      );

      // A missing review must still prevent use of an otherwise valid library.
      const unreviewed = structuredClone(draft);
      unreviewed.review = null;
      expect(() =>
        compileDirectionRequirements(unreviewed, selection(), now),
      ).toThrow(/dated content review/);

      // Valid schema changes after approval must also invalidate the review.
      const changed = structuredClone(draft);
      changed.capabilities[0].label += ' changed';
      expect(() =>
        compileDirectionRequirements(changed, selection(), now),
      ).toThrow(/dated content review/);

      // Use the actual recorded approval for the positive direction checks.
      const genai = compileDirectionRequirements(
        draft,
        {
          directionId: 'genai-application-testing',
          deferredCapabilityIds: [],
        },
        now,
      );

      const delivery = compileDirectionRequirements(
        draft,
        {
          directionId: 'ai-automation-delivery-gates',
          deferredCapabilityIds: [],
        },
        now,
      );

      expect(
        genai.capabilities.find(
          item => item.id === 'llm-evaluation',
        )?.priority,
      ).toBe('critical');

      expect(
        delivery.capabilities.find(
          item => item.id === 'llm-evaluation',
        )?.priority,
      ).toBe('critical');

      expect(
        delivery.capabilities.find(
          item => item.id === 'load-testing',
        )?.priority,
      ).toBe('nice');

      const performance = compileDirectionRequirements(
        draft,
        {
          directionId: 'ai-application-reliability',
          deferredCapabilityIds: [],
        },
        now,
      );

      expect(
        performance.capabilities.find(
          item => item.id === 'load-testing',
        ),
      ).toMatchObject({
        priority: 'important',
        mandatory: true,
      });

      expect(
        performance.capabilities.some(
          item => item.id === 'automation',
        ),
      ).toBe(false);
    });

    it.each([
      (library: RequirementLibrary) => {
        library.capabilities[0].prerequisites = ['ci'];
      },
      (library: RequirementLibrary) => {
        library.capabilities[0].prerequisites = ['missing'];
      },
      (library: RequirementLibrary) => {
        library.capabilities[0].sourceIds = ['missing'];
      },
      (library: RequirementLibrary) => {
        library.capabilities.push({ ...library.capabilities[0] });
      },
      (library: RequirementLibrary) => {
        library.sources.push({ ...library.sources[0] });
      },
    ])(
      'RQ-02: rejects cycles, missing references and duplicate identifiers, variation %#',
      change => {
        const library = fixture();
        change(library);

        expect(() =>
          validateRequirementLibrary(library, now),
        ).toThrow();
      },
    );

    it('RQ-03: equivalent ordering preserves digest; edited content invalidates exact-version review', () => {
      const library = fixture();
      const reordered = structuredClone(library);

      reordered.capabilities.reverse();

      expect(requirementContentDigest(reordered, now)).toBe(
        requirementContentDigest(library, now),
      );

      reordered.capabilities[0].minutes = 121;

      expect(() =>
        compileSelectedRequirements(reordered, ['ci'], now),
      ).toThrow(/dated content review/);
    });

    it('RQ-04: compiles arbitrary capability combinations with prerequisite closure and honest mandatory dependencies', () => {
      const compiled = compileSelectedRequirements(
        fixture(),
        ['ci', 'observability'],
        now,
      );

      expect(compiled.capabilities.map(item => item.id)).toEqual([
        'design',
        'automation',
        'ci',
        'observability',
      ]);

      expect(
        compiled.capabilities.find(item => item.id === 'design'),
      ).toMatchObject({
        priority: 'nice',
        mandatory: true,
      });

      expect(
        compiled.capabilities.find(
          item => item.id === 'observability',
        )!.mandatory,
      ).toBe(false);

      expect(
        compileSelectedRequirements(
          fixture(),
          ['observability', 'ci'],
          now,
        ).requirementSetId,
      ).toBe(compiled.requirementSetId);
    });

    it('RQ-05: comparison is deterministic and confirmed prerequisites count only as self-report', () => {
      const library = fixture();
      const inventory = [
        known('design'),
        known('automation'),
      ];

      const first = compareSelectedRequirements(
        library,
        ['ci'],
        inventory,
        now,
      );

      expect(
        compareSelectedRequirements(
          library,
          ['ci'],
          [...inventory].reverse(),
          now,
        ),
      ).toEqual(first);

      expect(first.strengthIds).toEqual([
        'design',
        'automation',
      ]);

      expect(first.mandatoryGapIds).toEqual(['ci']);
      expect(first.requirements[0].evidence).toBe(
        'confirmed_self_report',
      );
    });

    it('RQ-06: changed skill meaning requires reconfirmation despite the same stable ID', () => {
      const library = fixture();

      library.capabilities.find(
        item => item.id === 'automation',
      )!.meaningVersion = 'v2';

      library.review!.contentDigest = requirementContentDigest(
        library,
        now,
      );

      const result = compareSelectedRequirements(
        library,
        ['ci'],
        [
          known('design'),
          known('automation'),
        ],
        now,
      );

      expect(result.reconfirmationIds).toEqual(['automation']);
      expect(result.mandatoryGapIds).toEqual([
        'automation',
        'ci',
      ]);
    });

    it('RQ-07: no-gap result preserves unrelated inventory and does not mutate inputs or call AI', () => {
      const inventory = [
        known('design'),
        known('automation'),
        known('ci'),
        {
          canonicalSkillId: null,
          label: 'SQL',
          meaningVersion: null,
        },
      ];

      const before = structuredClone(inventory);

      const result = compareSelectedRequirements(
        fixture(),
        ['ci'],
        inventory,
        now,
      );

      expect(result.outcome).toBe('no_gaps');
      expect(result.outsideInventory).toEqual([inventory[3]]);
      expect(inventory).toEqual(before);
    });

    it('RQ-08: empty inventory is not established; optional gaps stay separate', () => {
      const result = compareSelectedRequirements(
        fixture(),
        ['ci', 'observability'],
        [],
        now,
      );

      expect(result.evidenceStatus).toBe('none');
      expect(result.strengthIds).toEqual([]);

      expect(result.mandatoryGapIds).toEqual([
        'design',
        'automation',
        'ci',
      ]);

      expect(result.optionalGapIds).toEqual(['observability']);

      expect(
        result.requirements.every(
          item => item.evidence === 'not_established',
        ),
      ).toBe(true);
    });

    it('RQ-09: label/alias mentions do not silently match; C/C++/C# remain distinct self-report', () => {
      const library = fixture();

      library.capabilities[1].aliases = ['Playwright'];

      library.review!.contentDigest = requirementContentDigest(
        library,
        now,
      );

      const inventory = [
        'Playwright',
        'C',
        'C++',
        'C#',
      ].map(label => ({
        canonicalSkillId: null,
        label,
        meaningVersion: null,
      }));

      const result = compareSelectedRequirements(
        library,
        ['automation'],
        inventory,
        now,
      );

      expect(result.strengthIds).toEqual([]);

      expect(
        result.outsideInventory.map(item => item.label),
      ).toEqual([
        'Playwright',
        'C',
        'C++',
        'C#',
      ]);
    });

    it('RQ-10: future review and missing legacy meaning versions cannot establish current evidence', () => {
      const library = fixture();

      // Later than the fixed test clock.
      library.review!.reviewedOn = '2026-10-24';

      expect(() =>
        compileSelectedRequirements(library, ['ci'], now),
      ).toThrow();

      const result = compareSelectedRequirements(
        fixture(),
        ['ci'],
        [
          {
            ...known('design'),
            meaningVersion: null,
          },
        ],
        now,
      );

      expect(result.reconfirmationIds).toEqual(['design']);
    });

    it('RQ-11: duplicate confirmed IDs, caller priorities and unknown selected capabilities are rejected', () => {
      expect(() =>
        compareSelectedRequirements(
          fixture(),
          ['ci'],
          [known('ci'), known('ci')],
          now,
        ),
      ).toThrow();

      expect(() =>
        compareSelectedRequirements(
          fixture(),
          ['ci'],
          [
            {
              ...known('ci'),
              priority: 'nice',
            },
          ],
          now,
        ),
      ).toThrow();

      expect(() =>
        compileSelectedRequirements(
          fixture(),
          ['unknown'],
          now,
        ),
      ).toThrow(/unsupported capability/);

      expect(() =>
        compileSelectedRequirements(
          fixture(),
          ['ci', 'ci'],
          now,
        ),
      ).toThrow();
    });

    it.each([0, 1.5, '120'])(
      'RQ-12: invalid effort %s is rejected rather than clamped/coerced',
      minutes => {
        const library = fixture();

        const changed = {
          ...library,
          capabilities: [
            {
              ...library.capabilities[0],
              minutes,
            },
            ...library.capabilities.slice(1),
          ],
        };

        expect(() =>
          validateRequirementLibrary(changed, now),
        ).toThrow();
      },
    );
  },
);

function directionFixture(): RequirementLibrary {
  const library = fixture();

  library.capabilities.push({
    ...library.capabilities[1],
    id: 'load',
    label: 'load',
    prerequisites: ['design'],
  });

  library.capabilities.find(
    item => item.id === 'observability',
  )!.prerequisites = ['load'];

  library.directionRules = [
    {
      id: 'delivery',
      label: 'Synthetic delivery',
      requirements: [
        {
          capabilityId: 'ci',
          priority: 'important',
        },
        {
          capabilityId: 'observability',
          priority: 'nice',
        },
      ],
    },
    {
      id: 'exploration',
      label: 'Synthetic exploration',
      requirements: [
        {
          capabilityId: 'ci',
          priority: 'nice',
        },
      ],
    },
  ];

  library.review!.contentDigest = requirementContentDigest(
    library,
    now,
  );

  return library;
}

const selection = (
  directionId = 'delivery',
  deferredCapabilityIds: string[] = [],
) => ({
  directionId,
  deferredCapabilityIds,
});

describe(
  'R06 amended direction contracts: synthetic review metadata only',
  () => {
    it('DR-10: prerequisites inherit the highest dependent priority transitively, independent of root order', () => {
      const library = directionFixture();

      library.directionRules[0].requirements.push({
        capabilityId: 'ci',
        priority: 'critical',
      });

      library.directionRules[0].requirements =
        library.directionRules[0].requirements.filter(
          (item, index) => index !== 0,
        );

      library.directionRules[0].requirements.push({
        capabilityId: 'automation',
        priority: 'nice',
      });

      library.review!.contentDigest = requirementContentDigest(
        library,
        now,
      );

      const first = compileDirectionRequirements(
        library,
        selection(),
        now,
      );

      for (const id of ['design', 'automation', 'ci']) {
        expect(
          first.capabilities.find(item => item.id === id),
        ).toMatchObject({
          priority: 'critical',
          mandatory: true,
        });
      }

      expect(
        first.capabilities.find(item => item.id === 'load'),
      ).toMatchObject({
        priority: 'nice',
        mandatory: false,
      });

      library.directionRules[0].requirements.reverse();

      expect(
        compileDirectionRequirements(
          library,
          selection(),
          now,
        ),
      ).toEqual(first);
    });

    it('DR-01: the same capability has different priority and mandatory status by direction', () => {
      const library = directionFixture();

      expect(
        compileDirectionRequirements(
          library,
          selection(),
          now,
        ).capabilities.find(item => item.id === 'ci'),
      ).toMatchObject({
        priority: 'important',
        mandatory: true,
      });

      const optional = compileDirectionRequirements(
        library,
        selection('exploration'),
        now,
      );

      expect(
        optional.capabilities.every(
          item => item.priority === 'nice' && !item.mandatory,
        ),
      ).toBe(true);
    });

    it('DR-02: deferral removes exclusive load prerequisites but preserves shared design and mandatory CI work', () => {
      const compiled = compileDirectionRequirements(
        directionFixture(),
        selection('delivery', ['observability']),
        now,
      );

      expect(
        compiled.capabilities.map(item => item.id),
      ).toEqual([
        'design',
        'automation',
        'ci',
      ]);

      expect(compiled.deferredCapabilityIds).toEqual([
        'load',
        'observability',
      ]);

      expect(
        compiled.capabilities.filter(
          item => item.id === 'design',
        ),
      ).toHaveLength(1);
    });

    it('DR-03: retained optional work keeps prerequisites optional despite legacy important labels', () => {
      const compiled = compileDirectionRequirements(
        directionFixture(),
        selection(),
        now,
      );

      expect(
        compiled.capabilities.find(item => item.id === 'load'),
      ).toMatchObject({
        priority: 'nice',
        mandatory: false,
      });

      expect(
        compiled.capabilities.find(item => item.id === 'design'),
      ).toMatchObject({
        mandatory: true,
      });

      expect(
        compiled.capabilities.findIndex(
          item => item.id === 'load',
        ),
      ).toBeLessThan(
        compiled.capabilities.findIndex(
          item => item.id === 'observability',
        ),
      );
    });

    it.each(['ci', 'design', 'unknown'])(
      'DR-04: rejects mandatory, implicit or unknown deferral %s',
      nodeId => {
        expect(() =>
          compileDirectionRequirements(
            directionFixture(),
            selection('delivery', [nodeId]),
            now,
          ),
        ).toThrow(/Only optional/);
      },
    );

    it('DR-05: rejects optional deferral when another retained optional topic needs it', () => {
      const library = directionFixture();

      library.directionRules[0].requirements.push({
        capabilityId: 'load',
        priority: 'nice',
      });

      library.review!.contentDigest = requirementContentDigest(
        library,
        now,
      );

      expect(() =>
        compileDirectionRequirements(
          library,
          selection('delivery', ['load']),
          now,
        ),
      ).toThrow(/still required/);
    });

    it('DR-06: an explicitly optional node cannot be deferred if mandatory work needs it', () => {
      const library = directionFixture();

      library.directionRules[0].requirements.push({
        capabilityId: 'automation',
        priority: 'nice',
      });

      library.review!.contentDigest = requirementContentDigest(
        library,
        now,
      );

      expect(() =>
        compileDirectionRequirements(
          library,
          selection('delivery', ['automation']),
          now,
        ),
      ).toThrow(/Only optional/);
    });

    it('DR-07: priorities are digest-bound; equivalent rule ordering preserves set identity', () => {
      const library = directionFixture();

      const first = compileDirectionRequirements(
        library,
        selection(),
        now,
      );

      library.directionRules.reverse();

      library.directionRules.forEach(rule =>
        rule.requirements.reverse(),
      );

      expect(
        compileDirectionRequirements(
          library,
          selection(),
          now,
        ).requirementSetId,
      ).toBe(first.requirementSetId);

      library.directionRules
        .find(rule => rule.id === 'delivery')!
        .requirements.find(
          item => item.capabilityId === 'ci',
        )!.priority = 'nice';

      expect(() =>
        compileDirectionRequirements(
          library,
          selection(),
          now,
        ),
      ).toThrow(/dated content review/);
    });

    it('DR-08: unknown rules, duplicate deferrals and caller priority overrides cannot compile', () => {
      const library = directionFixture();

      expect(() =>
        compileDirectionRequirements(
          library,
          selection('unknown'),
          now,
        ),
      ).toThrow(/no reviewed/);

      expect(() =>
        compileDirectionRequirements(
          library,
          selection('delivery', [
            'observability',
            'observability',
          ]),
          now,
        ),
      ).toThrow();

      expect(() =>
        compileDirectionRequirements(
          library,
          {
            ...selection(),
            priority: 'nice',
          },
          now,
        ),
      ).toThrow();
    });

    it.each([
      'duplicate-rule',
      'duplicate-requirement',
      'unknown-node',
    ])(
      'DR-09: malformed published rule %s is rejected',
      variant => {
        const library = directionFixture();

        if (variant === 'duplicate-rule') {
          library.directionRules.push(
            library.directionRules[0],
          );
        }

        if (variant === 'duplicate-requirement') {
          library.directionRules[0].requirements.push(
            library.directionRules[0].requirements[0],
          );
        }

        if (variant === 'unknown-node') {
          library.directionRules[0].requirements[0].capabilityId =
            'unknown';
        }

        expect(() =>
          validateRequirementLibrary(library, now),
        ).toThrow(/unique/);
      },
    );

    it('DR-10: confirmed prerequisites are strengths, deferred work is absent from gaps, inputs survive', () => {
      const library = directionFixture();

      const inventory = [
        known('design'),
        known('automation'),
        {
          canonicalSkillId: null,
          label: 'SQL',
          meaningVersion: null,
        },
      ];

      const before = structuredClone({
        library,
        inventory,
      });

      const result = compareDirectionRequirements(
        library,
        selection('delivery', ['observability']),
        inventory,
        now,
      );

      expect(result.strengthIds).toEqual([
        'design',
        'automation',
      ]);

      expect(result.mandatoryGapIds).toEqual(['ci']);
      expect(result.optionalGapIds).toEqual([]);

      expect(result.deferredCapabilityIds).toEqual([
        'load',
        'observability',
      ]);

      expect(result.outsideInventory).toEqual([
        inventory[2],
      ]);

      expect({ library, inventory }).toEqual(before);
    });

    it('DR-11: all optional work can be explicitly deferred without manufacturing a plan', () => {
      const result = compareDirectionRequirements(
        directionFixture(),
        selection('exploration', ['ci']),
        [],
        now,
      );

      expect(result.capabilities).toEqual([]);
      expect(result.outcome).toBe('no_gaps');

      expect(result.deferredCapabilityIds).toEqual([
        'design',
        'automation',
        'ci',
      ]);
    });

    it('DR-12: reconfirmation and unreviewed-library gates remain intact', () => {
      const unreviewed = structuredClone(requirementDraft);
      unreviewed.review = null;

      expect(() =>
        compileDirectionRequirements(
          unreviewed,
          selection(),
          now,
        ),
      ).toThrow(/dated content review/);

      const result = compareDirectionRequirements(
        directionFixture(),
        selection(),
        [known('automation', 'old')],
        now,
      );

      expect(result.reconfirmationIds).toEqual([
        'automation',
      ]);

      expect(result.strengthIds).toEqual([]);
      expect(result.outcome).toBe('review_required');

      expect(result.mandatoryGapIds).not.toContain(
        'automation',
      );
    });
  },
);
