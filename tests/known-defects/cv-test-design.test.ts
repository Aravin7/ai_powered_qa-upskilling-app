import { expect, it } from 'vitest';
import { minimizeText } from '../../src/lib/ai-output';

it('CV-10b / R04 / T04: removing a learner name does not erase an unrelated API skill acronym', () => {
  const text = minimizeText('I performed API testing on a synthetic local service.', ['Synthetic API Learner', 'Synthetic', 'API', 'Learner']);
  expect(text).toContain('API testing');
});
