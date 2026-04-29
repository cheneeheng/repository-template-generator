import { Router } from 'express';
import { z } from 'zod';

export const itemsRouter = Router();

const CreateItemSchema = z.object({ name: z.string().min(1) });

const items: { id: number; name: string }[] = [];
let nextId = 1;

itemsRouter.get('/', (_req, res) => {
  res.json(items);
});

itemsRouter.post('/', (req, res) => {
  const parsed = CreateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const item = { id: nextId++, name: parsed.data.name };
  items.push(item);
  res.status(201).json(item);
});
