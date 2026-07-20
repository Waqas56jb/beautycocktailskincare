import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config/env.js'

export const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey })

// Pull the plain text out of a Claude response (content is a block array).
export function textOf(message) {
  return (message?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}
