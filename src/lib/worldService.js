import { supabase } from './supabase'

export async function fetchWorldSnapshot() {
  const [stateRes, tilesRes, agentsRes, eventsRes] = await Promise.all([
    supabase.from('world_state').select('*').single(),
    supabase.from('world_tiles').select('tiles').single(),
    supabase.from('agents').select('*').eq('alive', true),
    supabase.from('world_events').select('*').order('tick', { ascending: false }).limit(20),
  ])

  return {
    worldState: stateRes.data,
    tiles: tilesRes.data?.tiles ?? '',
    agents: agentsRes.data ?? [],
    events: eventsRes.data ?? [],
    error: stateRes.error || tilesRes.error || agentsRes.error || eventsRes.error,
  }
}

let channelCounter = 0

export function subscribeToWorld(onWorldState, onTiles, onAgents, onEvents) {
  const id = ++channelCounter
  const channels = []

  channels.push(
    supabase
      .channel(`world-state-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'world_state' }, (payload) => {
        onWorldState(payload.new)
      })
      .subscribe()
  )

  channels.push(
    supabase
      .channel(`world-tiles-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'world_tiles' }, (payload) => {
        onTiles(payload.new.tiles)
      })
      .subscribe()
  )

  channels.push(
    supabase
      .channel(`world-agents-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, (payload) => {
        onAgents(payload.eventType, payload.new, payload.old)
      })
      .subscribe()
  )

  channels.push(
    supabase
      .channel(`world-events-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'world_events' }, (payload) => {
        onEvents(payload.new)
      })
      .subscribe()
  )

  return () => channels.forEach((ch) => supabase.removeChannel(ch))
}

export async function spawnAgent({ name, personality, x, y }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const existing = await supabase
    .from('agents')
    .select('id', { count: 'exact' })
    .eq('owner_id', user.id)
    .eq('alive', true)

  if ((existing.count ?? 0) >= 2) {
    throw new Error('Maximal 2 lebende Agenten pro Spieler')
  }

  const gridSize = 30
  const safeX = Math.max(0, Math.min(gridSize - 1, x ?? Math.floor(Math.random() * gridSize)))
  const safeY = Math.max(0, Math.min(gridSize - 1, y ?? Math.floor(Math.random() * gridSize)))

  const maxAge = 2000 + Math.floor(Math.random() * 800)

  const { data, error } = await supabase
    .from('agents')
    .insert({
      owner_id: user.id,
      name,
      personality,
      x: safeX,
      y: safeY,
      energy: 80,
      max_age: maxAge,
      generation: 0,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function fetchMyAgents() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function fetchAgentMemory(agentId) {
  const { data } = await supabase
    .from('agent_memory')
    .select('*')
    .eq('agent_id', agentId)
    .order('tick', { ascending: false })
    .limit(30)

  return data ?? []
}

export async function fetchAgentActions(agentId, limit = 50) {
  const { data } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('agent_id', agentId)
    .order('tick', { ascending: false })
    .limit(limit)

  return data ?? []
}

export async function submitAgentSuggestion(agentId, suggestion) {
  const { error } = await supabase
    .from('agents')
    .update({ pending_suggestion: suggestion })
    .eq('id', agentId)

  if (error) throw error
}

// --- Telegram Integration ---

export async function registerTelegram(botToken) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-telegram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ bot_token: botToken }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Verbindung fehlgeschlagen')
  return data
}

export async function unregisterTelegram() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Nicht angemeldet')

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unregister-telegram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Trennung fehlgeschlagen')
  return data
}

export async function fetchTelegramStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('telegram_bot_token, telegram_chat_id, telegram_linked_at')
    .eq('id', user.id)
    .single()

  if (!data || !data.telegram_bot_token) return null

  const token = data.telegram_bot_token
  const masked = token.length > 12
    ? token.slice(0, 5) + '...' + token.slice(-5)
    : '***'

  return {
    connected: true,
    maskedToken: masked,
    chatId: data.telegram_chat_id,
    linkedAt: data.telegram_linked_at,
  }
}

export async function fetchAgentMessages(agentId, limit = 50) {
  const { data } = await supabase
    .from('agent_messages')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []).reverse()
}

export function subscribeToMessages(agentId, onMessage) {
  const id = ++channelCounter
  const channel = supabase
    .channel(`agent-messages-${id}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'agent_messages', filter: `agent_id=eq.${agentId}` },
      (payload) => onMessage(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
