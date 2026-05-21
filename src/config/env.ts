import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("./data/app.sqlite"),
});

export const env = envSchema.parse({
  DATABASE_PATH: process.env.DATABASE_PATH,
});
