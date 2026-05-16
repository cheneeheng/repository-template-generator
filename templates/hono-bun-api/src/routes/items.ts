import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const itemsRoute = new Hono();

type Item = { id: number; name: string };
const items: Item[] = [];
let nextId = 1;

const createSchema = z.object({ name: z.string().min(1) });

itemsRoute.get("/", (c) => c.json(items));

itemsRoute.get("/:id", (c) => {
  const item = items.find((i) => i.id === Number(c.req.param("id")));
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

itemsRoute.post("/", zValidator("json", createSchema), (c) => {
  const { name } = c.req.valid("json");
  const item = { id: nextId++, name };
  items.push(item);
  return c.json(item, 201);
});
