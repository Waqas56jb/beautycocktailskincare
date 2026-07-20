import OpenAI from 'openai'
import { config } from '../config/env.js'

// NOT the chatbot's LLM — the bot runs on Claude (see lib/anthropic.js).
// This client exists only for knowledge-base embeddings, which Anthropic does
// not offer. It is OPTIONAL: with no key we export null, RAG stays off, and the
// bot answers from its prompt modules. Constructing OpenAI with an empty key
// throws, so this must stay guarded or the whole app fails to boot.
export const openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null
