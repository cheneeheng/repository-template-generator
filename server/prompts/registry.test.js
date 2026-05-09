import { describe, it, expect, vi } from 'vitest';

describe('prompts/registry', () => {
  it('loads customise-v2 by default', async () => {
    vi.stubEnv('PROMPT_VERSION', '');
    vi.resetModules();
    const { CURRENT_PROMPT_VERSION } = await import('./registry.js');
    expect(CURRENT_PROMPT_VERSION.key).toBe('customise-v2');
  });

  it('loads customise-v1 when PROMPT_VERSION=customise-v1', async () => {
    vi.stubEnv('PROMPT_VERSION', 'customise-v1');
    vi.resetModules();
    const { CURRENT_PROMPT_VERSION } = await import('./registry.js');
    expect(CURRENT_PROMPT_VERSION.key).toBe('customise-v1');
  });

  it('throws on unknown PROMPT_VERSION', async () => {
    vi.stubEnv('PROMPT_VERSION', 'customise-v99');
    vi.resetModules();
    await expect(import('./registry.js')).rejects.toThrow('Unknown PROMPT_VERSION');
  });

  it('always exports refine-v1 as CURRENT_REFINE_VERSION', async () => {
    vi.stubEnv('PROMPT_VERSION', '');
    vi.resetModules();
    const { CURRENT_REFINE_VERSION } = await import('./registry.js');
    expect(CURRENT_REFINE_VERSION.key).toBe('refine-v1');
  });
});
