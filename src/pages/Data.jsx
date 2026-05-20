import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Database, Cloud, Unlink, LogIn, CheckCircle2, Sunrise, Drama, Upload } from 'lucide-react'
import { fetchCloudStatus, callOauthCloud, setRagSources, fetchBriefing, saveBriefing, deleteBriefing, fetchPersona, savePersona, uploadFile, fetchDonateSettings, saveDonateSettings, fetchMyContributions } from '../lib/cloudService'
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

      {connected && <FileUploadSection />}
      <PersonaSection />
      <DonateSection />
      <BriefingSection />

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

function FileUploadSection() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // erlaubt erneuten Upload derselben Datei
    if (!file) return
    if (file.size > 200_000) { setMsg('Datei zu groß (max 200k Zeichen).'); return }
    const allowed = /\.(txt|md|markdown|csv|json|log)$/i
    if (!allowed.test(file.name)) {
      setMsg('Nur Text-Formate: .txt .md .csv .json .log (PDF kommt später).')
      return
    }
    setBusy(true); setMsg(`Lade „${file.name}" hoch…`)
    try {
      await uploadFile(file)
      setMsg(`„${file.name}" indiziert ✓ — der Bot kann jetzt darüber Fragen beantworten.`)
    } catch (err) {
      setMsg(`Fehler: ${err.message}`)
    }
    setBusy(false)
  }

  return (
    <section className="mb-8 p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
      <h2 className="font-display text-white text-lg font-bold mb-3 flex items-center gap-2">
        <Upload className="w-5 h-5 text-cyan-400" /> Datei zum Erinnern
      </h2>
      <p className="text-gray-400 text-sm mb-4">
        Lad ein Textdokument hoch — der Inhalt wird embedded und in deiner Cloud abgelegt.
        Danach kannst du per <code>/frag</code> Fragen dazu stellen.
      </p>

      {msg && <div className="mb-3 text-xs text-cyan-200 bg-cyan-500/10 rounded p-2">{msg}</div>}

      <label className={`block px-4 py-3 rounded-xl border-2 border-dashed text-center cursor-pointer transition ${busy ? 'border-cyan-500/30 bg-cyan-500/10 cursor-wait' : 'border-cyan-500/30 hover:border-cyan-500/60 hover:bg-cyan-500/10'}`}>
        <input type="file" className="hidden" accept=".txt,.md,.markdown,.csv,.json,.log" onChange={onFile} disabled={busy} />
        <Upload className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
        <div className="text-sm text-white">{busy ? 'Wird verarbeitet…' : 'Datei wählen oder hier ablegen'}</div>
        <div className="text-[10px] text-gray-400 mt-1">.txt · .md · .csv · .json · .log · max 200k Zeichen</div>
      </label>
    </section>
  )
}

