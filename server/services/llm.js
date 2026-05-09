import Anthropic from '@anthropic-ai/sdk';
import clarinet from 'clarinet';
import createError from 'http-errors';
import { CURRENT_PROMPT_VERSION, CURRENT_REFINE_VERSION } from '../prompts/registry.js';

export const LLM_ENABLED = !!process.env.ANTHROPIC_API_KEY;

const client = new Anthropic();

export async function customise(files, projectName, description) {
  const response = await client.messages.create({
    model: CURRENT_PROMPT_VERSION.model,
    max_tokens: 8192,
    system: CURRENT_PROMPT_VERSION.system,
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

async function streamParseFileTree(stream, res) {
  const assembled = [];
  let parseError = null;

  await new Promise((resolve, reject) => {
    const parser = clarinet.createStream();
    let depth = 0;
    let inObject = false;
    let currentKey = null;
    let currentFile = {};

    parser.onvalue = (v) => {
      if (depth === 2 && currentKey) {
        currentFile[currentKey] = v;
      }
    };
    parser.onkey = (k) => { currentKey = k; };
    parser.onopenobject = (firstKey) => {
      depth++;
      if (depth === 2) {
        currentFile = {};
        inObject = true;
        currentKey = firstKey ?? null;
      }
    };
    parser.oncloseobject = () => {
      if (depth === 2 && inObject) {
        assembled.push(currentFile);
        res.write('data: ' + JSON.stringify({
          type: 'file_done',
          path: currentFile.path,
          content: currentFile.content,
        }) + '\n\n');
        currentFile = {};
        inObject = false;
      }
      depth--;
    };
    parser.onopenarray = () => { depth++; };
    parser.onclosearray = () => { depth--; };
    parser.on('error', (e) => { parseError = e; resolve(); });
    parser.on('end', () => resolve());

    stream.on('text', (text) => {
      res.write('data: ' + JSON.stringify({ type: 'delta', chunk: text }) + '\n\n');
      parser.write(text);
    });

    stream.on('finalMessage', () => { parser.end(); });
    stream.on('error', reject);
  });

  if (parseError) {
    throw createError(500, 'LLM response was truncated or malformed');
  }
  return assembled;
}

export async function customiseStreaming(files, projectName, description, res) {
  if (!LLM_ENABLED) {
    for (const file of files) {
      res.write('data: ' + JSON.stringify({
        type: 'file_done',
        path: file.path,
        content: file.content,
      }) + '\n\n');
    }
    return files;
  }

  const stream = client.messages.stream({
    model: CURRENT_PROMPT_VERSION.model,
    max_tokens: 8192,
    system: CURRENT_PROMPT_VERSION.system,
    messages: [
      {
        role: 'user',
        content: JSON.stringify({ projectName, description, files }),
      },
    ],
  });

  return streamParseFileTree(stream, res);
}

export async function refineStreaming(fileTree, history, instruction, res) {
  const messages = [
    ...history,
    {
      role: 'user',
      content: buildRefinePrompt(fileTree, instruction),
    },
  ];

  const stream = client.messages.stream({
    model: CURRENT_REFINE_VERSION.model,
    max_tokens: 8192,
    system: CURRENT_REFINE_VERSION.system,
    messages,
  });

  return streamParseFileTree(stream, res);
}

function buildRefinePrompt(fileTree, instruction) {
  return JSON.stringify({ fileTree, instruction });
}
