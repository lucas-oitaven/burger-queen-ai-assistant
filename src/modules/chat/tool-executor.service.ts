import type Database from "better-sqlite3";
import type { IntentClassification } from "../llm/intent.types.js";
import { MemoryService } from "../memory/memory.service.js";
import type { ProcessUserMessageResult, UserFact } from "../memory/memory.types.js";
import { searchKnowledgeBase } from "../rag/rag.service.js";
import type { RagResult } from "../rag/rag.types.js";
import {
  SAFE_MODE_RECENT_MESSAGE_LIMIT,
  SHORT_TERM_MESSAGE_LIMIT,
} from "./chat.config.js";
import type { Message } from "./message.types.js";
import { MessageRepository } from "./message.repository.js";
import type { KnowledgeSearchPort } from "./context-builder.service.js";
import type { ToolExecutionTrace } from "./orchestration.tools.js";

export type ToolTurnContext = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
  safeMode: boolean;
  trace: ToolExecutionTrace;
};

export class ToolExecutorService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly memoryService: MemoryService,
    private readonly knowledgeSearch: KnowledgeSearchPort = {
      search: searchKnowledgeBase,
    },
  ) {}

  static fromDatabase(db: Database.Database): ToolExecutorService {
    return new ToolExecutorService(
      new MessageRepository(db),
      MemoryService.fromDatabase(db),
    );
  }

  /** Short-term memory window — always evaluated; may return []. */
  getRecentMessages(ctx: ToolTurnContext): Message[] {
    const limit = ctx.safeMode
      ? SAFE_MODE_RECENT_MESSAGE_LIMIT
      : SHORT_TERM_MESSAGE_LIMIT;

    ctx.trace.recordInvoked("get_recent_messages");
    return this.messageRepository.findRecentByUserId(ctx.userId, limit);
  }

  getUserFacts(ctx: ToolTurnContext): UserFact[] {
    if (ctx.safeMode) {
      ctx.trace.recordSkipped("get_user_facts", "safe mode (high risk)");
      return [];
    }

    if (!ctx.classification.needsUserFacts) {
      ctx.trace.recordSkipped(
        "get_user_facts",
        `intent ${ctx.classification.intent} does not need user facts`,
      );
      return [];
    }

    ctx.trace.recordInvoked("get_user_facts");
    return this.memoryService.listActiveFacts(ctx.userId);
  }

  async searchKnowledgeBase(ctx: ToolTurnContext): Promise<RagResult[]> {
    if (ctx.safeMode) {
      ctx.trace.recordSkipped("search_knowledge_base", "safe mode (high risk)");
      return [];
    }

    if (!ctx.classification.needsRag) {
      ctx.trace.recordSkipped(
        "search_knowledge_base",
        `intent ${ctx.classification.intent} does not need RAG`,
      );
      return [];
    }

    const query = ctx.userMessage.trim();
    if (!query) {
      ctx.trace.recordSkipped("search_knowledge_base", "empty query");
      return [];
    }

    ctx.trace.recordInvoked("search_knowledge_base");
    return this.knowledgeSearch.search(query);
  }

  async saveUserFact(
    ctx: ToolTurnContext,
  ): Promise<ProcessUserMessageResult | null> {
    if (ctx.safeMode) {
      ctx.trace.recordSkipped("save_user_fact", "safe mode (high risk)");
      return null;
    }

    if (!ctx.classification.shouldExtractFacts) {
      ctx.trace.recordSkipped(
        "save_user_fact",
        `intent ${ctx.classification.intent} does not extract facts`,
      );
      return null;
    }

    const message = ctx.userMessage.trim();
    if (!message) {
      ctx.trace.recordSkipped("save_user_fact", "empty message");
      return null;
    }

    ctx.trace.recordInvoked("save_user_fact");
    return this.memoryService.processUserMessage(ctx.userId, message);
  }
}
