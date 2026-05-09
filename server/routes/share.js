import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { saveShare, getShare } from '../store/shareStore.js';

const shareSchema = z.object({
  fileTree: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1).max(100),
  projectName: z.string().min(1).max(100),
  templateId: z.string().min(1),
});

const router = Router();

router.post('/', (req, res) => {
  const { fileTree, projectName, templateId } = shareSchema.parse(req.body);
  const id = randomBytes(4).toString('hex');
  saveShare(id, { fileTree, projectName, templateId });
  res.json({ id });
});

router.get('/:id', (req, res) => {
  const result = getShare(req.params.id);
  if (result.status === 'not_found') return res.status(404).json({ error: 'not_found' });
  if (result.status === 'expired') return res.status(410).json({ error: 'expired' });
  res.json(result.data);
});

export default router;
