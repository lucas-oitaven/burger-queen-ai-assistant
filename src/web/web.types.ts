import { z } from "zod";
import type { OrchestrationDebugSnapshot } from "../modules/chat/orchestration-debug.types.js";
import type { OrchestrationResult } from "../modules/chat/orchestration.types.js";
import type { UserFact } from "../modules/memory/memory.types.js";

export const loginRequestSchema = z.object({
  loginName: z.string().trim().min(1, "loginName is required"),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export type LoginResponse = {
  userId: string;
  loginName: string;
  displayName: string;
};

export const chatRequestSchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
  message: z.string().trim().min(1, "message is required"),
  debug: z.boolean().optional().default(false),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type SerializedUserFact = {
  id: number;
  fact: string;
  category: UserFact["category"];
  confidence: number;
};

export type ChatResponse = {
  reply: string;
  ragUsed: boolean;
  retrievedDocs: string[];
  savedFactsCount: number;
  savedFacts: SerializedUserFact[];
  debug?: OrchestrationDebugSnapshot;
};

export const factsQuerySchema = z.object({
  userId: z.string().uuid("userId must be a valid UUID"),
});

export const messagesQuerySchema = factsQuerySchema;

export type FactsResponse = {
  userId: string;
  facts: SerializedUserFact[];
};

export type SerializedMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type MessagesResponse = {
  userId: string;
  messages: SerializedMessage[];
};

export function serializeUserFact(fact: UserFact): SerializedUserFact {
  return {
    id: fact.id,
    fact: fact.fact,
    category: fact.category,
    confidence: fact.confidence,
  };
}

export function buildChatResponse(
  result: OrchestrationResult,
  includeDebug: boolean,
): ChatResponse {
  const response: ChatResponse = {
    reply: result.reply,
    ragUsed: result.ragUsed,
    retrievedDocs: result.retrievedDocs,
    savedFactsCount: result.savedFactsCount,
    savedFacts: result.savedFacts.map(serializeUserFact),
  };

  if (includeDebug) {
    response.debug = result.debug;
  }

  return response;
}

export type ApiErrorResponse = {
  error: string;
  details?: unknown;
};
