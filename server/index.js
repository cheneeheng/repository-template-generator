import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './app.js';
import { scanTemplates } from './routes/templates.js';
import { LLM_ENABLED } from './services/llm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = createApp();

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

  if (!LLM_ENABLED) {
    console.warn(`
╔══════════════════════════════════════════╗
║  ⚠  BYPASS MODE — LLM DISABLED          ║
║  ANTHROPIC_API_KEY is not set.           ║
║  Templates will be returned unchanged.  ║
║  Refinement is disabled.                 ║
╚══════════════════════════════════════════╝
`);
  }
  if (templates.length === 0) {
    console.warn('[startup] WARNING: No valid templates found. Check TEMPLATES_DIR.');
  }
});
