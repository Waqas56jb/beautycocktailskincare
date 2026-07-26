import OpenAI from 'openai'
import { config } from '../config/env.js'

// NOT the chatbot's LLM — the bot runs on Claude (see lib/anthropic.js).
// This client exists only for knowledge-base embeddings, which Anthropic does
// not offer. It is OPTIONAL: with no key we export null, RAG stays off, and the
// bot answers from its prompt modules. Constructing OpenAI with an empty key
// throws, so this must stay guarded or the whole app fails to boot.
//
// Guard against a common misconfig: an ANTHROPIC key (sk-ant-…) pasted into
// OPENAI_API_KEY. Using it against OpenAI 401s on every message. A real OpenAI
// key is "sk-…" but never "sk-ant-…" — so ignore Anthropic keys and keep RAG off
// cleanly instead of firing a failing request per message.
const openaiKey = config.openai.apiKey
const looksLikeOpenAiKey = openaiKey.startsWith('sk-') && !openaiKey.startsWith('sk-ant-')
if (openaiKey && !looksLikeOpenAiKey) {
  console.warn('OPENAI_API_KEY does not look like an OpenAI key (got an Anthropic key?) — RAG stays off.')
}
export const openai = looksLikeOpenAiKey ? new OpenAI({ apiKey: openaiKey }) : null
