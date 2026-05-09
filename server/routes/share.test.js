import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../app.js';

vi.mock('../services/llm.js', () => ({
  LLM_ENABLED: false,
  customiseStreaming: vi.fn(),
  refineStreaming: vi.fn(),
}));

const app = createApp();
const request = supertest(app);

const validPayload = {
  fileTree: [{ path: 'README.md', content: '# Hello' }],
  projectName: 'my-app',
  templateId: 'node-express',
};

describe('POST /api/share', () => {
  it('returns an 8-char hex id', async () => {
    const res = await request.post('/api/share').send(validPayload);
    expect(res.status).toBe(200);
    expect(res.body.id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns 400 for missing fields', async () => {
    const res = await request.post('/api/share').send({ fileTree: [] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/share/:id', () => {
  it('retrieves stored payload', async () => {
    const post = await request.post('/api/share').send(validPayload);
    const { id } = post.body;

    const res = await request.get(`/api/share/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.projectName).toBe('my-app');
    expect(res.body.templateId).toBe('node-express');
    expect(res.body.fileTree).toEqual(validPayload.fileTree);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request.get('/api/share/00000000');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 410 for expired entry', async () => {
    const post = await request.post('/api/share').send(validPayload);
    const { id } = post.body;

    const realNow = Date.now;
    Date.now = () => realNow() + 25 * 60 * 60 * 1000;
    try {
      const res = await request.get(`/api/share/${id}`);
      expect(res.status).toBe(410);
      expect(res.body.error).toBe('expired');
    } finally {
      Date.now = realNow;
    }
  });
});
