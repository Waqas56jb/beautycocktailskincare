import { supabase } from '../lib/supabase.js'

export async function getContact(id) {
  if (!id) return null
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

// Find an existing contact by phone or email, else create a new lead.
// `visitor` may carry details captured by an ad/campaign before the chat.
export async function findOrCreateContact(visitor = {}) {
  const { phone, email, name, concern, source, campaign } = visitor

  if (phone) {
    const { data } = await supabase.from('contacts').select('*').eq('phone', phone).maybeSingle()
    if (data) return data
  }
  if (email) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .ilike('email', email)
      .maybeSingle()
    if (data) return data
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: name ?? null,
      phone: phone ?? null,
      email: email ?? null,
      concern: concern ?? null,
      source: source ?? 'website',
      campaign: campaign ?? null,
      client_type: 'New Lead',
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateContact(id, patch) {
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function listContacts({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
