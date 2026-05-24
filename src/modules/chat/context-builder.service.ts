import type Database from "better-sqlite3";
import type { RagResult } from "../rag/rag.types.js";
import type { BuildContextInput, ChatContext } from "./chat.types.js";
import { createToolExecutionTrace } from "./orchestration.tools.js";
import type { ToolInvocationRecord } from "./orchestration.tools.js";
import {
  ToolExecutorService,
  type ToolTurnContext,
} from "./tool-executor.service.js";

/** Porta de busca RAG injetável (testes sem Chroma). */
export type KnowledgeSearchPort = {
  search(query: string): Promise<RagResult[]>;
};

export type BuildContextResult = {
  context: ChatContext;
  toolTrace: ToolInvocationRecord[];
};

export class ContextBuilderService {
  constructor(private readonly toolExecutor: ToolExecutorService) {}

  static fromDatabase(db: Database.Database): ContextBuilderService {
    return new ContextBuilderService(ToolExecutorService.fromDatabase(db));
  }

  async buildContext(input: BuildContextInput): Promise<BuildContextResult> {
    const userMessage = input.userMessage.trim();
    const safeMode = input.classification.riskLevel === "high";
    const trace = createToolExecutionTrace();

    const turn: ToolTurnContext = {
      userId: input.userId,
      userMessage,
      classification: input.classification,
      safeMode,
      trace,
    };

    const recentMessages = this.toolExecutor.getRecentMessages(turn);
    const userFacts = this.toolExecutor.getUserFacts(turn);
    const ragResults = await this.toolExecutor.searchKnowledgeBase(turn);

    const toolTrace = trace.list();

    const context: ChatContext = {
      userId: input.userId,
      userMessage,
      classification: input.classification,
      recentMessages,
      userFacts,
      ragResults,
      safeMode,
      toolsInvoked: toolTrace,
    };

    return { context, toolTrace };
  }
}
