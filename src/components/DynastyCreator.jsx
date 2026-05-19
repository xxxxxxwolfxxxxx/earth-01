import { useState } from 'react'
import { setDynasty } from '../lib/worldService'

const EMOJI_OPTIONS = [
  '🧙‍♀️','🧙‍♂️','👩‍🌾','👨‍🌾','👩‍🔬','👨‍🔬',
  '🧝‍♀️','🧝‍♂️','🦸‍♀️','🦸‍♂️','🥷','🧑‍🎤',
  '👩‍💼','👨‍💼','👩‍🚀','👨‍🚀','🦊','🐺',
]

export default function DynastyCreator({ onComplete }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await setDynasty({ name, emoji })
      onComplete?.({ name, emoji })
    } catch (err) {
      setError(err.message || 'Fehler beim Anlegen')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 rounded-2xl bg-white/[0.04] border border-white/10">
      <h2 className="font-display text-2xl font-bold text-white mb-2">
        Gründe deine Dynastie
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Wähle einen Namen und ein Symbol. Der Name bleibt für alle Generationen
        gleich — du chattest immer mit dieser Identität, egal wer im Spiel
        gerade die Linie führt.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            Dynastie-Name (2–20 Zeichen)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Gisela"
            maxLength={20}
            className="w-full bg-cosmos-800 border border-white/10 rounded-lg px-4 py-3 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-2">
            Symbol (Emoji)
          </label>
          <div className="grid grid-cols-9 gap-2">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`text-2xl p-2 rounded-lg border transition ${
                  emoji === e
                    ? 'bg-nebula-500/30 border-nebula-400'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !emoji}
          className="w-full bg-nebula-500 hover:bg-nebula-400 disabled:opacity-50
                     text-white font-medium py-3 rounded-lg transition"
        >
          {submitting ? 'Lege an…' : 'Dynastie gründen'}
        </button>
      </form>
    </div>
  )
}
