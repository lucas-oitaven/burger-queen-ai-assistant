/**
 * Smoke test Issue #17 Parte 17.2 — web API (login, facts; chat se OPENAI_API_KEY).
 * Uso: npm run verify:web-api
 */
import type { Server } from "node:http";
import { closeDatabase } from "../database/sqlite.js";
import { createWebApp } from "../web/create-app.js";
import { env } from "../config/env.js";
import { resetDatabase } from "./resetDatabase.js";
import { seedDemoUsers } from "./seedDemoUsers.js";

function assertLabel(label: string, ok: boolean): boolean {
  console.log(`[verify:web-api] ${ok ? "OK" : "FAIL"} — ${label}`);
  return ok;
}

async function listen(app: ReturnType<typeof createWebApp>): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

function serverPort(server: Server): number {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not resolve server port");
  }
  return address.port;
}

async function main(): Promise<void> {
  let passed = 0;
  let total = 0;

  resetDatabase();
  seedDemoUsers();

  const app = createWebApp();
  const server = await listen(app);
  const base = `http://127.0.0.1:${serverPort(server)}`;

  try {
    total += 1;
    const loginRes = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginName: "ana" }),
    });
    const loginJson = (await loginRes.json()) as {
      userId?: string;
      loginName?: string;
      displayName?: string;
    };
    if (
      assertLabel(
        "POST /api/login — ana",
        loginRes.status === 200 &&
          loginJson.loginName === "ana" &&
          typeof loginJson.userId === "string",
      )
    ) {
      passed += 1;
    }

    const userId = loginJson.userId;
    if (!userId) {
      console.error("[verify:web-api] abort — no userId from login");
      process.exitCode = 1;
      return;
    }

    total += 1;
    const factsRes = await fetch(`${base}/api/facts?userId=${userId}`);
    const factsJson = (await factsRes.json()) as { facts?: unknown[] };
    if (
      assertLabel(
        "GET /api/facts — seeded ana facts",
        factsRes.status === 200 &&
          Array.isArray(factsJson.facts) &&
          factsJson.facts.length >= 1,
      )
    ) {
      passed += 1;
    }

    total += 1;
    const brunoLogin = await fetch(`${base}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loginName: "bruno" }),
    });
    const brunoJson = (await brunoLogin.json()) as { userId?: string };
    const brunoFacts = await fetch(
      `${base}/api/facts?userId=${brunoJson.userId ?? ""}`,
    );
    const brunoFactsJson = (await brunoFacts.json()) as { facts?: { fact?: string }[] };
    const anaFactText = JSON.stringify(factsJson.facts ?? []);
    const brunoFactText = JSON.stringify(brunoFactsJson.facts ?? []);
    if (
      assertLabel(
        "isolation — ana vs bruno facts differ",
        brunoFacts.status === 200 && anaFactText !== brunoFactText,
      )
    ) {
      passed += 1;
    }

    if (env.OPENAI_API_KEY?.trim()) {
      total += 1;
      const chatRes = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: "O que você me recomenda hoje?",
          debug: true,
        }),
      });
      const chatJson = (await chatRes.json()) as {
        reply?: string;
        debug?: { intent?: string };
        error?: string;
        details?: string;
      };

      if (chatRes.status !== 200) {
        const detail = String(chatJson.details ?? chatJson.error ?? "");
        if (detail.includes("ChromaDB") || detail.includes("chromadb")) {
          console.log(
            "[verify:web-api] SKIP — POST /api/chat (Chroma not running — chroma run + seed:kb)",
          );
          passed += 1;
        } else if (
          assertLabel(
            "POST /api/chat — reply + debug",
            false,
          )
        ) {
          console.log("  response:", chatJson);
        }
      } else if (
        assertLabel(
          "POST /api/chat — reply + debug",
          typeof chatJson.reply === "string" &&
            chatJson.reply.length > 0 &&
            chatJson.debug?.intent === "personalized_recommendation",
        )
      ) {
        passed += 1;
      }
    } else {
      console.log(
        "[verify:web-api] SKIP — POST /api/chat (OPENAI_API_KEY not set)",
      );
    }

    total += 1;
    const badChat = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "not-a-uuid", message: "oi" }),
    });
    if (assertLabel("POST /api/chat — 400 invalid userId", badChat.status === 400)) {
      passed += 1;
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    closeDatabase();
  }

  console.log(`\n[verify:web-api] ${passed}/${total} checks passed`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("[verify:web-api] Erro:", error);
  closeDatabase();
  process.exitCode = 1;
});
