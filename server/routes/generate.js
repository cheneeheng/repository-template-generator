import { Router } from 'express';
import { z } from 'zod';
import * as assembler from '../services/assembler.js';
import * as llm from '../services/llm.js';
import { generateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const generateSchema = z.object({
  templateId: z.string().min(1),
  projectName: z.string().min(1).max(64)
    .transform((v) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'),
  description: z.string().max(500).optional().default(''),
});

router.post('/', generateLimiter, async (req, res) => {
  const { templateId, projectName, description } = generateSchema.parse(req.body);
  const baseFiles = await assembler.load(templateId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const fileTree = await llm.customiseStreaming(baseFiles, projectName, description, res);
    res.write('data: ' + JSON.stringify({ type: 'done', fileTree }) + '\n\n');
  } catch (err) {
    const message = err.status === 401
      ? 'Invalid or missing API key'
      : (err.message ?? 'LLM error');
    res.write('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n');
  }
  res.end();
});

export default router;
