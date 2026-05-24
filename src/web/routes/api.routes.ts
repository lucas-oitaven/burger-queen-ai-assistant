import type { Express, Request, Response } from "express";
import type { z } from "zod";
import type { OrchestratorService } from "../../modules/chat/orchestrator.service.js";
import type { MemoryService } from "../../modules/memory/memory.service.js";
import type { UserRepository } from "../../modules/users/user.repository.js";
import {
  buildChatResponse,
  chatRequestSchema,
  factsQuerySchema,
  loginRequestSchema,
  serializeUserFact,
  type ApiErrorResponse,
} from "../web.types.js";

export type ApiRouteDependencies = {
  userRepository: UserRepository;
  orchestrator: OrchestratorService;
  memoryService: MemoryService;
};

function sendError(
  res: Response,
  status: number,
  error: string,
  details?: unknown,
): void {
  const body: ApiErrorResponse =
    details !== undefined ? { error, details } : { error };
  res.status(status).json(body);
}

function parseBody<TSchema extends z.ZodTypeAny>(
  res: Response,
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> | null {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    sendError(res, 400, "Invalid request", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

export function registerApiRoutes(
  app: Express,
  deps: ApiRouteDependencies,
): void {
  app.post("/api/login", (req: Request, res: Response) => {
    const body = parseBody(res, loginRequestSchema, req.body);
    if (!body) {
      return;
    }

    const user = deps.userRepository.findOrCreateByLoginName(body.loginName);
    res.json({
      userId: user.id,
      loginName: user.loginName,
      displayName: user.name,
    });
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    const body = parseBody(res, chatRequestSchema, req.body);
    if (!body) {
      return;
    }

    const user = deps.userRepository.findById(body.userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    try {
      const result = await deps.orchestrator.handleUserMessage(
        body.userId,
        body.message,
      );
      res.json(buildChatResponse(result, body.debug));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[web] POST /api/chat error:", error);
      sendError(res, 500, "Failed to process chat message", message);
    }
  });

  app.get("/api/facts", (req: Request, res: Response) => {
    const parsed = factsQuerySchema.safeParse({ userId: req.query.userId });
    if (!parsed.success) {
      sendError(res, 400, "Invalid query", parsed.error.flatten());
      return;
    }

    const user = deps.userRepository.findById(parsed.data.userId);
    if (!user) {
      sendError(res, 404, "User not found");
      return;
    }

    const facts = deps.memoryService.listActiveFacts(parsed.data.userId);
    res.json({
      userId: parsed.data.userId,
      facts: facts.map(serializeUserFact),
    });
  });
}
