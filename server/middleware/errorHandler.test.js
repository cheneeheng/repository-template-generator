import { describe, it, expect, vi } from 'vitest';
import { ZodError } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import createError from 'http-errors';
import { errorHandler } from './errorHandler.js';

function makeRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res;
}

describe('errorHandler', () => {
  const next = vi.fn();
  const req = {};

  it('returns 400 for ZodError', () => {
    const err = new ZodError([{
      path: ['x'], message: 'required', code: 'invalid_type',
      expected: 'string', received: 'undefined',
    }]);
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 422 for Anthropic context overflow', () => {
    const err = new Anthropic.APIError(400, { message: 'prompt is too long' }, 'prompt is too long', {});
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'context_overflow' }));
  });

  it('returns 502 for other Anthropic APIError', () => {
    const err = new Anthropic.APIError(529, { message: 'overloaded' }, 'overloaded', {});
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('passes through http-errors status code', () => {
    const err = createError(422, 'Template too large');
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 500 for unknown error', () => {
    const err = new Error('something unexpected');
    const res = makeRes();
    errorHandler(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
