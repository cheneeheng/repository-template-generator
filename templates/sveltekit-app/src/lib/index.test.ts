import { describe, it, expect } from 'vitest';
import { projectName } from './index';

describe('lib', () => {
  it('exports project name', () => {
    expect(typeof projectName).toBe('string');
  });
});
