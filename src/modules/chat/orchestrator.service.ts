import type Database from "better-sqlite3";
import { IntentClassifierService } from "../llm/intent-classifier.service.js";
import { MemoryService } from "../memory/memory.service.js";
import { ContextBuilderService } from "./context-builder.service.js";
import { OrchestrationLogRepository } from "./orchestration-log.repository.js";
import type { OrchestrationResult } from "./orchestration.types.js";
import { MessageRepository } from "./message.repository.js";
import { ResponseGeneratorService } from "./response-generator.service.js";

function uniqueRetrievedSources(
  sources: { source: string; sourcePath?: string }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of sources) {
    const key = item.sourcePath ?? item.source;
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
    private readonly intentClassifier: IntentClassifierService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly memoryService: MemoryService,
    private readonly orchestrationLogs: OrchestrationLogRepository,
  ) {}

  static fromDatabase(db: Database.Database): OrchestratorService {
    return new OrchestratorService(
      new MessageRepository(db),
      new IntentClassifierService(),
      ContextBuilderService.fromDatabase(db),
      new ResponseGeneratorService(),
      MemoryService.fromDatabase(db),
      new OrchestrationLogRepository(db),
    );
  }

  /**
   * Pipeline: salvar user → classificar → contexto → resposta → fatos (se flag) → assistant → log.
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

    const context = await this.contextBuilder.buildContext({
      userId,
      userMessage: trimmed,
      classification,
    });

    const reply = await this.responseGenerator.generateResponse(context);

    let savedFacts: OrchestrationResult["savedFacts"] = [];

    if (classification.shouldExtractFacts && trimmed) {
      const memoryResult = await this.memoryService.processUserMessage(
        userId,
        trimmed,
      );
      savedFacts = memoryResult.savedFacts;
    }

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
    };
  }
}
