import rateLimit from 'express-rate-limit';

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10);

export const authStartLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — try again in 15 minutes' },
});

export const generateLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_GENERATE_MAX ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Too many generation requests — try again shortly' },
});

export const refineLimiter = rateLimit({
  windowMs,
  max: parseInt(process.env.RATE_LIMIT_REFINE_MAX ?? '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limit_exceeded', message: 'Too many refinement requests — try again shortly' },
});
