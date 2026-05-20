import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Cloud, Unlink, LogIn, CheckCircle2 } from 'lucide-react'
import { fetchCloudStatus, callOauthCloud, setRagSources } from '../lib/cloudService'
import { useAuth } from '../contexts/AuthContext'

const SOURCE_LABELS = {
  note:         { label: 'Notizen',              emoji: '📝' },
  mood:         { label: 'Stimmungen',           emoji: '😊' },
  habit:        { label: 'Gewohnheiten',         emoji: '💪' },
  conversation: { label: 'Gespräche',            emoji: '💬' },
  file:         { label: 'Hochgeladene Dateien', emoji: '📄' },
}

export default function Data() {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [gistPat, setGistPat] = useState('')

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetchCloudStatus().then(s => { setStatus(s); setLoading(false) })
  }, [user])

  if (!authLoading && !user) {
    return (
      <div className="max-w-xl mx-auto px-4 pt-32 pb-16 text-center">
        <h1 className="font-display text-3xl text-white mb-4">Login benötigt</h1>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-nebula-500 text-white rounded-xl no-underline">
          <LogIn className="w-4 h-4" /> Zum Login
        </Link>
      </div>
    )
  }

  async function connectDrive() {
    setBusy(true); setMessage('')
    try {
      const r = await callOauthCloud({ action: 'start_drive', app_origin: window.location.origin })
      window.location.href = r.url
    } catch (e) { setMessage(`Fehler: ${e.message}`); setBusy(false) }
  }

  async function connectGist() {
    if (!gistPat.trim()) return
    setBusy(true); setMessage('')
    try {
      await callOauthCloud({ action: 'connect_gist', pat: gistPat.trim() })
      setStatus(await fetchCloudStatus())
      setGistPat('')
      setMessage('Gist verbunden ✓')
    } catch (e) { setMessage(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  async function disconnect() {
    if (!confirm('Cloud trennen? Dein Klartext in der Cloud bleibt, nur die Verbindung wird gekappt.')) return
    setBusy(true)
    try {
      await callOauthCloud({ action: 'disconnect' })
      setStatus(await fetchCloudStatus())
      setMessage('Cloud getrennt')
    } catch (e) { setMessage(`Fehler: ${e.message}`) }
    setBusy(false)
  }

  async function toggleSource(src) {
    const current = status.rag_sources ?? ['note']
    const next = current.includes(src) ? current.filter(s => s !== src) : [...current, src]
    if (next.length === 0) return
    await setRagSources(next)
    setStatus(s => ({ ...s, rag_sources: next }))
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 pt-24 text-center text-gray-400">Lade…</div>

  const connected = !!status?.cloud_provider

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Database className="w-4 h-4" /> Daten + Erinnerung
        </div>
        <h1 className="font-display text-4xl font-bold text-white">Dein Gedächtnis</h1>
        <p className="text-gray-400 mt-3 text-sm max-w-xl mx-auto">
          Hier verbindest du deine Cloud und wählst, welche deiner Daten der Bot für seine Antworten nutzen darf.
        </p>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 text-blue-200 text-sm text-center">{message}</div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className={`rounded-xl border p-4 ${connected ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-white/5'}`}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Cloud-Status</div>
          <div className="font-display text-xl text-white mt-1">
            {connected ? (status.cloud_provider === 'gdrive' ? '📁 Google Drive' : '🐙 GitHub Gist') : 'Nicht verbunden'}
          </div>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Notizen indiziert</div>
          <div className="font-display text-xl text-blue-300 mt-1">{status?.indexedCount ?? 0}</div>
        </div>
      </div>

      {!connected && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-400" /> Cloud verbinden
          </h2>
          <p className="text-gray-400 text-sm mb-4">Wähl einen Anbieter — du kannst später wechseln.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button onClick={connectDrive} disabled={busy}
              className="px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-white rounded-xl border border-blue-500/30 transition disabled:opacity-50 flex items-center justify-center gap-2">
              📁 Google Drive
            </button>
            <div className="space-y-2">
              <input type="password" value={gistPat} onChange={(e) => setGistPat(e.target.value)}
                placeholder="GitHub PAT mit gist-Scope"
                className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono" />
              <button onClick={connectGist} disabled={busy || !gistPat}
                className="w-full px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-white rounded-lg border border-purple-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                🐙 Gist anlegen
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3">
            PAT erstellen: github.com/settings/tokens → Generate new token (classic) → Scope „gist".
          </p>
        </section>
      )}

      {connected && (
        <section className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
          <h2 className="font-display text-white text-lg font-bold mb-3">Welche Daten sollen indiziert werden?</h2>
          <p className="text-gray-400 text-xs mb-4">Mindestens eine Quelle. Toggle aktiviert nur neue Einträge.</p>
          <div className="space-y-2">
            {Object.entries(SOURCE_LABELS).map(([key, meta]) => {
              const active = (status.rag_sources ?? ['note']).includes(key)
              return (
                <button key={key} onClick={() => toggleSource(key)}
                  className={`w-full p-3 rounded-lg border flex items-center gap-3 transition ${active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                  <span className="text-2xl">{meta.emoji}</span>
                  <span className="flex-1 text-left text-white">{meta.label}</span>
                  {active ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border border-white/20" />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {connected && (
        <section className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <h2 className="font-display text-white text-lg font-bold mb-2">Cloud trennen</h2>
          <p className="text-gray-400 text-sm mb-3">
            Dein Klartext in der Cloud bleibt erhalten. Hier werden nur die Vektor-Einträge entfernt und der Bot verliert den Zugriff.
          </p>
          <button onClick={disconnect} disabled={busy}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg border border-red-500/30 disabled:opacity-50 flex items-center gap-2">
            <Unlink className="w-4 h-4" /> Verbindung trennen
          </button>
        </section>
      )}
    </div>
  )
}
