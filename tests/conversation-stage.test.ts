import { describe, expect, it } from "vitest";
import { advanceConversationStage } from "../src/modules/chat/conversation-stage.detector.js";
import {
  createInitialConversationState,
  type ConversationState,
} from "../src/modules/chat/conversation-stage.types.js";
import type { ResolvedMenuItem } from "../src/modules/chat/resolve-menu-items.types.js";
import { classifyIntentFallback } from "../src/modules/llm/intent-fallback.classifier.js";

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialConversationState("user-test"),
    ...overrides,
  };
}

function turn(
  stateOverride: ConversationState,
  userMessage: string,
  resolvedMenuItems: ResolvedMenuItem[] = [],
) {
  return advanceConversationStage({
    state: stateOverride,
    userMessage,
    classification: classifyIntentFallback(userMessage),
    resolvedMenuItems,
  });
}

describe("advanceConversationStage", () => {
  it("moves from greeting to recommending on suggestion request", () => {
    const result = turn(state(), "quero uma sugestão");
    expect(result.stage).toBe("recommending");
  });

  it("adds selected item to draft during building_order from KB resolve", () => {
    const result = turn(
      state({
        stage: "recommending",
        lastSuggestedItems: ["Caprese Veg", "Grão Nobre"],
      }),
      "seria o caprese veg",
      [{ name: "Caprese Veg", priceHint: "R$ 38" }],
    );

    expect(result.stage).toBe("building_order");
    expect(result.draftOrder).toEqual([
      { name: "Caprese Veg", quantity: 1, priceHint: "R$ 38" },
    ]);
  });

  it("moves to confirming on finalize and closed on confirmation", () => {
    const confirming = turn(
      state({
        stage: "building_order",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
      }),
      "seria só isso",
    );

    expect(confirming.stage).toBe("confirming");

    const closed = turn(
      state({
        stage: "confirming",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
      }),
      "ta tudo certo, pode confirmar",
    );

    expect(closed.stage).toBe("closed");
    expect(closed.completedOrdersCount).toBe(1);
  });

  it("captures Combo Queen Classic and Guaraná from resolved KB items", () => {
    const kb: ResolvedMenuItem[] = [
      { name: "Combo Queen Classic", priceHint: "R$ 58" },
      { name: "Guaraná", priceHint: "R$ 8" },
    ];

    const first = turn(
      state(),
      "quero experimentar o combo queen classic com batata normal e refrigerante",
      kb,
    );

    expect(first.stage).toBe("building_order");
    expect(first.draftOrder.map((i) => i.name)).toContain("Combo Queen Classic");
    expect(first.draftOrder.map((i) => i.name)).not.toContain("Queen Classic");

    const second = turn(
      state({
        stage: first.stage,
        draftOrder: first.draftOrder,
      }),
      "um guaraná",
      kb,
    );

    expect(second.draftOrder.map((i) => i.name)).toContain("Guaraná");
    expect(
      second.draftOrder.find((i) => i.name === "Combo Queen Classic")?.priceHint,
    ).toBe("R$ 58");
  });

  it("closes on second finalize/affirmation from confirming without looping", () => {
    const confirming = turn(
      state({
        stage: "building_order",
        draftOrder: [
          { name: "Combo Queen Classic", quantity: 1, priceHint: "R$ 58" },
          { name: "Guaraná 350 ml", quantity: 1, priceHint: "R$ 8" },
        ],
      }),
      "pode finalizar o pedido",
    );
    expect(confirming.stage).toBe("confirming");

    const closed = turn(
      state({
        stage: "confirming",
        draftOrder: confirming.draftOrder,
      }),
      "pode finalizar o pedido",
    );
    expect(closed.stage).toBe("closed");
    expect(closed.completedOrdersCount).toBe(1);
  });

  it("adds combo from typo message and reaches confirming on seria tudo", () => {
    const kb: ResolvedMenuItem[] = [
      { name: "Combo Veggie Artesanal", priceHint: "R$ 52" },
    ];

    const building = turn(
      state({
        stage: "recommending",
        lastSuggestedItems: ["Combo Veggie Artesanal", "Grão Nobre"],
      }),
      "vou querer pedir o combo veggier artesanal",
      kb,
    );

    expect(building.stage).toBe("building_order");
    expect(building.draftOrder[0]?.name).toBe("Combo Veggie Artesanal");
    expect(building.draftOrder[0]?.priceHint).toBe("R$ 52");

    const confirming = turn(
      state({
        stage: building.stage,
        draftOrder: building.draftOrder,
        lastSuggestedItems: building.lastSuggestedItems,
      }),
      "seria tudo",
    );

    expect(confirming.stage).toBe("confirming");
  });

  it("stays in order flow on combo drink question while confirming", () => {
    const result = turn(
      state({
        stage: "confirming",
        draftOrder: [
          { name: "Combo Veggie Artesanal", quantity: 1, priceHint: "R$ 52" },
        ],
      }),
      "qual bebida inclui no combo?",
    );

    expect(result.stage).toBe("confirming");
    expect(result.draftOrder[0]?.name).toBe("Combo Veggie Artesanal");
  });

  it("leaves confirming on hours question instead of looping", () => {
    const result = turn(
      state({
        stage: "confirming",
        draftOrder: [{ name: "Combo Queen Classic", quantity: 1, priceHint: "R$ 58" }],
      }),
      "qual o horario de funcionamento?",
    );

    expect(result.stage).toBe("greeting");
    expect(result.draftOrder[0]?.name).toBe("Combo Queen Classic");
  });

  it("starts a new order cycle after closed without losing completed count", () => {
    const result = turn(
      state({
        stage: "closed",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
        lastSuggestedItems: ["Caprese Veg"],
        completedOrdersCount: 1,
      }),
      "quero fazer outro pedido",
    );

    expect(result.stage).toBe("building_order");
    expect(result.draftOrder).toEqual([]);
    expect(result.lastSuggestedItems).toEqual([]);
    expect(result.completedOrdersCount).toBe(1);
  });

  it("allows second full cycle after first order closed", () => {
    const afterFirst = state({
      stage: "closed",
      completedOrdersCount: 1,
    });

    const recommending = turn(afterFirst, "quero uma sugestão");
    expect(recommending.stage).toBe("recommending");
    expect(recommending.completedOrdersCount).toBe(1);

    const building = turn(
      { ...afterFirst, stage: recommending.stage },
      "quero o grão nobre",
      [{ name: "Grão Nobre", priceHint: "R$ 36" }],
    );
    expect(building.stage).toBe("building_order");
    expect(building.draftOrder[0]?.name).toBe("Grão Nobre");
  });
});
