import { useEffect, useMemo, useState } from 'react'
import { Key, Check, X, ExternalLink, Eye, EyeOff, Trash2, ShieldCheck, Sparkles } from 'lucide-react'
import {
  fetchUserKeys, saveUserKey, testKey, deleteUserKey,
  SERVICE_CATALOG, CATEGORIES,
} from '../lib/keyService'

function mask(key) {
  if (!key) return ''
  if (key.length <= 10) return '••••••'
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export default function Keys() {
  const [keys, setKeys] = useState({})
  const [edits, setEdits] = useState({})
  const [results, setResults] = useState({})
  const [saving, setSaving] = useState({})
  const [reveal, setReveal] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchUserKeys().then(k => { setKeys(k ?? {}); setLoading(false) })
  }, [])

  async function save(field) {
    const val = (edits[field] ?? '').trim()
    if (!val) return
    setSaving(s => ({ ...s, [field]: true }))
    try {
      await saveUserKey(field, val)
      const r = await testKey(field, val)
      setResults(s => ({ ...s, [field]: r }))
      setKeys(k => ({ ...k, [field]: val }))
      setEdits(e => { const n = { ...e }; delete n[field]; return n })
    } catch (e) {
      setResults(s => ({ ...s, [field]: { ok: false, message: e.message }}))
    } finally {
      setSaving(s => ({ ...s, [field]: false }))
    }
  }

  async function remove(field) {
    if (!confirm(`Schlüssel "${field}" wirklich löschen?`)) return
    setSaving(s => ({ ...s, [field]: true }))
    try {
      await deleteUserKey(field)
      setKeys(k => { const n = { ...k }; delete n[field]; return n })
      setResults(s => ({ ...s, [field]: { ok: true, message: 'Gelöscht' }}))
    } finally {
      setSaving(s => ({ ...s, [field]: false }))
    }
  }

  // Stats
  const totalServices = SERVICE_CATALOG.length
  const filledServices = SERVICE_CATALOG.filter(s => keys[s.field]).length
  const grouped = useMemo(() => {
    const m = {}
    for (const cat of CATEGORIES) m[cat.id] = SERVICE_CATALOG.filter(s => s.category === cat.id)
    return m
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Key className="w-4 h-4" /> Schlüssel-Zentrale
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Schlüssel verwalten</h1>
        <p className="text-gray-400 mt-3 text-sm max-w-2xl mx-auto leading-relaxed">
          Alle API-Schlüssel zentral. Was du hier hinterlegst, nutzen die Skills im Tech-Baum.
          Speichern, testen, ändern oder löschen — jederzeit, ohne durch die Übungen zu gehen.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl mx-auto">
        <Stat label="Eingerichtet" value={filledServices} total={totalServices} accent="emerald" />
        <Stat label="Offen" value={totalServices - filledServices} accent="amber" />
        <Stat label="Sicher" value="🔒" accent="purple" sub="RLS" />
      </div>

      {/* Privacy-Notice */}
      <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <strong className="text-blue-300">Deine Schlüssel bleiben bei dir.</strong> Sie werden in deinem
          Profil gespeichert und nur an den jeweiligen Anbieter weitergeleitet — niemand sonst
          (auch wir nicht) liest sie aus. Row-Level-Security schützt sie auf Datenbank-Ebene.
        </div>
      </div>

      {/* Filter-Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} icon="📋">
          Alle ({totalServices})
        </FilterButton>
        {CATEGORIES.map(cat => {
          const count = grouped[cat.id].length
          const filled = grouped[cat.id].filter(s => keys[s.field]).length
          return (
            <FilterButton
              key={cat.id}
              active={filter === cat.id}
              onClick={() => setFilter(cat.id)}
              icon={cat.icon}
            >
              {cat.label} <span className="opacity-60">({filled}/{count})</span>
            </FilterButton>
          )
        })}
      </div>

      {loading && <div className="text-gray-400 text-center py-12">Lade…</div>}

      {/* Kategorien */}
      {!loading && CATEGORIES.map(cat => {
        if (filter !== 'all' && filter !== cat.id) return null
        const services = grouped[cat.id]
        if (services.length === 0) return null
        return (
          <section key={cat.id} className="mb-10">
            <div className="flex items-center gap-3 mb-4 pl-1">
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <h2 className="font-display text-white text-lg font-bold m-0">{cat.label}</h2>
                <p className="text-xs text-gray-500">{cat.desc}</p>
              </div>
            </div>
            <div className="space-y-3">
              {services.map(svc => (
                <ServiceCard
                  key={svc.field}
                  service={svc}
                  currentValue={keys[svc.field] ?? ''}
                  siblingValue={svc.sibling ? keys[svc.sibling.field] ?? '' : null}
                  editValue={edits[svc.field] ?? ''}
                  siblingEditValue={svc.sibling ? edits[svc.sibling.field] ?? '' : null}
                  result={results[svc.field]}
                  saving={!!saving[svc.field]}
                  revealed={!!reveal[svc.field]}
                  onEdit={(v) => setEdits(p => ({ ...p, [svc.field]: v }))}
                  onEditSibling={(v) => svc.sibling && setEdits(p => ({ ...p, [svc.sibling.field]: v }))}
                  onSave={() => save(svc.field)}
                  onSaveSibling={() => svc.sibling && save(svc.sibling.field)}
                  onTest={async () => {
                    const r = await testKey(svc.field, keys[svc.field])
                    setResults(s => ({ ...s, [svc.field]: r }))
                  }}
                  onDelete={() => remove(svc.field)}
                  onToggleReveal={() => setReveal(r => ({ ...r, [svc.field]: !r[svc.field] }))}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Help-Bottom */}
      <div className="mt-12 p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-gray-400 leading-relaxed">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-nebula-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Welche Schlüssel brauchst du wirklich?</strong>
            <p className="mt-2">
              Für den Start reichen <strong className="text-emerald-300">zwei</strong>: <em>ein</em>{' '}
              Sprachmodell-Key (am einfachsten Groq, gratis) und der{' '}
              <em>Telegram-Bot-Token</em>. Alle anderen Skills im Tech-Baum funktionieren auch
              ohne — entweder als reine Skripte (Wetter über offene API, Würfel, Hash-Tools) oder sie
              werden erst in späteren Phasen relevant. Du kannst sie hier vorab eintragen, ein-Schritt
              ändern oder bei Bedarf in den Lektionen ergänzen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */

function Stat({ label, value, total, accent, sub }) {
  const colors = {
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    amber:   'border-amber-500/20 bg-amber-500/5 text-amber-300',
    purple:  'border-purple-500/20 bg-purple-500/5 text-purple-300',
  }
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-1">
        {value}
        {total !== undefined && <span className="text-sm text-gray-500 font-normal"> / {total}</span>}
      </div>
      {sub && <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function FilterButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs border transition flex items-center gap-1.5 ${
        active
          ? 'bg-nebula-500/20 text-white border-nebula-500/40'
          : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span>{icon}</span> {children}
    </button>
  )
}

function ServiceCard({
  service, currentValue, siblingValue, editValue, siblingEditValue,
  result, saving, revealed,
  onEdit, onEditSibling, onSave, onSaveSibling, onTest, onDelete, onToggleReveal,
}) {
  const hasKey = !!currentValue
  const editing = editValue !== ''

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition ${
      hasKey
        ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
        : 'border-white/10 bg-white/[0.02]'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl shrink-0">{service.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-white font-bold text-sm sm:text-base m-0">{service.name}</h3>
            {hasKey
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Eingerichtet</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10">Leer</span>
            }
          </div>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{service.help}</p>
          {service.skill && (
            <p className="text-[11px] text-gray-500 mt-1 italic">→ {service.skill}</p>
          )}
        </div>
      </div>

      {/* Aktueller Wert */}
      {hasKey && !editing && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-black/30 rounded-lg border border-white/5">
          <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <code className="text-xs text-gray-300 font-mono flex-1 break-all">
            {revealed ? currentValue : mask(currentValue)}
          </code>
          <button
            onClick={onToggleReveal}
            className="p-1.5 hover:bg-white/5 rounded text-gray-400 hover:text-white transition"
            title={revealed ? 'Verbergen' : 'Anzeigen'}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onTest}
            className="px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 text-gray-300 rounded transition"
            title="Live-Test"
          >
            Testen
          </button>
          <button
            onClick={onDelete}
            disabled={saving}
            className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400 transition disabled:opacity-50"
            title="Schlüssel löschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Eingabe */}
      <div className="flex flex-wrap gap-2">
        <input
          type={revealed ? 'text' : 'password'}
          value={editValue}
          onChange={(e) => onEdit(e.target.value)}
          placeholder={hasKey ? 'Neuen Schlüssel eintippen zum Ersetzen' : service.placeholder}
          className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 focus:border-nebula-500/50 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-gray-600 focus:outline-none"
        />
        <button
          onClick={onSave}
          disabled={!editing || saving}
          className="px-4 py-2 bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed disabled:shadow-none text-white text-sm font-medium rounded-lg transition"
        >
          {saving ? '…' : hasKey ? 'Ersetzen' : 'Speichern'}
        </button>
      </div>

      {/* Sibling-Field (z.B. Pushover User-Key) */}
      {service.sibling && (
        <div className="flex flex-wrap gap-2 mt-2">
          <input
            type={revealed ? 'text' : 'password'}
            value={siblingEditValue}
            onChange={(e) => onEditSibling(e.target.value)}
            placeholder={siblingValue ? `gespeichert: ${mask(siblingValue)}` : service.sibling.placeholder}
            className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 focus:border-nebula-500/50 rounded-lg px-3 py-2 text-white text-sm font-mono placeholder-gray-600 focus:outline-none"
          />
          <button
            onClick={onSaveSibling}
            disabled={!siblingEditValue || saving}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg disabled:opacity-50"
          >
            {service.sibling.label} speichern
          </button>
        </div>
      )}

      {/* Test-Ergebnis */}
      {result && (
        <div className={`mt-3 text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg ${
          result.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
        }`}>
          {result.ok ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          {result.message}
        </div>
      )}

      {/* Links */}
      {service.links && service.links.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 pt-1">Key holen:</span>
          {service.links.map(l => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded transition no-underline"
            >
              {l.label} <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
