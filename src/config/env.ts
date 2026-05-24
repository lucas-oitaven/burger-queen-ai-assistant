import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("./data/app.sqlite"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().min(1).default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z
    .string()
    .min(1)
    .default("text-embedding-3-small"),
  CHROMA_URL: z.string().url().default("http://localhost:8000"),
  CHROMA_COLLECTION: z
    .string()
    .min(1)
    .default("burger_queen_knowledge_base"),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export const env = envSchema.parse({
  DATABASE_PATH: process.env.DATABASE_PATH,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  CHROMA_URL: process.env.CHROMA_URL,
  CHROMA_COLLECTION: process.env.CHROMA_COLLECTION,
  WEB_PORT: process.env.WEB_PORT,
});

/** Exigido apenas em scripts que chamam a OpenAI (ex.: `seed:kb`). */
export function requireOpenAiApiKey(): string {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY não definida. Configure no arquivo .env (seed:kb, verify:memory-extractor, etc.).",
    );
  }
  return key;
}
