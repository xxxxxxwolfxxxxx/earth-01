import { useEffect, useState } from 'react'
import { RefreshCw, BarChart3 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function QuotaWidget() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht angemeldet')
      const url = import.meta.env.VITE_SUPABASE_URL
      const r = await fetch(`${url}/functions/v1/quota-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setData(j)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (!data && !loading && !error) return null
  const providers = data?.providers ?? []

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-white font-bold text-base flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-400" /> Free-Tier-Status
        </h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded transition disabled:opacity-50"
          title="Neu laden"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="text-xs text-red-300 bg-red-500/10 rounded p-2">{error}</div>}

      {loading && !data && <div className="text-xs text-gray-400">Frage Provider live ab…</div>}

      {providers.length === 0 && !loading && !error && (
        <div className="text-xs text-gray-400">Noch keine Provider-Keys hinterlegt.</div>
      )}

      <div className="space-y-2">
        {providers.map(p => <QuotaRow key={p.id} item={p} />)}
      </div>

      {data && (
        <div className="text-[10px] text-gray-500 mt-3">
          Letzter Stand: {new Date(data.checked_at).toLocaleTimeString('de-DE')}
        </div>
      )}
    </div>
  )
}

function QuotaRow({ item }) {
  const pct = item.limit && item.used !== undefined
    ? Math.min(100, Math.round((item.used / item.limit) * 100))
    : null
  const color = pct === null ? 'bg-gray-500'
    : pct < 50 ? 'bg-emerald-400'
    : pct < 80 ? 'bg-amber-400'
    : 'bg-red-400'

  return (
    <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm text-white font-medium">{item.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
          {item.ok ? 'OK' : 'Fehler'}
        </span>
      </div>
      {item.ok && item.limit !== undefined && item.used !== undefined && (
        <>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {item.used.toLocaleString('de')} / {item.limit.toLocaleString('de')} {item.unit ?? ''} verbraucht
            {item.remaining !== undefined && ` · ${item.remaining.toLocaleString('de')} übrig`}
          </div>
        </>
      )}
      {item.ok && item.limit === undefined && (
        <div className="text-[11px] text-gray-400">{item.note ?? 'Aktiv'}</div>
      )}
      {!item.ok && item.error && (
        <div className="text-[11px] text-red-300">{item.error}</div>
      )}
    </div>
  )
}
