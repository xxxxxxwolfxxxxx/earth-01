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
