import { useEffect, useState } from 'react'
import { Key, Check, X } from 'lucide-react'
import { fetchUserKeys, saveUserKey, testKey } from '../lib/keyService'
import { BOT_TEXT } from '../lib/botMessages'

const FIELDS = [
  { field: 'llm_api_key', label: 'LLM-Key (Groq / NVIDIA / OpenRouter / OpenAI)', placeholder: 'gsk_…  sk-or-…  nvapi-…  sk-…', help: 'Empfohlen: gratis Key auf https://console.groq.com/keys (Prefix gsk_)' },
  { field: 'huggingface_key', label: 'Hugging-Face-Key (Bild-Generation)', placeholder: 'hf_…', help: 'gratis: https://huggingface.co/settings/tokens' },
  { field: 'resend_api_key', label: 'Resend-Key (Email-Versand)', placeholder: 're_…', help: '100 Mails/Tag gratis: https://resend.com' },
]

export default function Keys() {
  const [keys, setKeys] = useState({})
  const [edits, setEdits] = useState({})
  const [results, setResults] = useState({})
  const [saving, setSaving] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserKeys().then(k => { setKeys(k ?? {}); setLoading(false) })
  }, [])

  async function save(field) {
    setSaving(s => ({ ...s, [field]: true }))
    try {
      const val = edits[field]
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

  return (
    <div className="max-w-2xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <Key className="w-4 h-4" /> API-Keys
        </div>
        <h1 className="font-display text-4xl font-bold text-white">Schlüssel verwalten</h1>
        <p className="text-gray-400 mt-3 text-sm">
          Jeder Schlüssel kommt von dir, bleibt bei dir. Wir leiten ihn nur an den jeweiligen Dienst weiter.
        </p>
      </div>

      {loading && <div className="text-gray-400 text-center">Lade…</div>}
      {!loading && FIELDS.map(({ field, label, placeholder, help }) => {
        const current = keys[field] ?? ''
        const masked = current ? `${current.slice(0,4)}…${current.slice(-3)}` : ''
        const editing = edits[field] !== undefined
        const r = results[field]
        return (
          <div key={field} className="bg-cosmos-900 border border-white/10 rounded-2xl p-4 mb-4">
            <label className="text-sm text-gray-300 block mb-2">{label}</label>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={editing ? edits[field] : ''}
                onChange={(e) => setEdits(p => ({ ...p, [field]: e.target.value }))}
                placeholder={current ? `gespeichert: ${masked}` : placeholder}
                className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => save(field)}
                disabled={!editing || saving[field]}
                className="px-3 py-2 bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50 text-white text-sm rounded-md"
              >
                {saving[field] ? '…' : 'Speichern & testen'}
              </button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">{help}</div>
            {r && (
              <div className={`mt-1 text-xs flex items-center gap-1 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>
                {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                {r.message}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
