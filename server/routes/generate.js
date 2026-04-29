import { Router } from 'express';
import { z } from 'zod';
import * as assembler from '../services/assembler.js';
import * as llm from '../services/llm.js';

const router = Router();

const generateSchema = z.object({
  templateId: z.string().min(1),
  projectName: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500),
});

router.post('/', async (req, res) => {
  const { templateId, projectName, description } = generateSchema.parse(req.body);
  const baseFiles = await assembler.load(templateId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const fileTree = await llm.customiseStreaming(baseFiles, projectName, description, res);

  res.write('data: ' + JSON.stringify({ type: 'done', fileTree }) + '\n\n');
  res.end();
});

export default router;
