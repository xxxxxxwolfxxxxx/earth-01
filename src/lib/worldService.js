import { supabase } from './supabase'

export async function fetchWorldSnapshot() {
  const [stateRes, tilesRes, agentsRes, eventsRes, techRes, alliancesRes] = await Promise.all([
    supabase.from('world_state').select('*').single(),
    supabase.from('world_tiles').select('tiles').single(),
    supabase.from('agents').select('*').eq('alive', true),
    supabase.from('world_events').select('*').order('tick', { ascending: false }).limit(20),
    supabase.from('world_tech').select('*').single(),
    supabase.from('alliances').select('*'),
  ])

  return {
    worldState: stateRes.data,
    tiles: tilesRes.data?.tiles ?? '',
    agents: agentsRes.data ?? [],
    events: eventsRes.data ?? [],
    tech: techRes.data ?? { researched: [], current_research: null, research_points: 0 },
    alliances: alliancesRes.data ?? [],
    error: stateRes.error || tilesRes.error || agentsRes.error || eventsRes.error,
  }
}

let channelCounter = 0

export function subscribeToWorld(onWorldState, onTiles, onAgents, onEvents, onTech, onAlliances) {
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

  if (onTech) {
    channels.push(
      supabase
        .channel(`world-tech-${id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'world_tech' }, (payload) => {
          onTech(payload.new)
        })
        .subscribe()
    )
  }

  if (onAlliances) {
    channels.push(
      supabase
        .channel(`world-alliances-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alliances' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            onAlliances((prev) => [...prev, payload.new])
          } else if (payload.eventType === 'DELETE') {
            onAlliances((prev) => prev.filter((a) => a.id !== payload.old.id))
          } else {
            onAlliances((prev) => prev.map((a) => (a.id === payload.new.id ? payload.new : a)))
          }
        })
        .subscribe()
    )
  }

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

  if ((existing.count ?? 0) >= 1) {
    throw new Error('Maximal 1 lebender Agent pro Spieler')
  }

  const gridSize = 60
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

  // Dynasty-Daten + Achievement-Count laden für max_age und display_name
  const { data: profileNow } = await supabase
    .from('profiles')
    .select('main_agent_id, dynasty_name, dynasty_generation')
    .eq('id', user.id)
    .single()

  const { count: achCount } = await supabase
    .from('dynasty_achievements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Gleiche Formel wie computeMaxAge im _shared/dynasty.ts
  const jitter = Math.floor((Math.random() - 0.5) * 400)
  const computedMaxAge = 2400 + (achCount ?? 0) * 800 + jitter

  const displayName = profileNow?.dynasty_name
    ? `${profileNow.dynasty_name} ${String(profileNow.dynasty_generation ?? 1).padStart(2, '0')}`
    : data.name

  await supabase
    .from('agents')
    .update({ max_age: computedMaxAge, display_name: displayName })
    .eq('id', data.id)

  if (!profileNow?.main_agent_id) {
    await supabase
      .from('profiles')
      .update({ main_agent_id: data.id })
      .eq('id', user.id)
  }

  // data im Speicher mit den neuen Feldern syncen für caller
  data.max_age = computedMaxAge
  data.display_name = displayName

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

export async function setMoveTarget(agentId, x, y) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('agents')
    .update({ move_target_x: x, move_target_y: y })
    .eq('id', agentId)
    .eq('owner_id', user.id)

  if (error) throw error
}

export async function clearMoveTarget(agentId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('agents')
    .update({ move_target_x: null, move_target_y: null })
    .eq('id', agentId)
    .eq('owner_id', user.id)

  if (error) throw error
}

export async function renameAgent(agentId, newName) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('agents')
    .update({ name: newName.trim() })
    .eq('id', agentId)
    .eq('owner_id', user.id)

  if (error) throw error
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

// --- LLM Config (server-side for Telegram) ---

export async function saveLLMToProfile({ apiKey, baseUrl, model }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('profiles')
    .update({
      llm_api_key: apiKey || null,
      llm_base_url: baseUrl || null,
      llm_model: model || null,
    })
    .eq('id', user.id)

  if (error) throw error
}

export async function fetchLLMFromProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('llm_api_key, llm_base_url, llm_model')
    .eq('id', user.id)
    .single()

  if (!data || !data.llm_api_key) return null
  return {
    apiKey: data.llm_api_key,
    baseUrl: data.llm_base_url,
    model: data.llm_model,
  }
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

// --- Dynasty & Achievements ---

export async function setDynasty({ name, emoji }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const trimmed = (name ?? '').trim()
  if (trimmed.length < 2 || trimmed.length > 20) {
    throw new Error('Dynastie-Name muss 2-20 Zeichen lang sein')
  }
  if (!emoji || emoji.length === 0) {
    throw new Error('Bitte ein Emoji wählen')
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      dynasty_name: trimmed,
      dynasty_emoji: emoji,
      dynasty_generation: 1,
      dynasty_started_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) throw error
}

export async function fetchDynastyState() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('main_agent_id, dynasty_name, dynasty_emoji, dynasty_generation, dynasty_started_at')
    .eq('id', user.id)
    .single()

  if (!data) return null
  return {
    mainAgentId: data.main_agent_id,
    name: data.dynasty_name,
    emoji: data.dynasty_emoji,
    generation: data.dynasty_generation,
    startedAt: data.dynasty_started_at,
  }
}

export async function fetchAchievementsCatalog() {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchUnlockedAchievements() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('dynasty_achievements')
    .select('achievement_id, unlocked_at, unlocked_by_agent_id')
    .eq('user_id', user.id)

  if (error) throw error
  return data ?? []
}

export async function setMainAgent(agentId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('profiles')
    .update({ main_agent_id: agentId })
    .eq('id', user.id)

  if (error) throw error
}
