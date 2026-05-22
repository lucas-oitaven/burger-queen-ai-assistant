import type Database from "better-sqlite3";
import type { IntentClassification } from "../llm/intent.types.js";
import { MemoryService } from "../memory/memory.service.js";
import { searchKnowledgeBase } from "../rag/rag.service.js";
import type { RagResult } from "../rag/rag.types.js";
import {
  SAFE_MODE_RECENT_MESSAGE_LIMIT,
  SHORT_TERM_MESSAGE_LIMIT,
} from "./chat.config.js";
import type { BuildContextInput, ChatContext } from "./chat.types.js";
import { MessageRepository } from "./message.repository.js";

/** Porta de busca RAG injetável (testes sem Chroma). */
export type KnowledgeSearchPort = {
  search(query: string): Promise<RagResult[]>;
};

export class ContextBuilderService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly memoryService: MemoryService,
    private readonly knowledgeSearch: KnowledgeSearchPort = {
      search: searchKnowledgeBase,
    },
  ) {}

  static fromDatabase(db: Database.Database): ContextBuilderService {
    return new ContextBuilderService(
      new MessageRepository(db),
      MemoryService.fromDatabase(db),
    );
  }

  async buildContext(input: BuildContextInput): Promise<ChatContext> {
    const userMessage = input.userMessage.trim();
    const safeMode = input.classification.riskLevel === "high";

    const recentMessages = this.messageRepository.findRecentByUserId(
      input.userId,
      safeMode ? SAFE_MODE_RECENT_MESSAGE_LIMIT : SHORT_TERM_MESSAGE_LIMIT,
    );

    const userFacts = this.resolveUserFacts(
      input.userId,
      input.classification,
      safeMode,
    );

    const ragResults = await this.resolveRagResults(
      userMessage,
      input.classification,
      safeMode,
    );

    return {
      userId: input.userId,
      userMessage,
      classification: input.classification,
      recentMessages,
      userFacts,
      ragResults,
      safeMode,
    };
  }

  private resolveUserFacts(
    userId: string,
    classification: IntentClassification,
    safeMode: boolean,
  ) {
    if (safeMode || !classification.needsUserFacts) {
      return [];
    }

    return this.memoryService.listActiveFacts(userId);
  }

  private async resolveRagResults(
    userMessage: string,
    classification: IntentClassification,
    safeMode: boolean,
  ): Promise<RagResult[]> {
    if (safeMode || !classification.needsRag || !userMessage) {
      return [];
    }

    return this.knowledgeSearch.search(userMessage);
  }
}
