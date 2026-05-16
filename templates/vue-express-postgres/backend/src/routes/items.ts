import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";

export const itemsRouter = Router();

itemsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await query("SELECT id, name FROM items ORDER BY id");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get("/:id", async (req, res, next) => {
  try {
    const rows = await query("SELECT id, name FROM items WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ name: z.string().min(1) });

itemsRouter.post("/", async (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    const rows = await query(
      "INSERT INTO items (name) VALUES ($1) RETURNING id, name",
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});
