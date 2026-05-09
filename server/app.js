import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'express-async-errors';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import templatesRouter from './routes/templates.js';
import generateRouter from './routes/generate.js';
import refineRouter from './routes/refine.js';
import exportRouter from './routes/export.js';
import authRouter from './routes/auth.js';
import configRouter from './routes/config.js';
import shareRouter from './routes/share.js';

export function createApp() {
  const app = express();
  app.use(cors());
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
  app.use(express.json());
  app.use('/api/health', healthRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/generate', generateRouter);
  app.use('/api/refine', refineRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/config', configRouter);
  app.use('/api/share', shareRouter);
  app.use(errorHandler);
  return app;
}
