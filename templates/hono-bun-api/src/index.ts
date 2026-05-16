import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { healthRoute } from "./routes/health";
import { itemsRoute } from "./routes/items";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/health", healthRoute);
app.route("/api/items", itemsRoute);

const port = Number(process.env.PORT ?? 3000);
console.log(`{{PROJECT_NAME}} listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
