import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { healthRoute } from "./routes/health";

const app = new Hono().route("/health", healthRoute);

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
