import { describe, it, expect } from 'vitest';
import { validateManifest } from './templateValidator.js';

const valid = {
  id: 'react-express-postgres',
  label: 'React + Express + PostgreSQL',
  description: 'A fullstack starter.',
  tags: ['react', 'express'],
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    expect(validateManifest(valid)).toEqual({ valid: true });
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    const result = validateManifest(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.startsWith('id:'))).toBe(true);
  });

  it('rejects id with uppercase', () => {
    const result = validateManifest({ ...valid, id: 'React-Express' });
    expect(result.valid).toBe(false);
  });

  it('rejects id longer than 64 chars', () => {
    const result = validateManifest({ ...valid, id: 'a'.repeat(65) });
    expect(result.valid).toBe(false);
  });

  it('rejects empty tags array', () => {
    const result = validateManifest({ ...valid, tags: [] });
    expect(result.valid).toBe(false);
  });

  it('rejects more than 10 tags', () => {
    const result = validateManifest({ ...valid, tags: Array(11).fill('tag') });
    expect(result.valid).toBe(false);
  });

  it('rejects a tag longer than 32 chars', () => {
    const result = validateManifest({ ...valid, tags: ['a'.repeat(33)] });
    expect(result.valid).toBe(false);
  });

  it('rejects description longer than 500 chars', () => {
    const result = validateManifest({ ...valid, description: 'x'.repeat(501) });
    expect(result.valid).toBe(false);
  });

  it('rejects label longer than 100 chars', () => {
    const result = validateManifest({ ...valid, label: 'x'.repeat(101) });
    expect(result.valid).toBe(false);
  });

  it('returns all failing field paths in errors array', () => {
    const result = validateManifest({ id: '', label: '', description: '', tags: [] });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
