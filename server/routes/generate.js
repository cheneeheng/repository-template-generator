import { Router } from 'express';
import { z } from 'zod';
import * as assembler from '../services/assembler.js';
import * as llm from '../services/llm.js';

const router = Router();

const schema = z.object({
  templateId: z.string(),
  projectName: z.string(),
  description: z.string(),
});

router.post('/', async (req, res, next) => {
  try {
    const { templateId, projectName, description } = schema.parse(req.body);
    const files = await assembler.load(templateId);
    const customised = await llm.customise(files, projectName, description);
    res.json({ fileTree: customised });
  } catch (err) {
    next(err);
  }
});

export default router;
