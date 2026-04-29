import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATES_DIR =
  process.env.TEMPLATES_DIR ?? path.resolve(__dirname, '../../templates');

export async function load(templateId) {
  const templatePath = path.join(TEMPLATES_DIR, templateId);
  const allFiles = await fs.readdir(templatePath, { recursive: true });

  const results = await Promise.all(
    allFiles.map(async relPath => {
      if (relPath === 'template.json') return null;

      const absPath = path.join(templatePath, relPath);
      const stat = await fs.stat(absPath);
      if (stat.isDirectory()) return null;

      const content = await fs.readFile(absPath, 'utf8');
      return { path: relPath, content };
    })
  );

  return results.filter(Boolean);
}