function PersonaSection() {
  const [p, setP] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchPersona().then(d => {
      setP(d ?? { bot_name: '', bot_role: '', bot_tone: '', bot_extra: '' })
      setLoading(false)
    })
  }, [])

  if (loading) return null

  const has = p.bot_name || p.bot_role || p.bot_tone || p.bot_extra

  const previewLines = []
  if (p.bot_name) previewLines.push(`Du heißt ${p.bot_name}.`)
  if (p.bot_role) previewLines.push(`Du bist ${p.bot_role}.`)
  if (p.bot_tone) previewLines.push(`Antworte ${p.bot_tone}.`)
  if (p.bot_extra) previewLines.push(p.bot_extra)
  previewLines.push('Beantworte die Frage anhand der mitgelieferten Notizen — präzise, auf Deutsch.')

  async function save() {
    setSaving(true); setMsg('')
    try { await savePersona(p); setMsg('Persona gespeichert ✓') }
    catch (e) { setMsg(`Fehler: ${e.message}`) }
    setSaving(false)
  }

  return (
    <section className="mb-8 p-5 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-display text-white text-lg font-bold flex items-center gap-2">
          <Drama className="w-5 h-5 text-fuchsia-400" /> Bot-Persona
        </h2>
        {has && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Aktiv</span>}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Wer ist dein Bot? Wird automatisch in alle LLM-Antworten injiziert (RAG, freier Chat).
      </p>

      {msg && <div className="mb-3 text-xs text-blue-200">{msg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400">Name</label>
          <input type="text" value={p.bot_name ?? ''}
            onChange={(e) => setP(s => ({ ...s, bot_name: e.target.value }))}
            placeholder="z.B. Hermes, Luna, Karl"
            className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400">Rolle</label>
          <input type="text" value={p.bot_role ?? ''}
            onChange={(e) => setP(s => ({ ...s, bot_role: e.target.value }))}
            placeholder="z.B. mein persönlicher Assistent"
            className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
        </div>
      </div>
      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider text-gray-400">Tonalität</label>
        <input type="text" value={p.bot_tone ?? ''}
          onChange={(e) => setP(s => ({ ...s, bot_tone: e.target.value }))}
          placeholder="z.B. freundlich und prägnant, immer mit einem Augenzwinkern"
          className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm" />
      </div>
      <div className="mb-4">
        <label className="text-[10px] uppercase tracking-wider text-gray-400">Extra-Anweisungen (optional)</label>
        <textarea value={p.bot_extra ?? ''}
          onChange={(e) => setP(s => ({ ...s, bot_extra: e.target.value }))}
          placeholder="z.B. Schreibe niemals länger als 3 Sätze. Begrüße mich morgens immer namentlich."
          rows={2}
          className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm resize-none" />
      </div>

      <details className="mb-4">
        <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">System-Prompt-Vorschau</summary>
        <div className="mt-2 text-[11px] text-gray-300 bg-black/30 rounded p-3 font-mono leading-relaxed whitespace-pre-wrap">
          {previewLines.join(' ')}
        </div>
      </details>

      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-100 rounded-lg border border-fuchsia-500/30 disabled:opacity-50 text-sm">
        {saving ? 'Speichere…' : 'Speichern'}
      </button>
    </section>
  )
}

function BriefingSection() {
  const [sub, setSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchBriefing().then(s => {
      setSub(s ?? {
        hour: 8, minute: 0, timezone: 'Europe/Berlin', city: '',
        include_weather: true, include_reminders: true,
        include_mood: true, include_habits: true, active: true,
      })
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    try {
      await saveBriefing(sub)
      setMsg('Briefing gespeichert ✓')
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
    setSaving(false)
  }

  async function remove() {
    if (!confirm('Briefing wirklich deaktivieren?')) return
    await deleteBriefing()
    setSub({ hour: 8, minute: 0, timezone: 'Europe/Berlin', city: '', include_weather: true, include_reminders: true, include_mood: true, include_habits: true, active: false })
    setMsg('Briefing deaktiviert')
  }

  if (loading) return null

  const active = sub.active && sub.user_id
  const flagBtn = (key, label) => (
    <button onClick={() => setSub(s => ({ ...s, [key]: !s[key] }))}
      className={`px-3 py-1.5 rounded-lg border text-xs transition ${sub[key] ? 'bg-amber-500/20 border-amber-500/40 text-amber-100' : 'bg-white/5 border-white/10 text-gray-400'}`}>
      {label}
    </button>
  )

  return (
    <section className="mb-8 p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-display text-white text-lg font-bold flex items-center gap-2">
          <Sunrise className="w-5 h-5 text-amber-400" /> Tägliches Briefing
        </h2>
        {active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Aktiv</span>}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Dein Bot schickt dir jeden Morgen eine Zusammenfassung — Wetter, Erinnerungen, Mood, Habit-Streaks.
      </p>

      {msg && <div className="mb-3 text-xs text-blue-200">{msg}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400">Stunde</label>
          <input type="number" min="0" max="23" value={sub.hour}
            onChange={(e) => setSub(s => ({ ...s, hour: parseInt(e.target.value) || 0 }))}
            className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-2 py-1 text-white text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-gray-400">Minute</label>
          <input type="number" min="0" max="59" step="5" value={sub.minute}
            onChange={(e) => setSub(s => ({ ...s, minute: parseInt(e.target.value) || 0 }))}
            className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-2 py-1 text-white text-sm" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-400">Zeitzone</label>
          <input type="text" value={sub.timezone}
            onChange={(e) => setSub(s => ({ ...s, timezone: e.target.value }))}
            className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-2 py-1 text-white text-sm" placeholder="Europe/Berlin" />
        </div>
      </div>

      <div className="mb-3">
        <label className="text-[10px] uppercase tracking-wider text-gray-400">Stadt fürs Wetter</label>
        <input type="text" value={sub.city ?? ''}
          onChange={(e) => setSub(s => ({ ...s, city: e.target.value }))}
          className="w-full mt-1 bg-cosmos-800 border border-white/10 rounded px-2 py-1 text-white text-sm" placeholder="Hamburg" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {flagBtn('include_weather', '🌤 Wetter')}
        {flagBtn('include_reminders', '📅 Erinnerungen')}
        {flagBtn('include_mood', '😊 Mood-Trend')}
        {flagBtn('include_habits', '💪 Habit-Streaks')}
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-lg border border-amber-500/30 disabled:opacity-50 text-sm">
          {saving ? 'Speichere…' : active ? 'Speichern' : 'Briefing aktivieren'}
        </button>
        {active && (
          <button onClick={remove}
            className="px-4 py-2 bg-white/5 hover:bg-red-500/10 text-gray-300 hover:text-red-300 rounded-lg border border-white/10 text-sm">
            Deaktivieren
          </button>
        )}
      </div>
    </section>
  )
}

function DonateSection() {
  const [s, setS] = useState(null)
  const [contributions, setContributions] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchDonateSettings().then(d => setS(d ?? { donate_tokens: false, donate_threshold: 30, donate_show_credit: false, swarm_jobs_today: 0 }))
    fetchMyContributions().then(setContributions)
  }, [])

  if (!s) return null

  async function save() {
    setSaving(true); setMsg('')
    try { await saveDonateSettings(s); setMsg('Gespeichert ✓') }
    catch (e) { setMsg(`Fehler: ${e.message}`) }
    setSaving(false)
  }

  return (
    <section className="mb-8 p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-display text-white text-lg font-bold flex items-center gap-2">
          🌱 Schwarm-Beitrag
        </h2>
        {s.donate_tokens && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Aktiv</span>}
      </div>
      <p className="text-gray-400 text-sm mb-4">
        Spende dein verbleibendes Tagessommittel kurz vor Provider-Reset.
        Dein Bot trägt zur kollektiven Artikel-Pipeline bei. Max 3 Jobs/Tag.
      </p>
      {msg && <div className="mb-3 text-xs text-blue-200">{msg}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Mein Beitrag</div>
          <div className="font-display text-2xl text-emerald-300 mt-1">{contributions}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Jobs heute</div>
          <div className="font-display text-2xl text-amber-300 mt-1">{s.swarm_jobs_today} / 3</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 col-span-2 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-400">Schwelle</div>
          <div className="font-display text-2xl text-blue-300 mt-1">{s.donate_threshold}%</div>
        </div>
      </div>

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={s.donate_tokens}
          onChange={(e) => setS({...s, donate_tokens: e.target.checked})}
          className="w-4 h-4" />
        <span className="text-sm text-white">Token-Spende aktivieren</span>
      </label>

      <label className="block mb-3">
        <span className="text-xs text-gray-400">Spende-Schwelle: {s.donate_threshold}%</span>
        <input type="range" min="10" max="90" step="5"
          value={s.donate_threshold}
          onChange={(e) => setS({...s, donate_threshold: parseInt(e.target.value)})}
          className="w-full mt-1" />
        <span className="text-[10px] text-gray-500">Spende, wenn mindestens {s.donate_threshold}% des Tageskontingents übrig.</span>
      </label>

      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input type="checkbox" checked={s.donate_show_credit}
          onChange={(e) => setS({...s, donate_show_credit: e.target.checked})}
          className="w-4 h-4" />
        <span className="text-sm text-white">Mit meinem Namen erwähnt werden (statt anonym)</span>
      </label>

      <button onClick={save} disabled={saving}
        className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 rounded-lg border border-emerald-500/30 disabled:opacity-50 text-sm">
        {saving ? 'Speichere…' : 'Speichern'}
      </button>
    </section>
  )
}
