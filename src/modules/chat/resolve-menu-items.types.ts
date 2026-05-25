/** Item do cardápio resolvido via KB (RAG). */
export type ResolvedMenuItem = {
  name: string;
  priceHint?: string;
  source?: string;
};
