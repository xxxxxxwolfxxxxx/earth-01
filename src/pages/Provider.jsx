import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ExternalLink, Search, Edit3, Save, X, Check, ShieldCheck,
  Key, Filter, Info,
} from 'lucide-react'
import { PROVIDERS, PROVIDER_CATEGORIES } from '../lib/providerCatalog'
import { fetchSetting, saveSetting, fetchIsAdmin } from '../lib/platformSettings'

export default function Provider() {
  const [affiliateMap, setAffiliateMap] = useState({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    fetchSetting('affiliate_links').then(v => setAffiliateMap(v ?? {}))
    fetchIsAdmin().then(setIsAdmin)
  }, [])

  const filtered = useMemo(() => {
    return PROVIDERS
      .filter(p => filter === 'all' || p.category === filter)
      .filter(p => {
        if (!search) return true
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) || p.free.toLowerCase().includes(q)
      })
  }, [filter, search])

  const grouped = useMemo(() => {
    const m = {}
    for (const cat of PROVIDER_CATEGORIES) m[cat.id] = filtered.filter(p => p.category === cat.id)
    return m
  }, [filtered])

  const totalProviders = PROVIDERS.length
  const affiliateProviders = PROVIDERS.filter(p => p.hasAffiliate).length
  const configuredCount = Object.values(affiliateMap).filter(v => v && v.length > 0).length

  async function persistDraft(providerId) {
    const next = { ...affiliateMap, [providerId]: (drafts[providerId] ?? '').trim() }
    if (!next[providerId]) delete next[providerId]
    setSaving(true)
    try {
      await saveSetting('affiliate_links', next)
      setAffiliateMap(next)
      setDrafts(d => { const n = { ...d }; delete n[providerId]; return n })
      setSavedMsg(`✓ ${providerId} gespeichert`)
      setTimeout(() => setSavedMsg(''), 2000)
    } catch (e) {
      setSavedMsg(`✗ Fehler: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function clearAffiliate(providerId) {
    if (!confirm(`Affiliate-Link für ${providerId} entfernen?`)) return
    const next = { ...affiliateMap }
    delete next[providerId]
    setSaving(true)
    try {
      await saveSetting('affiliate_links', next)
      setAffiliateMap(next)
    } finally {
      setSaving(false)
    }
  }

  function urlFor(p) {
    return affiliateMap[p.id] || p.defaultUrl
  }
  function isAffiliated(p) {
    return p.hasAffiliate && !!affiliateMap[p.id]
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Sparkles className="w-4 h-4" /> Free-Tier-Anbieter
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Alle Anbieter mit Gratis-API
        </h1>
        <p className="text-gray-400 mt-3 text-sm max-w-2xl mx-auto leading-relaxed">
          Eine kuratierte Sammlung: {totalProviders} Anbieter, die echte Free-Tiers anbieten.
          Mit Direktlinks zu Sign-up und ehrlicher Einordnung. Du brauchst nicht alle —
          such dir die raus, die zu deinen Lieblings-Skills passen.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6 max-w-2xl mx-auto">
        <Stat label="Anbieter" value={totalProviders} accent="purple" />
        <Stat label="Kategorien" value={PROVIDER_CATEGORIES.length} accent="blue" />
        <Stat label="Mit Affiliate" value={affiliateProviders} accent="amber" />
      </div>

      {/* Affiliate-Hinweis */}
      <div className="max-w-3xl mx-auto mb-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 leading-relaxed">
          <strong className="text-amber-300">Transparenz:</strong> Links mit{' '}
          <RefBadge inline /> sind Affiliate-Links. Wir bekommen eine kleine
          Provision, wenn du dich darüber anmeldest und später zahlst — für dich
          ändert sich am Preis nichts. So finanzieren wir den Betrieb der Plattform.
          Anbieter ohne <RefBadge inline /> verlinken direkt zur Anbieter-Seite ohne Tracking.
        </div>
      </div>

      {/* Admin-Toggle */}
      {isAdmin && (
        <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-purple-500/5 border border-purple-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-purple-400" />
            <div className="text-sm">
              <div className="text-purple-200 font-medium">Admin-Modus</div>
              <div className="text-xs text-gray-400">
                {configuredCount} von {affiliateProviders} Affiliate-Links eingerichtet
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
              editMode
                ? 'bg-purple-500/30 text-white border border-purple-400/50'
                : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
            }`}
          >
            {editMode ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? 'Bearbeitung beenden' : 'Affiliate-Links bearbeiten'}
          </button>
        </div>
      )}

      {savedMsg && (
        <div className="max-w-3xl mx-auto mb-4 px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 text-sm text-center">
          {savedMsg}
        </div>
      )}

      {/* Suche + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Anbieter suchen…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-nebula-500/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} icon="📋">
          Alle ({PROVIDERS.length})
        </FilterButton>
        {PROVIDER_CATEGORIES.map(cat => {
          const count = PROVIDERS.filter(p => p.category === cat.id).length
          return (
            <FilterButton
              key={cat.id}
              active={filter === cat.id}
              onClick={() => setFilter(cat.id)}
              icon={cat.icon}
            >
              {cat.label} ({count})
            </FilterButton>
          )
        })}
      </div>

      {/* Provider nach Kategorien */}
      {PROVIDER_CATEGORIES.map(cat => {
        if (filter !== 'all' && filter !== cat.id) return null
        const items = grouped[cat.id]
        if (!items || items.length === 0) return null
        return (
          <section key={cat.id} className="mb-10">
            <div className="flex items-center gap-3 mb-4 pl-1">
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <h2 className="font-display text-white text-lg font-bold m-0">{cat.label}</h2>
                <p className="text-xs text-gray-500">{cat.desc}</p>
              </div>
              <div className="ml-auto text-xs text-gray-500">{items.length} Anbieter</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(p => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  url={urlFor(p)}
                  affiliated={isAffiliated(p)}
                  editMode={editMode && isAdmin}
                  draftValue={drafts[p.id] ?? ''}
                  currentAffiliateUrl={affiliateMap[p.id] ?? ''}
                  saving={saving}
                  onDraftChange={(v) => setDrafts(d => ({ ...d, [p.id]: v }))}
                  onSave={() => persistDraft(p.id)}
                  onClear={() => clearAffiliate(p.id)}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* Bottom-Help */}
      <div className="mt-12 p-5 rounded-2xl bg-white/[0.02] border border-white/10 text-sm text-gray-400 leading-relaxed max-w-3xl mx-auto">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-nebula-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Wo trägst du den Key dann ein?</strong>
            <p className="mt-2">
              Sobald du einen Schlüssel von einem dieser Anbieter hast, geht es auf{' '}
              <Link to="/keys" className="text-nebula-400 hover:text-nebula-300">/keys</Link>{' '}
              weiter — dort verwaltest du alle deine Schlüssel zentral. Die zugehörigen Skills
              im <Link to="/tech-tree" className="text-nebula-400 hover:text-nebula-300">/tech-tree</Link>{' '}
              werden danach automatisch verfügbar.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────── */

function ProviderCard({
  provider, url, affiliated, editMode,
  draftValue, currentAffiliateUrl, saving,
  onDraftChange, onSave, onClear,
}) {
  return (
    <div className={`rounded-2xl border p-4 transition ${
      affiliated
        ? 'border-amber-500/20 bg-amber-500/[0.03]'
        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        <div className="text-2xl shrink-0">{provider.logo}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-white font-bold text-base m-0">{provider.name}</h3>
            {affiliated && <RefBadge />}
            {provider.hasAffiliate && !affiliated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 border border-white/10">
                Affiliate verfügbar
              </span>
            )}
          </div>
          <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{provider.free}</p>
          {provider.notes && (
            <p className="text-[11px] text-gray-500 mt-1 italic">{provider.notes}</p>
          )}
        </div>
      </div>

      {/* Standard-Sign-up-Button */}
      {!editMode && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-nebula-500 to-blue-600 hover:shadow-lg hover:shadow-nebula-500/25 text-white text-sm font-medium rounded-lg no-underline transition"
        >
          <Key className="w-3.5 h-3.5" /> Zum Sign-up <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}

      {/* Admin-Editor */}
      {editMode && (
        <div className="space-y-2 pt-3 border-t border-white/10">
          <div className="text-[11px] uppercase tracking-wider text-purple-300 font-medium">
            Affiliate-URL
          </div>
          {!provider.hasAffiliate && (
            <div className="text-xs text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded p-2">
              ⚠ Dieser Anbieter hat (Stand jetzt) kein offizielles Affiliate-Programm. Du kannst trotzdem
              eine eigene Tracking-URL eintragen.
            </div>
          )}
          {currentAffiliateUrl && draftValue === '' && (
            <div className="text-xs text-gray-400 break-all bg-black/30 rounded px-2 py-1.5 font-mono">
              Aktuell: {currentAffiliateUrl}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={draftValue}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={currentAffiliateUrl || `z.B. ${provider.defaultUrl}?ref=deine_id`}
              className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 focus:border-purple-500/50 rounded-lg px-3 py-2 text-white text-xs font-mono placeholder-gray-600 focus:outline-none"
            />
            <button
              onClick={onSave}
              disabled={!draftValue || saving}
              className="px-3 py-2 bg-purple-500/30 hover:bg-purple-500/50 text-white text-xs rounded-lg disabled:opacity-50 transition flex items-center gap-1"
            >
              <Save className="w-3 h-3" /> Speichern
            </button>
            {currentAffiliateUrl && (
              <button
                onClick={onClear}
                className="px-3 py-2 bg-white/5 hover:bg-red-500/20 text-gray-300 hover:text-red-300 text-xs rounded-lg transition"
              >
                Entfernen
              </button>
            )}
          </div>
          <div className="text-[10px] text-gray-500">
            Default: <code>{provider.defaultUrl}</code>
          </div>
        </div>
      )}
    </div>
  )
}

function RefBadge({ inline }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 ${inline ? '' : 'shrink-0'}`}>
      <Check className="w-2.5 h-2.5" /> Ref
    </span>
  )
}

function Stat({ label, value, accent }) {
  const colors = {
    purple: 'border-purple-500/20 bg-purple-500/5 text-purple-300',
    blue:   'border-blue-500/20 bg-blue-500/5 text-blue-300',
    amber:  'border-amber-500/20 bg-amber-500/5 text-amber-300',
  }
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colors[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</div>
      <div className="font-display font-bold text-2xl sm:text-3xl mt-1">{value}</div>
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
