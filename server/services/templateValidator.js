import { z } from 'zod';

const templateManifestSchema = z.object({
  id: z.string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'id must be lowercase alphanumeric with hyphens only'),
  label: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(32)).min(1).max(10),
});

export function validateManifest(raw, sourcePath) {
  const result = templateManifestSchema.safeParse(raw);
  if (result.success) return { valid: true };
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
  return { valid: false, errors };
}
