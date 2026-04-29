import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import createError from 'http-errors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEMPLATES_DIR =
  process.env.TEMPLATES_DIR ?? path.resolve(__dirname, '../../templates');

const MAX_TEMPLATE_CHARS = parseInt(process.env.MAX_TEMPLATE_CHARS ?? '200000', 10);

export async function load(templateId) {
  const templatePath = path.join(TEMPLATES_DIR, templateId);

  let allFiles;
  try {
    allFiles = await fs.readdir(templatePath, { recursive: true });
  } catch (err) {
    if (err.code === 'ENOENT') throw createError(404, `Template "${templateId}" not found`);
    throw err;
  }

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

  const files = results.filter(Boolean);

  const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
  if (totalChars > MAX_TEMPLATE_CHARS) {
    throw createError(422, `Template "${templateId}" exceeds size limit (${totalChars} chars)`);
  }

  return files;
}
