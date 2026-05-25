import type { IntentClassification } from "../llm/intent.types.js";
import {
  looksLikeNewOrderRequest,
  looksLikeOrderAcceptance,
  looksLikeOrderConfirmation,
  looksLikeOrderFinalize,
  looksLikeOrderStart,
  looksLikePreferenceStatement,
  looksLikeRecommendationRequest,
  normalizeMessageForMatch,
} from "../llm/intent-fallback.classifier.js";
import {
  ensureDraftOrderPrices,
  mergeResolvedItemsIntoDraft,
  matchMessageToResolvedMenu,
} from "./resolve-menu-items.service.js";
import type { ResolvedMenuItem } from "./resolve-menu-items.types.js";
import type {
  ConversationStage,
  ConversationState,
  OrderDraftItem,
} from "./conversation-stage.types.js";

export type StageTransitionInput = {
  state: ConversationState;
  userMessage: string;
  classification: IntentClassification;
  resolvedMenuItems: ResolvedMenuItem[];
};

export type StageTransitionResult = {
  stage: ConversationStage;
  draftOrder: OrderDraftItem[];
  lastSuggestedItems: string[];
  completedOrdersCount: number;
};

export function extractSuggestedItemsFromAssistantText(text: string): string[] {
  const items = new Set<string>();

  for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const name = match[1]?.trim();
    if (name) {
      items.add(name);
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

function closeOrder(
  draftOrder: OrderDraftItem[],
  lastSuggestedItems: string[],
  completedOrdersCount: number,
): StageTransitionResult {
  return {
    stage: "closed",
    draftOrder: ensureDraftOrderPrices(draftOrder),
    lastSuggestedItems,
    completedOrdersCount: completedOrdersCount + 1,
  };
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

const ORDER_PAUSE_INTENTS = new Set([
  "hours_delivery_policy",
  "menu_inquiry",
  "greeting",
  "general_recommendation",
  "personalized_recommendation",
]);

function shouldPauseOrderFlow(
  stage: ConversationStage,
  classification: IntentClassification,
  userMessage: string,
): boolean {
  if (stage !== "confirming" && stage !== "building_order") {
    return false;
  }
  if (looksLikeOrderAcceptance(userMessage)) {
    return false;
  }
  return ORDER_PAUSE_INTENTS.has(classification.intent);
}

function pauseOrderFlowStage(
  classification: IntentClassification,
): ConversationStage {
  if (
    classification.intent === "menu_inquiry" ||
    classification.intent === "personalized_recommendation" ||
    classification.intent === "general_recommendation"
  ) {
    return "recommending";
  }
  return "greeting";
}

function applyResolvedMenuItems(
  draftOrder: OrderDraftItem[],
  userMessage: string,
  lastSuggestedItems: string[],
  resolvedMenuItems: ResolvedMenuItem[],
): OrderDraftItem[] {
  let matched = matchMessageToResolvedMenu(userMessage, resolvedMenuItems);

  if (matched.length === 0) {
    for (const name of lastSuggestedItems) {
      const normalized = normalizeMessageForMatch(name);
      const text = normalizeMessageForMatch(userMessage);
      if (normalized && text.includes(normalized)) {
        matched.push({ name });
      }
    }
  }

  if (matched.length === 0) {
    return draftOrder;
  }

  return mergeResolvedItemsIntoDraft(draftOrder, matched);
}

/**
 * Transições determinísticas de stage + rascunho de pedido.
 * Em `closed`, sinais de novo pedido reiniciam o ciclo sem apagar `completedOrdersCount`.
 */
export function advanceConversationStage(
  input: StageTransitionInput,
): StageTransitionResult {
  const { state, userMessage, classification, resolvedMenuItems } = input;
  let stage = state.stage;
  let draftOrder = [...state.draftOrder];
  let lastSuggestedItems = [...state.lastSuggestedItems];
  let completedOrdersCount = state.completedOrdersCount;

  const afterClosed = resolveStageAfterClosed(input);
  if (afterClosed) {
    return afterClosed;
  }

  if (shouldPauseOrderFlow(stage, classification, userMessage)) {
    return {
      stage: pauseOrderFlowStage(classification),
      draftOrder: ensureDraftOrderPrices(draftOrder),
      lastSuggestedItems,
      completedOrdersCount,
    };
  }

  if (stage === "confirming" && draftOrder.length > 0) {
    if (looksLikeOrderAcceptance(userMessage)) {
      return closeOrder(draftOrder, lastSuggestedItems, completedOrdersCount);
    }
    return {
      stage,
      draftOrder: ensureDraftOrderPrices(draftOrder),
      lastSuggestedItems,
      completedOrdersCount,
    };
  }

  if (stage === "confirming" && looksLikeOrderFinalize(userMessage)) {
    return closeOrder(draftOrder, lastSuggestedItems, completedOrdersCount);
  }

  if (looksLikeOrderConfirmation(userMessage)) {
    if (draftOrder.length > 0 && stage === "building_order") {
      return {
        stage: "confirming",
        draftOrder: ensureDraftOrderPrices(draftOrder),
        lastSuggestedItems,
        completedOrdersCount,
      };
    }
  }

  if (looksLikeOrderFinalize(userMessage)) {
    if (draftOrder.length > 0) {
      draftOrder = ensureDraftOrderPrices(draftOrder);
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
    if (stage === "confirming" || stage === "building_order") {
      stage = "greeting";
    } else {
      stage =
        stage === "closed" ? "greeting" : stage === "greeting" ? "greeting" : stage;
    }
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  if (classification.intent === "hours_delivery_policy") {
    if (stage === "confirming" || stage === "building_order") {
      return {
        stage: "greeting",
        draftOrder: ensureDraftOrderPrices(draftOrder),
        lastSuggestedItems,
        completedOrdersCount,
      };
    }
  }

  if (
    stage === "recommending" ||
    stage === "building_order" ||
    stage === "greeting"
  ) {
    const updatedDraft = applyResolvedMenuItems(
      draftOrder,
      userMessage,
      lastSuggestedItems,
      resolvedMenuItems,
    );
    if (updatedDraft.length > draftOrder.length || updatedDraft !== draftOrder) {
      draftOrder = updatedDraft;
      if (stage === "recommending" || stage === "greeting") {
        stage = "building_order";
      }
      return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
    }
  }

  if (stage === "greeting" && classification.intent === "menu_inquiry") {
    stage = "recommending";
    return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
  }

  return { stage, draftOrder, lastSuggestedItems, completedOrdersCount };
}
