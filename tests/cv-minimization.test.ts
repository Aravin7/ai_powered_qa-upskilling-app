import { expect, it } from 'vitest';
import { minimizeText } from '../src/lib/ai-output';

it('CV-10b / R04 / T04: removing a learner name does not erase an unrelated API skill acronym', () => {
  const text = minimizeText('I performed API testing on a synthetic local service.', ['Synthetic API Learner', 'Synthetic', 'API', 'Learner']);
  expect(text).toContain('API testing');
});

it('CV-10c / R04 / T04: full identity and separate name tokens are removed without matching inside words', () => {
  const text = minimizeText('Synthetic API Learner performed API testing.\nsynthetic performed testing.\nI used syntheticity tooling.', ['Synthetic API Learner', 'Synthetic', 'API', 'Learner']);
  expect(text).toContain('[removed] performed API testing');
  expect(text).toContain('[removed] performed testing');
  expect(text).not.toMatch(/synthetic performed|learner/i);
  expect(text).toContain('syntheticity tooling');
});
