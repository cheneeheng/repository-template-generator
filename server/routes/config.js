import { Router } from 'express';
import { LLM_ENABLED } from '../services/llm.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ llmEnabled: LLM_ENABLED });
});

export default router;
