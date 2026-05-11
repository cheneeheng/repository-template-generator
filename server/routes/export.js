import { Router } from 'express';
import { z } from 'zod';
import * as zipper from '../services/zipper.js';
import * as github from '../services/github.js';
import * as gitlab from '../services/gitlab.js';

const router = Router();

const fileEntrySchema = z.object({ path: z.string(), content: z.string() });

const zipSchema = z.object({
  fileTree: z.array(fileEntrySchema).min(1).max(100),
  projectName: z.string().min(1).max(64).optional()
    .transform((v) => v ? v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project' : undefined),
});

router.post('/zip', async (req, res, next) => {
  try {
    const { fileTree, projectName } = zipSchema.parse(req.body);
    const filename = `${projectName ?? 'project'}.zip`;
    const buffer = await zipper.createZip(fileTree);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

const repoSchema = z.object({
  fileTree: z.array(fileEntrySchema),
  provider: z.enum(['github', 'gitlab']),
  token: z.string(),
  owner: z.string(),
  repoName: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
});

router.post('/repo', async (req, res, next) => {
  try {
    const payload = repoSchema.parse(req.body);
    const { provider, ...rest } = payload;

    const { repoUrl } =
      provider === 'github'
        ? await github.createRepo(rest)
        : await gitlab.createRepo(rest);

    res.json({ repoUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
