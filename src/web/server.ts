import type { Server } from "node:http";
import { env } from "../config/env.js";
import { isScriptMain } from "../utils/is-script-main.js";
import { createWebApp } from "./create-app.js";

export function startWebServer(port: number = env.WEB_PORT): Server {
  const app = createWebApp();

  const server = app.listen(port, () => {
    console.log("[web] Burger Queen — Web UI");
    console.log(`[web] Local:  http://localhost:${port}`);
    console.log(`[web] Health: http://localhost:${port}/api/health`);
  });

  return server;
}

if (isScriptMain("server.ts")) {
  startWebServer();
}
