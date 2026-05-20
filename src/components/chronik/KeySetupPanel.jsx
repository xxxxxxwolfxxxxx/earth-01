import { useEffect, useState } from 'react'
import { Key, Check, X } from 'lucide-react'
import { fetchUserKeys, saveUserKey, testKey } from '../../lib/keyService'

const KEY_FIELDS = [
  { field: 'llm_api_key', label: 'LLM-Key (Groq / NVIDIA / OpenRouter / OpenAI)', placeholder: 'gsk_…  sk-or-…  nvapi-…  sk-…', help: 'Anbieter wird automatisch am Prefix erkannt. Empfohlen kostenlos: groq.com/keys (gsk_…). NVIDIA-Keys sind aktuell vielfach abgelaufen.' },
  { field: 'huggingface_key', label: 'Hugging-Face-Key (für Bild-Generation)', placeholder: 'hf_…', help: 'kostenlos auf huggingface.co/settings/tokens' },
  { field: 'resend_api_key', label: 'Resend-Key (für Email-Versand)', placeholder: 're_…', help: '100 Mails/Tag kostenlos auf resend.com' },
]

export default function KeySetupPanel() {
  const [keys, setKeys] = useState({})
  const [edits, setEdits] = useState({})
  const [testResults, setTestResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => {
    fetchUserKeys().then((k) => { setKeys(k ?? {}); setLoading(false) })
  }, [])

  async function handleSave(field) {
    setSaving((s) => ({ ...s, [field]: true }))
    try {
      const value = edits[field]
      await saveUserKey(field, value)
      const result = await testKey(field, value)
      setTestResults((r) => ({ ...r, [field]: result }))
      setKeys((k) => ({ ...k, [field]: value }))
      setEdits((e) => { const next = { ...e }; delete next[field]; return next })
    } catch (e) {
      setTestResults((r) => ({ ...r, [field]: { ok: false, message: e.message }}))
    } finally {
      setSaving((s) => ({ ...s, [field]: false }))
    }
  }

  if (loading) return <div className="text-gray-500">Lade…</div>

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-nebula-400" />
        <h3 className="font-display font-bold text-white">API-Keys (für erweiterte Tools)</h3>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Alle Tools mit dem gelben "Erweitert"-Badge brauchen einen kostenlosen
        Drittanbieter-Key. Keys werden nur in deinem Supabase-Profil gespeichert.
      </p>

      <div className="space-y-4">
        {KEY_FIELDS.map(({ field, label, placeholder, help }) => {
          const current = keys[field] ?? ''
          const masked = current ? `${current.slice(0,4)}…${current.slice(-3)}` : ''
          const editing = edits[field] !== undefined
          const result = testResults[field]
          return (
            <div key={field} className="bg-white/[0.02] border border-white/5 rounded-lg p-3">
              <label className="text-sm text-gray-300 mb-1 block">{label}</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={editing ? edits[field] : ''}
                  onChange={(e) => setEdits((p) => ({ ...p, [field]: e.target.value }))}
                  placeholder={current ? `gespeichert: ${masked}` : placeholder}
                  className="flex-1 min-w-[200px] bg-cosmos-800 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleSave(field)}
                  disabled={!editing || saving[field]}
                  className="px-3 py-2 bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50 text-white text-sm rounded-md"
                >
                  {saving[field] ? '…' : 'Speichern & testen'}
                </button>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">{help}</div>
              {result && (
                <div className={`mt-1 text-xs flex items-center gap-1 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {result.message}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
