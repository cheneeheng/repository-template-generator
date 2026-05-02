import 'dotenv/config';
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import healthRouter from './routes/health.js';
import templatesRouter, { scanTemplates } from './routes/templates.js';
import generateRouter from './routes/generate.js';
import refineRouter from './routes/refine.js';
import exportRouter from './routes/export.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/refine', refineRouter);
app.use('/api/export', exportRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;
const TEMPLATES_DIR = process.env.TEMPLATES_DIR
  ?? path.resolve(__dirname, '../../templates');

app.listen(PORT, async () => {
  const templates = await scanTemplates();

  console.log(`
┌─────────────────────────────────────────┐
│  Fullstack Template Generator — Server  │
├─────────────────────────────────────────┤
│  Port:        ${String(PORT).padEnd(26)}│
│  Templates:   ${String(templates.length + ' loaded').padEnd(26)}│
│  Templates dir: ${String(TEMPLATES_DIR).slice(0, 24).padEnd(24)}│
│  Claude key:  ${(process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING').padEnd(26)}│
│  GitHub auth: ${(process.env.GITHUB_CLIENT_ID ? 'enabled' : 'disabled').padEnd(26)}│
│  GitLab auth: ${(process.env.GITLAB_CLIENT_ID ? 'enabled' : 'disabled').padEnd(26)}│
└─────────────────────────────────────────┘
`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[startup] ERROR: ANTHROPIC_API_KEY is not set. Generation will fail.');
  }
  if (templates.length === 0) {
    console.warn('[startup] WARNING: No valid templates found. Check TEMPLATES_DIR.');
  }
});
