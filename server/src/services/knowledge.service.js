// The knowledge base previously used OpenAI embeddings for vector RAG. The bot
// now runs ENTIRELY on Claude (which has no embeddings API), so RAG is retired.
// The bot answers from its prompt modules (prompts/*.md), which already hold the
// FAQ, prices, hours, links and policies.
//
// searchKnowledge is kept as a no-op so the chat flow stays unchanged — it simply
// returns no retrieved chunks, and the system prompt notes "none matched".
export async function searchKnowledge() {
  return []
}
