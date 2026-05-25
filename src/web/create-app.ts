import path from "node:path";
import express, { type Express } from "express";
import { registerApiRoutes } from "./routes/api.routes.js";
import {
  createDefaultWebDependencies,
  type WebAppDependencies,
} from "./web.dependencies.js";

/**
 * Factory Express testável (Issue #17).
 * API REST na 17.2; UI estática em `public/`.
 */
export function createWebApp(
  deps: WebAppDependencies = createDefaultWebDependencies(),
): Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  registerApiRoutes(app, deps);

  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  return app;
}
