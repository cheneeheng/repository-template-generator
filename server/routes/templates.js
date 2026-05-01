import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { TEMPLATES_DIR } from '../services/assembler.js';
import { validateManifest } from '../services/templateValidator.js';

const router = Router();

async function getFilePaths(templateDir) {
  const paths = [];

  async function walk(dir, base = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'template.json') continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), rel);
      } else {
        paths.push(rel);
      }
    }
  }

  await walk(templateDir);
  return paths.sort();
}

export async function scanTemplates() {
  let entries;
  try {
    entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries.filter(e => e.isDirectory());

  const templates = (
    await Promise.all(
      dirs.map(async dir => {
        try {
          const templateDir = path.join(TEMPLATES_DIR, dir.name);
          const manifestPath = path.join(templateDir, 'template.json');
          const raw = await fs.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(raw);

          const validation = validateManifest(manifest, manifestPath);
          if (!validation.valid) {
            console.error(
              `[templates] Skipping invalid template at ${templateDir}:\n` +
              validation.errors.map(e => `  • ${e}`).join('\n')
            );
            return null;
          }

          const files = await getFilePaths(templateDir);
          return { ...manifest, files };
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  return templates;
}

router.get('/', async (req, res, next) => {
  try {
    const templates = await scanTemplates();
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

export default router;
