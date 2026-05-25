/**
 * Explicit orchestration tools (Issue #16 — PDF req 5).
 * Schemas describe the LLM-facing contract; execution stays in ToolExecutorService.
 */

export const ORCHESTRATION_TOOL_NAMES = [
  "search_knowledge_base",
  "get_user_facts",
  "save_user_fact",
  "get_recent_messages",
  "resolve_menu_items",
] as const;

export type OrchestrationToolName = (typeof ORCHESTRATION_TOOL_NAMES)[number];

export type ToolInvocationRecord = {
  tool: OrchestrationToolName;
  invoked: boolean;
  reason?: string;
};

/** OpenAI-compatible tool definitions (documentation + future agent loop). */
export const ORCHESTRATION_TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge_base",
      description:
        "Search the Burger Queen private knowledge base (menu, policies, hours).",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural language search query",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_user_facts",
      description:
        "Load curated long-term facts about the current user (preferences, restrictions).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_user_fact",
      description:
        "Extract and persist stable user facts from a message (validated server-side).",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "User message to extract facts from",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resolve_menu_items",
      description:
        "Search the knowledge base for menu items and prices mentioned in the user message (order draft).",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "User message describing desired menu items",
          },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_recent_messages",
      description:
        "Load recent short-term conversation messages for the current user.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max messages to retrieve (server caps apply)",
          },
        },
      },
    },
  },
] as const;

export class ToolExecutionTrace {
  private readonly invocations: ToolInvocationRecord[] = [];

  recordInvoked(tool: OrchestrationToolName): void {
    this.invocations.push({ tool, invoked: true });
  }

  recordSkipped(tool: OrchestrationToolName, reason: string): void {
    this.invocations.push({ tool, invoked: false, reason });
  }

  list(): ToolInvocationRecord[] {
    return [...this.invocations];
  }
}

export function createToolExecutionTrace(): ToolExecutionTrace {
  return new ToolExecutionTrace();
}

/** Hybrid mode: intent classifier routes; backend invokes tools deterministically. */
export const ORCHESTRATION_MODE = "hybrid_intent_and_tools" as const;
