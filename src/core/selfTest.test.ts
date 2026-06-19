/**
 * Vitest wrapper around the in-browser self-tests, so `npm test` (when Node is
 * available) asserts the same WO acceptance criteria headlessly.
 */
import { describe, it, expect } from 'vitest';
import { runSelfTests } from './selfTest';

describe('TimeParadoxLab acceptance criteria', () => {
  const results = runSelfTests();
  for (const r of results) {
    it(r.name, () => {
      expect(r.pass, `${r.name} — ${r.detail}`).toBe(true);
    });
  }
});
