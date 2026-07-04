import { supabase } from '../lib/supabase.js'

export async function getConversation(id) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createConversation({ contactId, channel = 'website' }) {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId ?? null, channel })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Map an external channel user (e.g. an Instagram sender IGSID) to a contact +
// conversation, so repeat DMs continue the same thread. Uses custom_fields (no
// schema change needed).
export async function findOrCreateChannelConversation({ channel, externalId }) {
  const key = `${channel}_user_id` // e.g. instagram_user_id

  // 1. find the contact previously linked to this channel user
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .eq(`custom_fields->>${key}`, externalId)
    .limit(1)
  let contactId = contacts?.[0]?.id

  if (!contactId) {
    const { data: c, error } = await supabase
      .from('contacts')
      .insert({ source: channel, custom_fields: { [key]: externalId } })
      .select('id')
      .single()
    if (error) throw error
    contactId = c.id
  }

  // 2. reuse the latest conversation for this contact+channel, else create one
  const { data: convs } = await supabase
    .from('conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .order('last_message_at', { ascending: false })
    .limit(1)
  if (convs?.[0]) return convs[0]

  const { data: conv, error } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId, channel, status: 'open' })
    .select('*')
    .single()
  if (error) throw error
  return conv
}

export async function touchConversation(id, patch = {}) {
  const { error } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), ...patch })
    .eq('id', id)
  if (error) throw error
}

export async function listConversations({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, contacts(name, phone, email, client_type)')
    .order('last_message_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function addMessage(conversationId, role, content, meta = {}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content, meta })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getRecentMessages(conversationId, limit = 20) {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).reverse() // chronological
}
