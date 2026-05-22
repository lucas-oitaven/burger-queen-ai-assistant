import type { Intent, IntentClassification, RiskLevel } from "./intent.types.js";

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(?:suas\s+)?instru/i,
  /instru[çc][õo]es\s+anteriores/i,
  /alterar\s+(?:as\s+)?regras/i,
  /mudar\s+(?:as\s+)?regras/i,
  /desconto\s+vital[íi]cio/i,
  /\b(?:sou|finja\s+que\s+sou)\s+admin/i,
  /administrador\s+do\s+sistema/i,
  /finja\s+que\b/i,
  /delete\s+todos/i,
  /apague\s+todos/i,
  /todos\s+os\s+(?:lanches|burgers?|hamb[uú]rgueres?)\s+(?:s[ãa]o\s+)?gr[aá]tis/i,
  /de\s+gra[çc]a\s+para\s+(?:o\s+)?usu[aá]rio/i,
  /mem[oó]ria\s+de\s+outro\s+usu[aá]rio/i,
  /mostre\s+a\s+mem[oó]ria/i,
  /privil[eé]gio/i,
  /prompt\s+injection/i,
  /\bsystem\s+prompt\b/i,
];

const GREETING_PATTERN =
  /^(?:oi|ola|olá|eae|e ai|e aí|bom dia|boa tarde|boa noite|hey|hello|hi)(?:[!.,?\s]|$)/;

const CASUAL_CHAT_PATTERN =
  /^(?:obrigad[oa]|valeu|thanks|thank you|legal|show|perfeito|ok|okay|blz|beleza)(?:[!.,?\s]|$)/;

const MENU_INQUIRY_PATTERN =
  /\b(card[aá]pio|menu|op[çc][õo]es|vegano?s?|vegetariano?s?|al[eé]rgen|alergia|pre[çc]o|burger|hamb[uú]rguer|combo|molho|bacon|lactose|gl[uú]ten|acompanhamento|bebida|promo[çc][ãa]o)\b/;

const HOURS_DELIVERY_PATTERN =
  /\b(hor[aá]rio|funcionamento|abre|abrem|fecha|fecham|entrega|delivery|retirada|endere[çc]o|telefone|reserva)\b/;

const PERSONALIZED_RECOMMENDATION_PATTERN =
  /\b(?:o\s+que\s+(?:você\s+)?me\s+(?:recomenda|sugere)|me\s+(?:recomenda|sugere)|recomenda[çc][ãa]o\s+para\s+mim|para\s+mim\s+hoje|n[aã]o\s+sei\s+o\s+que\s+comer)\b/;

const GENERAL_RECOMMENDATION_PATTERN = /\brecomenda/;

const PREFERENCE_STATEMENT_PATTERN =
  /\b(?:n[aã]o\s+gosto|gosto\s+de|prefiro|evito|alergi|intoleran|n[aã]o\s+como|sou\s+(?:vegetar|vegan|al[eé]rg|intoleran)|sem\s+(?:bacon|lactose|gl[uú]ten|queijo))\b/;

const MEMORY_RECALL_PATTERN =
  /\b(?:o\s+que\s+(?:você\s+)?sabe|minhas?\s+prefer[eê]ncias|sobre\s+mim|o\s+que\s+(?:você\s+)?lembra|minha\s+restri[çc][ãa]o)\b/;

/** Heurística compartilhada (fallback, prompt do assistente, orquestração). */
export function looksLikePreferenceStatement(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) {
    return false;
  }
  return PREFERENCE_STATEMENT_PATTERN.test(text);
}

function normalizeForMatch(message: string): string {
  return message
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function buildClassification(
  intent: Intent,
  flags: {
    needsRag: boolean;
    needsUserFacts: boolean;
    shouldExtractFacts: boolean;
  },
  riskLevel: RiskLevel,
  reason: string,
): IntentClassification {
  return {
    intent,
    needsRag: flags.needsRag,
    needsUserFacts: flags.needsUserFacts,
    shouldExtractFacts: flags.shouldExtractFacts,
    riskLevel,
    reason,
  };
}

/**
 * Classificação determinística quando o LLM falha ou retorna JSON inválido.
 * Ordem das regras importa (injection → saudação → … → default).
 */
export function classifyIntentFallback(message: string): IntentClassification {
  const text = normalizeForMatch(message);

  if (!text) {
    return buildClassification(
      "unknown",
      { needsRag: false, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Mensagem vazia; sem ação de RAG ou memória.",
    );
  }

  if (matchesAnyPattern(text, INJECTION_PATTERNS)) {
    return buildClassification(
      "prompt_injection",
      { needsRag: false, needsUserFacts: false, shouldExtractFacts: false },
      "high",
      "Padrão de prompt injection ou privilégio detectado (fallback).",
    );
  }

  if (text.length <= 40 && GREETING_PATTERN.test(text)) {
    return buildClassification(
      "greeting",
      { needsRag: false, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Saudação curta (fallback).",
    );
  }

  if (text.length <= 50 && CASUAL_CHAT_PATTERN.test(text)) {
    return buildClassification(
      "casual_chat",
      { needsRag: false, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Conversa casual ou agradecimento (fallback).",
    );
  }

  if (MEMORY_RECALL_PATTERN.test(text)) {
    return buildClassification(
      "memory_recall",
      { needsRag: false, needsUserFacts: true, shouldExtractFacts: false },
      "low",
      "Usuário pergunta o que o sistema sabe sobre ele (fallback).",
    );
  }

  if (PERSONALIZED_RECOMMENDATION_PATTERN.test(text)) {
    return buildClassification(
      "personalized_recommendation",
      { needsRag: true, needsUserFacts: true, shouldExtractFacts: false },
      "low",
      "Recomendação personalizada; usa RAG e fatos salvos, sem extrair agora (fallback).",
    );
  }

  if (PREFERENCE_STATEMENT_PATTERN.test(text)) {
    return buildClassification(
      "user_preference_statement",
      { needsRag: false, needsUserFacts: true, shouldExtractFacts: true },
      "low",
      "Usuário declara preferência ou restrição estável (fallback).",
    );
  }

  if (MENU_INQUIRY_PATTERN.test(text)) {
    return buildClassification(
      "menu_inquiry",
      { needsRag: true, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Pergunta sobre cardápio, opções ou produtos (fallback).",
    );
  }

  if (HOURS_DELIVERY_PATTERN.test(text)) {
    return buildClassification(
      "hours_delivery_policy",
      { needsRag: true, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Pergunta sobre horário, entrega ou operação (fallback).",
    );
  }

  if (GENERAL_RECOMMENDATION_PATTERN.test(text)) {
    return buildClassification(
      "general_recommendation",
      { needsRag: true, needsUserFacts: false, shouldExtractFacts: false },
      "low",
      "Recomendação geral sobre o cardápio (fallback).",
    );
  }

  return buildClassification(
    "unknown",
    { needsRag: false, needsUserFacts: false, shouldExtractFacts: false },
    "low",
    "Intenção não reconhecida pelo fallback determinístico.",
  );
}
