import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const DEFAULT_PROMPT = "> ";

const HELP_TEXT = `Comandos disponíveis:
- /login <nome>
- /whoami
- /exit`;

type ActiveUser = {
  /** Nome normalizado para comparações futuras (ex.: isolamento por usuário) */
  loginName: string;
  /** Nome exibido no prompt e nas mensagens (ex.: "ana" → "Ana") */
  displayName: string;
};

type CliState = {
  activeUser: ActiveUser | null;
};

function formatDisplayName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function buildPrompt(activeUser: ActiveUser | null): string {
  return activeUser ? `${activeUser.displayName} > ` : DEFAULT_PROMPT;
}

function printHelp(): void {
  console.log(HELP_TEXT);
}

function handleLogin(args: string, state: CliState): void {
  const rawName = args.trim();
  if (!rawName) {
    console.log("Uso: /login <nome>");
    return;
  }

  const displayName = formatDisplayName(rawName);
  state.activeUser = {
    loginName: rawName.toLowerCase(),
    displayName,
  };
  console.log(`Usuário ativo: ${displayName}`);
}

function handleWhoami(state: CliState): void {
  if (!state.activeUser) {
    console.log("Nenhum usuário ativo. Use /login <nome> para entrar.");
    return;
  }
  console.log(`Usuário atual: ${state.activeUser.displayName}`);
}

/**
 * Processa uma linha digitada pelo usuário.
 * @returns `false` quando a aplicação deve encerrar.
 */
function handleLine(line: string, state: CliState): boolean {
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

  if (trimmed.startsWith("/login")) {
    const args = trimmed.slice("/login".length);
    handleLogin(args, state);
    return true;
  }

  if (trimmed.startsWith("/")) {
    const unknownCommand = trimmed.split(/\s+/)[0] ?? trimmed;
    console.log(`Comando desconhecido: ${unknownCommand}. Digite /help.`);
    return true;
  }

  console.log(
    "(O assistente ainda não responde mensagens nesta fase — use os comandos com /.)",
  );
  return true;
}

async function runChatLoop(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const state: CliState = { activeUser: null };

  try {
    let running = true;
    while (running) {
      const line = await rl.question(buildPrompt(state.activeUser));
      running = handleLine(line, state);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  console.log("Burger Queen Assistant");
  console.log("Digite /help para ver os comandos.\n");
  await runChatLoop();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
