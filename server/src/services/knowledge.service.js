import { openai } from '../lib/openai.js'
import { supabase } from '../lib/supabase.js'
import { config } from '../config/env.js'

export async function embed(text) {
  const res = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text,
  })
  return res.data[0].embedding
}

// RAG lookup. Returns [] gracefully if the KB is empty or anything fails, so the
// chat flow never breaks just because knowledge isn't loaded yet.
export async function searchKnowledge(query, { matchCount = 5, threshold = 0.2 } = {}) {
  try {
    const embedding = await embed(query)
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_count: matchCount,
      similarity_threshold: threshold,
    })
    if (error) throw error
    return data || []
  } catch (err) {
    console.warn('searchKnowledge failed (continuing without RAG):', err.message)
    return []
  }
}

// Insert a knowledge chunk with its embedding (used by an ingestion script/admin).
export async function addKnowledge({ source = 'note', title, content, metadata = {} }) {
  const embedding = await embed(content)
  const { data, error } = await supabase
    .from('knowledge_base')
    .insert({ source, title, content, embedding, metadata })
    .select('id')
    .single()
  if (error) throw error
  return data
}
