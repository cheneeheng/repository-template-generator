import express from 'express';
import { itemsRouter } from './routes/items.js';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/items', itemsRouter);

export default app;
