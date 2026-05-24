import path from "node:path";
import express, { type Express } from "express";

/**
 * Factory Express testável (Issue #17.1).
 * Rotas de API e orquestração entram nas partes 17.2+.
 */
export function createWebApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const publicDir = path.join(process.cwd(), "public");
  app.use(express.static(publicDir));

  return app;
}
