import Anthropic from '@anthropic-ai/sdk';
import createError from 'http-errors';
import { SYSTEM_PROMPT } from '../prompts/customise.js';

const client = new Anthropic();

export async function customise(files, projectName, description) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ projectName, description, files }),
      },
    ],
  });

  const text = response.content[0].text;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`LLM returned non-JSON response: ${text}`);
  }
}

export async function customiseStreaming(files, projectName, description, res) {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ projectName, description, files }),
      },
    ],
  });

  let accumulated = '';
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      accumulated += chunk.delta.text;
      res.write('data: ' + JSON.stringify({ type: 'delta', chunk: chunk.delta.text }) + '\n\n');
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(accumulated);
  } catch {
    throw createError(500, 'LLM response was truncated or malformed');
  }
  return parsed;
}
