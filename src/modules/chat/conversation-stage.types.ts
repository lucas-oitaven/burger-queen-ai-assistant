export const CONVERSATION_STAGES = [
  "greeting",
  "exploring",
  "recommending",
  "building_order",
  "confirming",
  "closed",
] as const;

export type ConversationStage = (typeof CONVERSATION_STAGES)[number];

export type OrderDraftItem = {
  name: string;
  source?: string;
  priceHint?: string;
  quantity: number;
};

export type ConversationState = {
  userId: string;
  stage: ConversationStage;
  draftOrder: OrderDraftItem[];
  lastSuggestedItems: string[];
  /** Pedidos já confirmados nesta sessão de atendimento — não bloqueia novos pedidos. */
  completedOrdersCount: number;
  updatedAt: string;
};

export function createInitialConversationState(userId: string): ConversationState {
  return {
    userId,
    stage: "greeting",
    draftOrder: [],
    lastSuggestedItems: [],
    completedOrdersCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function isActiveOrderStage(stage: ConversationStage): boolean {
  return (
    stage === "building_order" ||
    stage === "confirming" ||
    stage === "recommending"
  );
}
