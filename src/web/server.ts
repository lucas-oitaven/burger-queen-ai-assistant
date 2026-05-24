import type { Server } from "node:http";
import { env } from "../config/env.js";
import { closeDatabase } from "../database/sqlite.js";
import { isScriptMain } from "../utils/is-script-main.js";
import { createWebApp } from "./create-app.js";

export function startWebServer(port: number = env.WEB_PORT): Server {
  const app = createWebApp();
  const server = app.listen(port);

  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[web] Porta ${port} já está em uso. Encerre o outro processo ou altere WEB_PORT no .env.`,
      );
    } else {
      console.error("[web] Erro ao iniciar servidor:", error);
    }
    process.exit(1);
  });

  server.once("listening", () => {
    console.log("[web] Burger Queen — Web UI");
    console.log(`[web] Local:  http://localhost:${port}`);
    console.log(`[web] Health: http://localhost:${port}/api/health`);
  });

  return server;
}

function runWebServer(): void {
  const server = startWebServer();

  const shutdown = (): void => {
    console.log("\n[web] Encerrando...");
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // npm no Windows pode fechar stdin; manter TTY aberto evita encerramento prematuro.
  if (process.stdin.isTTY) {
    process.stdin.resume();
  }
}

if (isScriptMain("server.ts")) {
  runWebServer();
}
