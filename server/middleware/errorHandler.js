import { ZodError } from 'zod';

export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation error', details: err.flatten() });
  }
  // err.statusCode = http-errors; err.status = Octokit RequestError
  const httpStatus = err.statusCode ?? err.status;
  if (httpStatus && httpStatus >= 400 && httpStatus < 600) {
    return res.status(httpStatus).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
