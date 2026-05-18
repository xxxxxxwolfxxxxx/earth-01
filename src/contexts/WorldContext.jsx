import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchWorldSnapshot, subscribeToWorld } from '../lib/worldService'

const WorldContext = createContext(null)

export function WorldProvider({ children }) {
  const [worldState, setWorldState] = useState(null)
  const [tiles, setTiles] = useState('')
  const [agents, setAgents] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const handleAgentChange = useCallback((eventType, newAgent, oldAgent) => {
    setAgents((prev) => {
      if (eventType === 'INSERT') return [...prev, newAgent]
      if (eventType === 'DELETE') return prev.filter((a) => a.id !== oldAgent.id)
      if (eventType === 'UPDATE') {
        if (!newAgent.alive) return prev.filter((a) => a.id !== newAgent.id)
        return prev.map((a) => (a.id === newAgent.id ? newAgent : a))
      }
      return prev
    })
  }, [])

  const handleNewEvent = useCallback((event) => {
    setEvents((prev) => [event, ...prev].slice(0, 50))
  }, [])

  useEffect(() => {
    let unsubscribe

    async function init() {
      const snapshot = await fetchWorldSnapshot()
      if (snapshot.error) {
        setError(snapshot.error.message)
      } else {
        setWorldState(snapshot.worldState)
        setTiles(snapshot.tiles)
        setAgents(snapshot.agents)
        setEvents(snapshot.events)
      }
      setLoading(false)

      unsubscribe = subscribeToWorld(
        setWorldState,
        setTiles,
        handleAgentChange,
        handleNewEvent,
      )
    }

    init()
    return () => unsubscribe?.()
  }, [handleAgentChange, handleNewEvent])

  return (
    <WorldContext.Provider value={{ worldState, tiles, agents, events, loading, error }}>
      {children}
    </WorldContext.Provider>
  )
}

export function useWorld() {
  const ctx = useContext(WorldContext)
  if (!ctx) throw new Error('useWorld muss innerhalb von WorldProvider verwendet werden')
  return ctx
}
