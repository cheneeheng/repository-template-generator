#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

import { VERSIONS } from '../server/prompts/registry.js';
import { load as loadTemplateFiles } from '../server/services/assembler.js';

// Use EVAL_PROMPT_VERSION to avoid conflicting with server/prompts/registry.js,
// which also reads PROMPT_VERSION at module-init and would throw on 'v1'/'v2' values.
const PROMPT_VERSION = process.env.EVAL_PROMPT_VERSION ?? 'v1';
const promptConfig = VERSIONS[`customise-${PROMPT_VERSION}`];
if (!promptConfig) {
  console.error(`Unknown prompt version: customise-${PROMPT_VERSION}`);
  process.exit(1);
}

const FIXTURES_DIR = new URL('./evals/fixtures', import.meta.url).pathname;
const client = new Anthropic();

async function runFixture(fixtureName) {
  const dir = path.join(FIXTURES_DIR, fixtureName);
  const input = JSON.parse(await fs.readFile(path.join(dir, 'input.json'), 'utf8'));
  const golden = JSON.parse(await fs.readFile(path.join(dir, 'golden.json'), 'utf8'));

  const start = Date.now();

  const userContent = `Project name: ${input.projectName}\nDescription: ${input.description}\nFiles: ${JSON.stringify(
    await loadTemplateFiles(input.templateId)
  )}`;

  const response = await client.messages.create({
    model: promptConfig.model,
    max_tokens: 8192,
    system: promptConfig.system,
    messages: [{ role: 'user', content: userContent }],
  });

  const raw = response.content.find(b => b.type === 'text')?.text ?? '';

  let fileTree;
  try {
    fileTree = JSON.parse(raw);
    if (!Array.isArray(fileTree)) throw new Error('not an array');
  } catch {
    return { fixtureName, elapsed: Date.now() - start, failures: ['LLM output was not a valid JSON array'] };
  }

  const elapsed = Date.now() - start;
  const failures = assertGolden(fileTree, golden);
  return { fixtureName, elapsed, failures };
}

function assertGolden(fileTree, golden) {
  const failures = [];
  const byPath = Object.fromEntries(fileTree.map(f => [f.path, f.content]));

  for (const required of golden.requiredFiles ?? []) {
    if (!byPath[required]) failures.push(`missing file ${required}`);
  }

  for (const [filePath, substrings] of Object.entries(golden.requiredContent ?? {})) {
    const content = byPath[filePath] ?? '';
    for (const s of substrings) {
      if (!content.includes(s)) failures.push(`${filePath} missing "${s}"`);
    }
  }

  return failures;
}

async function main() {
  const entries = await fs.readdir(FIXTURES_DIR, { withFileTypes: true });
  const fixtures = entries.filter(e => e.isDirectory()).map(e => e.name);

  console.log(`\nRunning evals against prompt version: ${PROMPT_VERSION}\n`);

  let passed = 0;
  let failed = 0;

  for (const name of fixtures) {
    const result = await runFixture(name);
    if (result.failures.length === 0) {
      console.log(`  ✓  ${name.padEnd(30)} (${result.elapsed}ms)`);
      passed++;
    } else {
      console.log(`  ✗  ${name.padEnd(30)} (${result.elapsed}ms)`);
      result.failures.forEach(f => console.log(`       FAIL: ${f}`));
      failed++;
    }
  }

  console.log(`\n${fixtures.length} fixtures, ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
