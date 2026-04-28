import cors from 'cors';
import express from 'express';
import healthRouter from './routes/health.js';
import templatesRouter from './routes/templates.js';
import generateRouter from './routes/generate.js';
import exportRouter from './routes/export.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);

app.use((err, req, res, next) => {
  const status = err.status ?? err.statusCode ?? 500;
  res.status(status).json({ error: err.message });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
