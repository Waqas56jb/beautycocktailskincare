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
