import rateLimit from 'express-rate-limit';

export const authStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in 15 minutes' },
});
