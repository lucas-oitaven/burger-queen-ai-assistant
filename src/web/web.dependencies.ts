import type Database from "better-sqlite3";
import { getDatabase } from "../database/sqlite.js";
import { OrchestratorService } from "../modules/chat/orchestrator.service.js";
import { MemoryService } from "../modules/memory/memory.service.js";
import { UserRepository } from "../modules/users/user.repository.js";

export type WebAppDependencies = {
  userRepository: UserRepository;
  orchestrator: OrchestratorService;
  memoryService: MemoryService;
};

export function createDefaultWebDependencies(
  db: Database.Database = getDatabase(),
): WebAppDependencies {
  return {
    userRepository: new UserRepository(db),
    orchestrator: OrchestratorService.fromDatabase(db),
    memoryService: MemoryService.fromDatabase(db),
  };
}
