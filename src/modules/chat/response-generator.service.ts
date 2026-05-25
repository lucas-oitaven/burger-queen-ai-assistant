import { ChatOpenAI } from "@langchain/openai";
import { env, requireOpenAiApiKey } from "../../config/env.js";
import {
  EMPTY_USER_MESSAGE_RESPONSE,
  PREFERENCE_ACK_RESPONSE,
  PROMPT_INJECTION_RESPONSE,
  buildAssistantChatMessages,
  formatOrderClosedResponse,
  formatOrderConfirmingResponse,
  isPreferenceTurn,
  type AssistantChatMessage,
} from "./assistant.prompt.js";
import type { ChatContext } from "./chat.types.js";

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
        return "";
      })
      .join("");
  }

  return String(content ?? "");
}

/** Porta LLM injetável (testes sem OpenAI). */
export type ResponseLlmPort = {
  invoke(messages: AssistantChatMessage[]): Promise<string>;
};

export class ResponseGeneratorService {
  private readonly llm: ResponseLlmPort;

  constructor(llm?: ResponseLlmPort) {
    this.llm =
      llm ??
      createDefaultResponseLlm();
  }

  /**
   * Gera texto do assistente a partir do contexto montado (Issue #9.3).
   * Injection / safeMode → resposta fixa, sem LLM.
   */
  async generateResponse(context: ChatContext): Promise<string> {
    if (shouldUseFixedSafeResponse(context)) {
      return PROMPT_INJECTION_RESPONSE;
    }

    if (isPreferenceTurn(context)) {
      return PREFERENCE_ACK_RESPONSE;
    }

    const { stage } = context.conversationState;
    if (stage === "closed") {
      return formatOrderClosedResponse(context);
    }
    if (stage === "confirming") {
      return formatOrderConfirmingResponse(context);
    }

    const userMessage = context.userMessage.trim();
    if (!userMessage) {
      return EMPTY_USER_MESSAGE_RESPONSE;
    }

    const messages = buildAssistantChatMessages({ ...context, userMessage });
    const raw = await this.llm.invoke(messages);
    const trimmed = extractMessageText(raw).trim();

    return trimmed || EMPTY_USER_MESSAGE_RESPONSE;
  }
}

export function shouldUseFixedSafeResponse(context: ChatContext): boolean {
  return (
    context.safeMode ||
    context.classification.riskLevel === "high" ||
    context.classification.intent === "prompt_injection"
  );
}

function createDefaultResponseLlm(): ResponseLlmPort {
  const model = new ChatOpenAI({
    apiKey: requireOpenAiApiKey(),
    model: env.OPENAI_CHAT_MODEL,
    temperature: 0.2,
  });

  return {
    async invoke(messages: AssistantChatMessage[]): Promise<string> {
      const response = await model.invoke(messages);
      return extractMessageText(response.content);
    },
  };
}
