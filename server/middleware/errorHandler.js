import { ZodError } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../logger.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  }

  if (err instanceof Anthropic.APIError) {
    if (err.status === 400 && err.message?.includes('prompt is too long')) {
      return res.status(422).json({
        error: 'context_overflow',
        message: 'The conversation history is too long. Start a new refinement session or reduce the number of turns.',
      });
    }
    return res.status(502).json({ error: `LLM error: ${err.message}` });
  }

  // err.statusCode = http-errors; err.status = Octokit RequestError
  const httpStatus = err.statusCode ?? err.status;
  if (httpStatus && httpStatus >= 400 && httpStatus < 600) {
    return res.status(httpStatus).json({ error: err.message });
  }
  logger.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
