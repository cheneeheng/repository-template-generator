import express from "express";
import cors from "cors";
import { itemsRouter } from "./routes/items.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/items", itemsRouter);

app.use((_req, res) => res.status(404).json({ error: "not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`{{PROJECT_NAME}} backend listening on port ${port}`));

export { app };
