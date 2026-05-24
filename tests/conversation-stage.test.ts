import { describe, expect, it } from "vitest";
import { advanceConversationStage } from "../src/modules/chat/conversation-stage.detector.js";
import {
  createInitialConversationState,
  type ConversationState,
} from "../src/modules/chat/conversation-stage.types.js";
import { classifyIntentFallback } from "../src/modules/llm/intent-fallback.classifier.js";

function state(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialConversationState("user-test"),
    ...overrides,
  };
}

describe("advanceConversationStage", () => {
  it("moves from greeting to recommending on suggestion request", () => {
    const result = advanceConversationStage({
      state: state(),
      userMessage: "quero uma sugestão",
      classification: classifyIntentFallback("quero uma sugestão"),
    });

    expect(result.stage).toBe("recommending");
  });

  it("adds selected item to draft during building_order", () => {
    const result = advanceConversationStage({
      state: state({
        stage: "recommending",
        lastSuggestedItems: ["Caprese Veg", "Grão Nobre"],
      }),
      userMessage: "seria o caprese veg",
      classification: classifyIntentFallback("seria o caprese veg"),
    });

    expect(result.stage).toBe("building_order");
    expect(result.draftOrder).toEqual([
      { name: "Caprese Veg", quantity: 1 },
    ]);
  });

  it("moves to confirming on finalize and closed on confirmation", () => {
    const confirming = advanceConversationStage({
      state: state({
        stage: "building_order",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
      }),
      userMessage: "seria só isso",
      classification: classifyIntentFallback("seria só isso"),
    });

    expect(confirming.stage).toBe("confirming");

    const closed = advanceConversationStage({
      state: state({
        stage: "confirming",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
      }),
      userMessage: "ta tudo certo, pode confirmar",
      classification: classifyIntentFallback("ta tudo certo, pode confirmar"),
    });

    expect(closed.stage).toBe("closed");
    expect(closed.completedOrdersCount).toBe(1);
  });

  it("starts a new order cycle after closed without losing completed count", () => {
    const result = advanceConversationStage({
      state: state({
        stage: "closed",
        draftOrder: [{ name: "Caprese Veg", quantity: 1 }],
        lastSuggestedItems: ["Caprese Veg"],
        completedOrdersCount: 1,
      }),
      userMessage: "quero fazer outro pedido",
      classification: classifyIntentFallback("quero fazer outro pedido"),
    });

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

    const recommending = advanceConversationStage({
      state: afterFirst,
      userMessage: "quero uma sugestão",
      classification: classifyIntentFallback("quero uma sugestão"),
    });
    expect(recommending.stage).toBe("recommending");
    expect(recommending.completedOrdersCount).toBe(1);

    const building = advanceConversationStage({
      state: { ...afterFirst, stage: recommending.stage },
      userMessage: "quero o grão nobre",
      classification: classifyIntentFallback("quero o grão nobre"),
    });
    expect(building.stage).toBe("building_order");
    expect(building.draftOrder[0]?.name).toBe("Grão Nobre");
  });
});
