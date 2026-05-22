import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closeDatabase, getDatabase } from "./database/sqlite.js";
import { env } from "./config/env.js";
import { MessageRepository } from "./modules/chat/message.repository.js";
import { MemoryService } from "./modules/memory/memory.service.js";
import { UserRepository } from "./modules/users/user.repository.js";

const DEFAULT_PROMPT = "> ";

const HELP_TEXT = `Comandos disponíveis:
- /login <nome>
- /whoami
- /history
- /facts
- /exit

Mensagens normais são salvas e, com OPENAI_API_KEY, podem gerar fatos na memória longa.`;

type ActiveUser = {
  /** UUID — mesmo valor que `users.id` no SQLite */
  id: string;
  displayName: string;
};

type CliDependencies = {
  userRepository: UserRepository;
  messageRepository: MessageRepository;
  memoryService: MemoryService;
};

type CliState = {
  activeUser: ActiveUser | null;
};

function buildPrompt(activeUser: ActiveUser | null): string {
  return activeUser ? `${activeUser.displayName} > ` : DEFAULT_PROMPT;
}

function printHelp(): void {
  console.log(HELP_TEXT);
}

function handleLogin(
  args: string,
  state: CliState,
  deps: CliDependencies,
): void {
  const rawName = args.trim();
  if (!rawName) {
    console.log("Uso: /login <nome>");
    return;
  }

  const user = deps.userRepository.findOrCreateByLoginName(rawName);
  state.activeUser = {
    id: user.id,
    displayName: user.name,
  };
  console.log(`Usuário ativo: ${user.name}`);
}

function handleWhoami(state: CliState): void {
  if (!state.activeUser) {
    console.log("Nenhum usuário ativo. Use /login <nome> para entrar.");
    return;
  }
  console.log(`Usuário atual: ${state.activeUser.displayName}`);
}

function handleHistory(state: CliState, deps: CliDependencies): void {
  if (!state.activeUser) {
    console.log("Nenhum usuário ativo. Use /login <nome> para entrar.");
    return;
  }

  const messages = deps.messageRepository.findByUserId(state.activeUser.id);

  if (messages.length === 0) {
    console.log(
      `Nenhuma mensagem encontrada para ${state.activeUser.displayName}.`,
    );
    return;
  }

  for (const message of messages) {
    console.log(`${message.role}: ${message.content}`);
  }
}

function handleFacts(state: CliState, deps: CliDependencies): void {
  if (!state.activeUser) {
    console.log("Nenhum usuário ativo. Use /login <nome> para entrar.");
    return;
  }

  const facts = deps.memoryService.listActiveFacts(state.activeUser.id);

  if (facts.length === 0) {
    console.log(
      `Nenhum fato salvo para ${state.activeUser.displayName}.`,
    );
    return;
  }

  console.log(`Fatos de ${state.activeUser.displayName}:`);
  for (const fact of facts) {
    const category = fact.category ? ` [${fact.category}]` : "";
    console.log(`- ${fact.fact}${category}`);
  }
}

async function handleUserMessage(
  trimmed: string,
  state: CliState,
  deps: CliDependencies,
): Promise<void> {
  const userId = state.activeUser!.id;

  deps.messageRepository.create(userId, "user", trimmed);

  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return;
  }

  try {
    const result = await deps.memoryService.processUserMessage(
      userId,
      trimmed,
    );

    if (result.savedCount === 1) {
      console.log("Fato salvo.");
    } else if (result.savedCount > 1) {
      console.log(`${result.savedCount} fatos salvos.`);
    }
  } catch {
    console.log(
      "Não foi possível atualizar a memória longa desta mensagem.",
    );
  }
}

/**
 * Processa uma linha digitada pelo usuário.
 * @returns `false` quando a aplicação deve encerrar.
 */
async function handleLine(
  line: string,
  state: CliState,
  deps: CliDependencies,
): Promise<boolean> {
  const trimmed = line.trim();

  if (!trimmed) {
    return true;
  }

  if (trimmed === "/help") {
    printHelp();
    return true;
  }

  if (trimmed === "/exit") {
    console.log("Até logo!");
    return false;
  }

  if (trimmed === "/whoami") {
    handleWhoami(state);
    return true;
  }

  if (trimmed === "/history") {
    handleHistory(state, deps);
    return true;
  }

  if (trimmed === "/facts") {
    handleFacts(state, deps);
    return true;
  }

  if (trimmed.startsWith("/login")) {
    const args = trimmed.slice("/login".length);
    handleLogin(args, state, deps);
    return true;
  }

  if (trimmed.startsWith("/")) {
    const unknownCommand = trimmed.split(/\s+/)[0] ?? trimmed;
    console.log(`Comando desconhecido: ${unknownCommand}. Digite /help.`);
    return true;
  }

  if (!state.activeUser) {
    console.log("Faça /login <nome> antes de enviar mensagens.");
    return true;
  }

  await handleUserMessage(trimmed, state, deps);
  return true;
}

async function runChatLoop(deps: CliDependencies): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const state: CliState = { activeUser: null };

  try {
    let running = true;
    while (running) {
      const line = await rl.question(buildPrompt(state.activeUser));
      running = await handleLine(line, state, deps);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const db = getDatabase();
  const deps: CliDependencies = {
    userRepository: new UserRepository(db),
    messageRepository: new MessageRepository(db),
    memoryService: MemoryService.fromDatabase(db),
  };

  console.log("Burger Queen Assistant");
  console.log("Digite /help para ver os comandos.\n");

  try {
    await runChatLoop(deps);
  } finally {
    closeDatabase();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
