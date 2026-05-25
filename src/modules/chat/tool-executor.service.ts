import type Database from "better-sqlite3";
import { looksLikeRecommendationRequest } from "../llm/intent-fallback.classifier.js";
import type { Intent, IntentClassification } from "../llm/intent.types.js";
import { enrichRagQueryWithUserDiet } from "../memory/fact-restriction-concepts.js";
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
import type { ConversationStage } from "./conversation-stage.types.js";
import { isActiveOrderStage } from "./conversation-stage.types.js";
import type { KnowledgeSearchPort } from "./context-builder.service.js";
import type { ToolExecutionTrace } from "./orchestration.tools.js";
import {
  extractMenuCatalogFromRag,
  matchMessageToResolvedMenu,
} from "./resolve-menu-items.service.js";
import type { ResolvedMenuItem } from "./resolve-menu-items.types.js";
import {
  looksLikeOrderAcceptance,
  looksLikeOrderFlowMessage,
  looksLikeOrderModification,
  looksLikeOrderStart,
} from "../llm/intent-fallback.classifier.js";

export type ToolTurnContext = {
  userId: string;
  userMessage: string;
  classification: IntentClassification;
  safeMode: boolean;
  trace: ToolExecutionTrace;
};

const RECOMMENDATION_INTENTS: Intent[] = [
  "general_recommendation",
  "personalized_recommendation",
];

function shouldLoadUserFacts(
  classification: IntentClassification,
  userMessage: string,
): boolean {
  if (classification.needsUserFacts) {
    return true;
  }

  if (RECOMMENDATION_INTENTS.includes(classification.intent)) {
    return true;
  }

  return looksLikeRecommendationRequest(userMessage);
}

function shouldEnrichRagQuery(
  classification: IntentClassification,
  userMessage: string,
): boolean {
  if (RECOMMENDATION_INTENTS.includes(classification.intent)) {
    return true;
  }

  if (looksLikeRecommendationRequest(userMessage)) {
    return true;
  }

  return classification.intent === "menu_inquiry";
}

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

    if (!shouldLoadUserFacts(ctx.classification, ctx.userMessage)) {
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

    const baseQuery = ctx.userMessage.trim();
    if (!baseQuery) {
      ctx.trace.recordSkipped("search_knowledge_base", "empty query");
      return [];
    }

    const query = shouldEnrichRagQuery(ctx.classification, ctx.userMessage)
      ? enrichRagQueryWithUserDiet(ctx.userId, baseQuery, this.memoryService)
      : baseQuery;

    ctx.trace.recordInvoked("search_knowledge_base");
    return this.knowledgeSearch.search(query);
  }

  async resolveMenuItems(
    ctx: ToolTurnContext,
    currentStage: ConversationStage,
  ): Promise<ResolvedMenuItem[]> {
    if (ctx.safeMode) {
      ctx.trace.recordSkipped("resolve_menu_items", "safe mode (high risk)");
      return [];
    }

    if (looksLikeOrderAcceptance(ctx.userMessage)) {
      ctx.trace.recordSkipped(
        "resolve_menu_items",
        "order acceptance — draft unchanged",
      );
      return [];
    }

    if (currentStage === "closed") {
      ctx.trace.recordSkipped(
        "resolve_menu_items",
        `stage ${currentStage} does not resolve menu`,
      );
      return [];
    }

    if (
      currentStage === "confirming" &&
      !looksLikeOrderModification(ctx.userMessage)
    ) {
      ctx.trace.recordSkipped(
        "resolve_menu_items",
        "stage confirming — no item change",
      );
      return [];
    }

    const shouldResolve =
      isActiveOrderStage(currentStage) ||
      currentStage === "greeting" ||
      currentStage === "exploring" ||
      looksLikeOrderStart(ctx.userMessage) ||
      looksLikeOrderFlowMessage(ctx.userMessage) ||
      ctx.classification.intent === "menu_inquiry";

    if (!shouldResolve) {
      ctx.trace.recordSkipped(
        "resolve_menu_items",
        `intent ${ctx.classification.intent} / stage ${currentStage}`,
      );
      return [];
    }

    const message = ctx.userMessage.trim();
    if (!message) {
      ctx.trace.recordSkipped("resolve_menu_items", "empty message");
      return [];
    }

    const query = `${message} cardápio menu combo burger preço bebida`;
    ctx.trace.recordInvoked("resolve_menu_items");
    const chunks = await this.knowledgeSearch.search(query);
    const catalog = extractMenuCatalogFromRag(chunks);
    return matchMessageToResolvedMenu(message, catalog);
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
