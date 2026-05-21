export type MessageRole = "user" | "assistant" | "system";

export type Message = {
  id: number;
  userId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
};
