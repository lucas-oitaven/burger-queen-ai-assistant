import type Database from "better-sqlite3";
import { IntentClassifierService } from "../llm/intent-classifier.service.js";
import { UserRepository } from "../users/user.repository.js";
import { ContextBuilderService } from "./context-builder.service.js";
import {
  buildOrchestrationDebugSnapshot,
  normalizeRetrievedDocRef,
} from "./orchestration-debug.formatter.js";
import { createToolExecutionTrace } from "./orchestration.tools.js";
import { OrchestrationLogRepository } from "./orchestration-log.repository.js";
import type { OrchestrationResult } from "./orchestration.types.js";
import { MessageRepository } from "./message.repository.js";
import { ResponseGeneratorService } from "./response-generator.service.js";
import {
  ToolExecutorService,
  type ToolTurnContext,
} from "./tool-executor.service.js";
import { ConversationStageService } from "./conversation-stage.service.js";

function uniqueRetrievedSources(
  sources: { source: string; sourcePath?: string }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of sources) {
    const key = normalizeRetrievedDocRef(item.source, item.sourcePath);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }

  return out;
}

export class OrchestratorService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly userRepository: UserRepository,
    private readonly intentClassifier: IntentClassifierService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly orchestrationLogs: OrchestrationLogRepository,
    private readonly conversationStages: ConversationStageService,
  ) {}

  static fromDatabase(db: Database.Database): OrchestratorService {
    const toolExecutor = ToolExecutorService.fromDatabase(db);
    return new OrchestratorService(
      new MessageRepository(db),
      new UserRepository(db),
      new IntentClassifierService(),
      new ContextBuilderService(toolExecutor),
      new ResponseGeneratorService(),
      toolExecutor,
      new OrchestrationLogRepository(db),
      ConversationStageService.fromDatabase(db),
    );
  }

  /**
   * Pipeline: salvar user → classificar → tools (contexto) → resposta → save_user_fact → assistant → log.
   */
  async handleUserMessage(
    userId: string,
    message: string,
  ): Promise<OrchestrationResult> {
    const trimmed = message.trim();
    const userMessage = this.messageRepository.create(
      userId,
      "user",
      trimmed || message,
    );

    const classification = await this.intentClassifier.classify(trimmed);
    const safeMode = classification.riskLevel === "high";

    const currentStage = this.conversationStages.getState(userId);
    const menuTrace = createToolExecutionTrace();
    const menuTurn: ToolTurnContext = {
      userId,
      userMessage: trimmed,
      classification,
      safeMode,
      trace: menuTrace,
    };
    const resolvedMenuItems = await this.toolExecutor.resolveMenuItems(
      menuTurn,
      currentStage.stage,
    );

    const conversationState = this.conversationStages.prepareTurn({
      userId,
      userMessage: trimmed,
      classification,
      resolvedMenuItems,
    });

    const { context } = await this.contextBuilder.buildContext({
      userId,
      userMessage: trimmed,
      classification,
      conversationState,
    });

    const reply = await this.responseGenerator.generateResponse(context);

    this.conversationStages.finalizeTurn(userId, reply);

    let savedFacts: OrchestrationResult["savedFacts"] = [];
    const postTrace = createToolExecutionTrace();

    const saveTurn: ToolTurnContext = {
      userId,
      userMessage: trimmed,
      classification,
      safeMode,
      trace: postTrace,
    };

    const memoryResult = await this.toolExecutor.saveUserFact(saveTurn);
    if (memoryResult) {
      savedFacts = memoryResult.savedFacts;
    }

    const toolsInvoked = [
      ...menuTrace.list(),
      ...context.toolsInvoked,
      ...postTrace.list(),
    ];
    context.toolsInvoked = toolsInvoked;

    const assistantMessage = this.messageRepository.create(
      userId,
      "assistant",
      reply,
    );

    const retrievedDocs = uniqueRetrievedSources(context.ragResults);
    const savedFactTexts = savedFacts.map((fact) => fact.fact);

    const log = this.orchestrationLogs.create({
      userId,
      messageId: userMessage.id,
      intent: classification.intent,
      needsRag: classification.needsRag,
      needsUserFacts: classification.needsUserFacts,
      shouldExtractFacts: classification.shouldExtractFacts,
      retrievedDocs,
      savedFacts: savedFactTexts,
      riskLevel: classification.riskLevel,
    });

    const user = this.userRepository.findById(userId);
    const userLogin = user?.loginName ?? userId;

    const debug = buildOrchestrationDebugSnapshot({
      userLogin,
      classification,
      context,
      retrievedDocs,
      savedFacts,
      toolsInvoked,
      conversationState: context.conversationState,
    });

    return {
      reply,
      classification,
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      logId: log.id,
      ragUsed: retrievedDocs.length > 0,
      retrievedDocs,
      savedFacts,
      savedFactsCount: savedFacts.length,
      debug,
    };
  }
}
