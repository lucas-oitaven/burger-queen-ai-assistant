import type Database from "better-sqlite3";
import { FactDeduplicatorService } from "./fact-deduplicator.service.js";
import { FactExtractorService } from "./fact-extractor.service.js";
import { FactValidatorService } from "./fact-validator.service.js";
import { MemoryRepository } from "./memory.repository.js";
import type {
  FactExtractorPort,
  ProcessUserMessageResult,
  UserFact,
} from "./memory.types.js";

function emptyProcessResult(): ProcessUserMessageResult {
  return {
    extractedCount: 0,
    validatedCount: 0,
    savedCount: 0,
    rejectedByValidationCount: 0,
    skippedByDedupCount: 0,
    savedFacts: [],
  };
}

export class MemoryService {
  private readonly deduplicator: FactDeduplicatorService;

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly extractor: FactExtractorPort,
    private readonly validator: FactValidatorService = new FactValidatorService(),
    deduplicator?: FactDeduplicatorService,
  ) {
    this.deduplicator =
      deduplicator ?? new FactDeduplicatorService(memoryRepository);
  }

  static fromDatabase(db: Database.Database): MemoryService {
    const repository = new MemoryRepository(db);
    return new MemoryService(repository, new FactExtractorService());
  }

  listActiveFacts(userId: string): UserFact[] {
    return this.memoryRepository.findActiveByUserId(userId);
  }

  /**
   * Pipeline: extrair → validar → deduplicar → persistir fatos ativos.
   * Não grava mensagens no chat nem chama RAG/LLM de resposta.
   */
  async processUserMessage(
    userId: string,
    message: string,
  ): Promise<ProcessUserMessageResult> {
    const trimmed = message.trim();
    if (!trimmed) {
      return emptyProcessResult();
    }

    const extracted = await this.extractor.extractFactsFromMessage(trimmed);
    const { valid, rejected } = this.validator.partition(extracted);
    const { novel, skipped } = this.deduplicator.filterNovel(userId, valid);

    const savedFacts: UserFact[] = [];

    for (const item of novel) {
      const saved = this.memoryRepository.create({
        userId,
        fact: item.candidate.fact,
        normalizedFact: item.normalizedFact,
        category: item.candidate.category,
        confidence: item.candidate.confidence,
        sourceMessage: trimmed,
      });
      savedFacts.push(saved);
    }

    return {
      extractedCount: extracted.length,
      validatedCount: valid.length,
      savedCount: savedFacts.length,
      rejectedByValidationCount: rejected.length,
      skippedByDedupCount: skipped.length,
      savedFacts,
    };
  }
}
