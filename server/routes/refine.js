import { Router } from 'express';
import { z } from 'zod';
import * as llm from '../services/llm.js';
import { truncateHistory } from '../services/historyTruncator.js';
import { refineLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const fileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const refineSchema = z.object({
  fileTree:    z.array(fileSchema).min(1).max(100),
  history:     z.array(historyMessageSchema).max(20),
  instruction: z.string().min(1).max(1000),
});

router.post('/', refineLimiter, async (req, res) => {
  if (!llm.LLM_ENABLED) {
    return res.status(503).json({
      error: 'llm_unavailable',
      message: 'Refinement requires an Anthropic API key. The server is running in bypass mode.',
    });
  }

  const { fileTree, history, instruction } = refineSchema.parse(req.body);
  const safeHistory = truncateHistory(history);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const updatedTree = await llm.refineStreaming(fileTree, safeHistory, instruction, res);
    res.write('data: ' + JSON.stringify({ type: 'done', fileTree: updatedTree }) + '\n\n');
  } catch (err) {
    const isContextOverflow = err.status === 400 && err.message?.includes('prompt is too long');
    const message = isContextOverflow ? 'context_overflow' : (err.message ?? 'Refinement failed');
    res.write('data: ' + JSON.stringify({ type: 'error', message }) + '\n\n');
  }
  res.end();
});

export default router;
