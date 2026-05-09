import { Router } from 'express';
import { access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanTemplates } from './templates.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.get('/', async (req, res) => {
  const checks = {};
  let healthy = true;

  const templatesDir = process.env.TEMPLATES_DIR
    ?? path.resolve(__dirname, '../../../templates');

  try {
    await access(templatesDir);
    checks.templatesDir = 'ok';
  } catch {
    checks.templatesDir = 'error: directory not accessible';
    healthy = false;
  }

  try {
    const templates = await scanTemplates();
    checks.templateCount = templates.length;
    if (templates.length === 0) {
      checks.templatesDir = 'warning: no valid templates found';
    }
  /* v8 ignore next 3 */
  } catch {
    checks.templateCount = 0;
  }

  checks.anthropicKey = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  if (!process.env.ANTHROPIC_API_KEY) healthy = false;

  res.status(healthy ? 200 : 503).json({ ok: healthy, checks });
});

export default router;
