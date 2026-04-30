import 'dotenv/config';
import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import healthRouter from './routes/health.js';
import templatesRouter from './routes/templates.js';
import generateRouter from './routes/generate.js';
import exportRouter from './routes/export.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);
app.use('/api/auth', authRouter);

app.use(errorHandler);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
