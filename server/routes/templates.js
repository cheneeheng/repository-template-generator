import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { TEMPLATES_DIR } from '../services/assembler.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const entries = await fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory());

    const templates = (
      await Promise.all(
        dirs.map(async dir => {
          try {
            const manifestPath = path.join(TEMPLATES_DIR, dir.name, 'template.json');
            const raw = await fs.readFile(manifestPath, 'utf8');
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })
      )
    ).filter(Boolean);

    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

export default router;
