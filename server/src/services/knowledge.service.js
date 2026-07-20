import { openai } from '../lib/openai.js'
import { supabase } from '../lib/supabase.js'
import { config } from '../config/env.js'

// Anthropic has NO embeddings API, so vector RAG still needs OpenAI. If that key
// is missing or out of credit we turn RAG off for the process (one warning, no
// repeated failing round-trips) — the bot then answers from its prompt modules.
let ragDisabled = !config.openai.apiKey

export async function embed(text) {
  if (!openai) throw new Error('embeddings unavailable: no OPENAI_API_KEY set')
  const res = await openai.embeddings.create({
    model: config.openai.embeddingModel,
    input: text,
  })
  return res.data[0].embedding
}

// Cache whether the KB has any rows so we don't pay for an embeddings API call
// on every message when there's nothing to search. Refreshed every 60s.
let kbCache = { hasRows: null, at: 0 }
async function knowledgeBaseHasRows() {
  const now = Date.now()
  if (kbCache.hasRows !== null && now - kbCache.at < 60_000) return kbCache.hasRows
  const { count } = await supabase.from('knowledge_base').select('*', { count: 'exact', head: true })
  kbCache = { hasRows: (count || 0) > 0, at: now }
  return kbCache.hasRows
}

// RAG lookup. Returns [] gracefully if the KB is empty or anything fails, so the
// chat flow never breaks just because knowledge isn't loaded yet.
export async function searchKnowledge(query, { matchCount = 5, threshold = 0.2 } = {}) {
  try {
    if (ragDisabled) return []
    // Skip the embeddings round-trip entirely when there's nothing to retrieve.
    if (!(await knowledgeBaseHasRows())) return []
    const embedding = await embed(query)
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_count: matchCount,
      similarity_threshold: threshold,
    })
    if (error) throw error
    return data || []
  } catch (err) {
    ragDisabled = true // stop retrying a failing embeddings key every message
    console.warn('searchKnowledge disabled (continuing without RAG):', err.message)
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
