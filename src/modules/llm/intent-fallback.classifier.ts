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

const ORDER_FLOW_PATTERN =
  /\b(?:fazer\s+(?:o\s+)?pedido|finalizar(?:\s+o\s+pedido)?|confirmar(?:\s+o\s+pedido)?|quero\s+pedir|pode\s+confirmar|t[aá]\s+tudo\s+certo|seria\s+(?:o|a|s[oó])|s[oó]\s+isso|seria\s+s[oó]\s+isso)\b/;

const ORDER_START_PATTERN =
  /\b(?:quero\s+(?:fazer\s+)?(?:o\s+)?pedido|fazer\s+(?:o\s+)?pedido|quero\s+pedir)\b/;

const ORDER_FINALIZE_PATTERN =
  /\b(?:pode\s+finalizar(?:\s+o\s+pedido)?|finalizar(?:\s+o\s+pedido)?|s[oó]\s+isso|seria\s+s[oó]\s+isso)\b/;

const ORDER_CONFIRM_PATTERN =
  /\b(?:pode\s+confirmar|confirmar(?:\s+o\s+pedido)?|t[aá]\s+tudo\s+certo|est[aá]\s+tudo\s+certo|sim|confirmo|isso\s+mesmo|fechado|fechar\s+pedido)\b/;

const SHORT_AFFIRMATION_PATTERN =
  /^(?:pode|sim|ok|okay|blz|beleza|certo|isso|fechou)\.?$/;

const NEW_ORDER_REQUEST_PATTERN =
  /\b(?:outro\s+pedido|novo\s+pedido|mais\s+um\s+pedido|pedir\s+(?:de\s+)?novo|quero\s+pedir\s+(?:outra|mais|de\s+novo)|fazer\s+(?:outro|um\s+novo)\s+pedido)\b/;

const RECOMMENDATION_REQUEST_PATTERN =
  /\b(?:queria\s+(?:algo|uma)|quero\s+(?:algo|uma\s+(?:recomenda|sugest\w*)|uma\s+sugest\w*)|algo\s+mais\s+\w+|recomenda[çc][ãa]o\s+mais|sugest[ãa]o\s+mais)\b/;

/** Heurística compartilhada (fallback, prompt do assistente, orquestração). */
export function looksLikePreferenceStatement(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) {
    return false;
  }
  return PREFERENCE_STATEMENT_PATTERN.test(text);
}

/** Confirmação ou continuação de pedido — não usar resposta fixa de preferência. */
export function looksLikeOrderFlowMessage(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) {
    return false;
  }
  return ORDER_FLOW_PATTERN.test(text);
}

/** Pedido de sugestão/recomendação — deve ir ao LLM com RAG, não ack de preferência. */
export function looksLikeRecommendationRequest(message: string): boolean {
  const text = normalizeForMatch(message);
  if (!text) {
    return false;
  }
  return RECOMMENDATION_REQUEST_PATTERN.test(text);
}

export function looksLikeOrderStart(message: string): boolean {
  const text = normalizeForMatch(message);
  return Boolean(text && ORDER_START_PATTERN.test(text));
}

export function looksLikeOrderFinalize(message: string): boolean {
  const text = normalizeForMatch(message);
  return Boolean(text && ORDER_FINALIZE_PATTERN.test(text));
}

export function looksLikeOrderConfirmation(message: string): boolean {
  const text = normalizeForMatch(message);
  return Boolean(text && ORDER_CONFIRM_PATTERN.test(text));
}

/** Afirmação curta em etapa de confirmação (ex.: "pode", "sim"). */
export function looksLikeShortAffirmation(message: string): boolean {
  const text = normalizeForMatch(message);
  return Boolean(text && SHORT_AFFIRMATION_PATTERN.test(text));
}

/** Confirma ou finaliza pedido já resumido (etapa confirming). */
export function looksLikeOrderAcceptance(message: string): boolean {
  return (
    looksLikeOrderConfirmation(message) ||
    looksLikeOrderFinalize(message) ||
    looksLikeShortAffirmation(message)
  );
}

/** Após pedido fechado — cliente quer iniciar outro ciclo de compra. */
export function looksLikeNewOrderRequest(message: string): boolean {
  const text = normalizeForMatch(message);
  return Boolean(text && NEW_ORDER_REQUEST_PATTERN.test(text));
}

export function normalizeMessageForMatch(message: string): string {
  return normalizeForMatch(message);
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
      { needsRag: true, needsUserFacts: true, shouldExtractFacts: false },
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
