import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { closeDatabase, getDatabase } from "./database/sqlite.js";
import { MessageRepository } from "./modules/chat/message.repository.js";
import { UserRepository } from "./modules/users/user.repository.js";

const DEFAULT_PROMPT = "> ";

const HELP_TEXT = `Comandos disponíveis:
- /login <nome>
- /whoami
- /history
- /exit`;

type ActiveUser = {
  /** UUID — mesmo valor que `users.id` no SQLite */
  id: string;
  displayName: string;
};

type CliDependencies = {
  userRepository: UserRepository;
  messageRepository: MessageRepository;
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

/**
 * Processa uma linha digitada pelo usuário.
 * @returns `false` quando a aplicação deve encerrar.
 */
function handleLine(
  line: string,
  state: CliState,
  deps: CliDependencies,
): boolean {
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

  deps.messageRepository.create(state.activeUser.id, "user", trimmed);
  console.log(
    "(Mensagem salva. O assistente ainda não responde nesta fase — use /history.)",
  );
  return true;
}

async function runChatLoop(deps: CliDependencies): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const state: CliState = { activeUser: null };

  try {
    let running = true;
    while (running) {
      const line = await rl.question(buildPrompt(state.activeUser));
      running = handleLine(line, state, deps);
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
