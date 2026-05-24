import type { IntentClassification } from "../llm/intent.types.js";
import {
  looksLikeNewOrderRequest,
  looksLikeOrderConfirmation,
  looksLikeOrderFinalize,
  looksLikeOrderStart,
  looksLikePreferenceStatement,
  looksLikeRecommendationRequest,
  normalizeMessageForMatch,
} from "../llm/intent-fallback.classifier.js";
import type {
  ConversationStage,
  ConversationState,
  OrderDraftItem,
} from "./conversation-stage.types.js";

export type StageTransitionInput = {
  state: ConversationState;
  userMessage: string;
  classification: IntentClassification;
};

export type StageTransitionResult = {
  stage: ConversationStage;
  draftOrder: OrderDraftItem[];
  lastSuggestedItems: string[];
  completedOrdersCount: number;
};

const KNOWN_MENU_ITEMS = [
  "Caprese Veg",
  "Grão Nobre",
  "Cogumelo Grill",
  "Cogumelo Defumado",
  "Jack BBQ",
  "Grão Smash Veg",
  "Combo Veggie Artesanal",
  "Combo Vegan Queen",
  "Trufa Nobre",
  "Bacon Blue",
  "Caprese Burger",
];

export function extractSuggestedItemsFromAssistantText(text: string): string[] {
  const items = new Set<string>();

  for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const name = match[1]?.trim();
    if (name) {
      items.add(name);
    }
  }

  for (const known of KNOWN_MENU_ITEMS) {
    if (text.toLowerCase().includes(known.toLowerCase())) {
      items.add(known);
    }
  }

  return [...items];
}

function resetDraftForNewOrder(
  state: ConversationState,
): StageTransitionResult {
  return {
    stage: "greeting",
    draftOrder: [],
    lastSuggestedItems: [],
    completedOrdersCount: state.completedOrdersCount,
  };
}

function startNewOrderCycle(
  state: ConversationState,
  nextStage: ConversationStage,
): StageTransitionResult {
  return {
    stage: nextStage,
    draftOrder: [],
    lastSuggestedItems: [],
    completedOrdersCount: state.completedOrdersCount,
  };
}

function matchItemFromMessage(
  message: string,
  candidates: string[],
): string | null {
  const text = normalizeMessageForMatch(message);
  if (!text) {
    return null;
  }

  for (const item of candidates) {
    const normalizedItem = normalizeMessageForMatch(item);
    if (normalizedItem && text.includes(normalizedItem)) {
      return item;
    }
  }

  for (const known of KNOWN_MENU_ITEMS) {
    const normalizedKnown = normalizeMessageForMatch(known);
    if (normalizedKnown && text.includes(normalizedKnown)) {
      return known;
    }
  }

  return null;
}

function upsertDraftItem(
  draftOrder: OrderDraftItem[],
  name: string,
): OrderDraftItem[] {
  const existing = draftOrder.find(
    (item) => normalizeMessageForMatch(item.name) === normalizeMessageForMatch(name),
  );

  if (existing) {
    return draftOrder.map((item) =>
      item === existing
        ? { ...item, quantity: item.quantity + 1 }
        : item,
    );
  }

  return [...draftOrder, { name, quantity: 1 }];
}

function resolveStageAfterClosed(
  input: StageTransitionInput,
): StageTransitionResult | null {
  const { state, userMessage, classification } = input;

  if (state.stage !== "closed") {
    return null;
  }

  if (looksLikeNewOrderRequest(userMessage)) {
    if (
      looksLikeRecommendationRequest(userMessage) ||
      classification.intent === "personalized_recommendation" ||
      classification.intent === "general_recommendation"
    ) {
      return startNewOrderCycle(state, "recommending");
    }
    return startNewOrderCycle(state, "building_order");
  }

  if (
    looksLikeRecommendationRequest(userMessage) ||
    classification.intent === "personalized_recommendation" ||
    classification.intent === "general_recommendation"
  ) {
    return startNewOrderCycle(state, "recommending");
  }

  if (
    looksLikeOrderStart(userMessage) ||
    classification.intent === "menu_inquiry"
  ) {
    return startNewOrderCycle(state, "building_order");
  }

  if (classification.intent === "greeting") {
    return startNewOrderCycle(state, "greeting");
  }

  if (classification.intent === "hours_delivery_policy") {
    return {
      ...resetDraftForNewOrder(state),
      stage: "greeting",
    };
  }

  return null;
}

/**
 * Transições determinísticas de stage + rascunho de pedido.
 * Em `closed`, sinais de novo pedido reiniciam o ciclo sem apagar `completedOrdersCount`.
 */
export function advanceConversationStage(
  input: StageTransitionInput,
): StageTransitionResult {
  const { state, userMessage, classification } = input;
  let stage = state.stage;
  let draftOrder = [...state.draftOrder];
  let lastSuggestedItems = [...state.lastSuggestedItems];
  let completedOrdersCount = state.completedOrdersCount;

  const afterClosed = resolveStageAfterClosed(input);
  if (afterClosed) {
    return afterClosed;
  }

  if (looksLikeOrderConfirmation(userMessage)) {
    if (stage === "confirming" && draftOrder.length > 0) {
      return {
        stage: "closed",
        draftOrder,
        lastSuggestedItems,
        completedOrdersCount: completedOrdersCount + 1,
      };
    }
  }

  if (looksLikeOrderFinalize(userMessage)) {
    if (draftOrder.length > 0) {
      stage = "confirming";
    } else {
      stage = "building_order";
    }
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (looksLikeOrderStart(userMessage)) {
    stage = "building_order";
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (
    looksLikeRecommendationRequest(userMessage) ||
    classification.intent === "personalized_recommendation" ||
    classification.intent === "general_recommendation"
  ) {
    stage = "recommending";
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (
    looksLikePreferenceStatement(userMessage) ||
    classification.intent === "user_preference_statement"
  ) {
    if (stage === "greeting" || stage === "exploring") {
      stage = "exploring";
    }
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (classification.intent === "greeting") {
    stage = stage === "closed" ? "greeting" : stage === "greeting" ? "greeting" : stage;
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  const itemCandidates = [
    ...lastSuggestedItems,
    ...draftOrder.map((item) => item.name),
  ];
  const selectedItem = matchItemFromMessage(userMessage, itemCandidates);

  if (selectedItem && (stage === "recommending" || stage === "building_order")) {
    draftOrder = upsertDraftItem(draftOrder, selectedItem);
    stage = "building_order";
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (stage === "greeting" && classification.intent === "menu_inquiry") {
    stage = "recommending";
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
}
