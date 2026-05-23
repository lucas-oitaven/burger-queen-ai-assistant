import { defineConfig } from "vitest/config";

/** Só `rag.service.test.ts`, com integração Chroma habilitada. */
export default defineConfig({
  test: {
    include: ["tests/rag.service.test.ts"],
    environment: "node",
    env: {
      RUN_RAG_INTEGRATION: "1",
    },
  },
});
