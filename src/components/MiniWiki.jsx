import { useEffect, useRef, useState } from 'react'
import { fetchGlossaryEntry } from '../lib/skillService'

// Globaler Cache damit nicht für jedes Tooltip ein Roundtrip nötig ist
const cache = new Map()

async function load(key) {
  if (cache.has(key)) return cache.get(key)
  const data = await fetchGlossaryEntry(key)
  if (data) cache.set(key, data)
  return data
}

export default function MiniWiki({ termKey, anchorRect, onClose }) {
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const tipRef = useRef(null)

  useEffect(() => {
    load(termKey).then(d => { setEntry(d); setLoading(false) })
  }, [termKey])

  useEffect(() => {
    function handleClick(e) {
      if (tipRef.current && !tipRef.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (!anchorRect) return null
  const style = {
    position: 'fixed',
    left: Math.min(anchorRect.left, window.innerWidth - 280),
    top: anchorRect.bottom + 8,
    zIndex: 100,
    maxWidth: 260,
  }

  return (
    <div
      ref={tipRef}
      style={style}
      className="bg-cosmos-900 border border-nebula-400/50 rounded-xl p-3 shadow-2xl"
    >
      {loading && <div className="text-gray-400 text-xs">Lade…</div>}
      {!loading && !entry && (
        <div className="text-gray-500 text-xs">Kein Eintrag zu „{termKey}".</div>
      )}
      {entry && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">{entry.icon ?? '📖'}</span>
            <span className="text-white text-sm font-bold">{entry.key}</span>
            <span className="ml-auto text-[9px] uppercase tracking-wide text-nebula-300 bg-nebula-500/20 px-2 py-0.5 rounded-full">{entry.category}</span>
          </div>
          <p className="text-xs text-gray-300 leading-snug mb-2">{entry.short_desc}</p>
          {entry.example && (
            <div className="text-[11px] text-amber-200 bg-black/30 rounded px-2 py-1 mb-2 font-mono">{entry.example}</div>
          )}
          {Array.isArray(entry.related) && entry.related.length > 0 && (
            <div className="text-[10px] text-gray-400">
              Verwandt:{' '}
              {entry.related.map((r, i) => (
                <span key={r} className="text-blue-300">{r}{i < entry.related.length - 1 ? ', ' : ''}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Wrapper-Komponente: rendert Text mit klickbaren <span class="term"> für Glossar-Wörter
export function TermText({ html }) {
  const [active, setActive] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    function onClick(e) {
      const target = e.target
      if (target.matches && target.matches('.term')) {
        const rect = target.getBoundingClientRect()
        setActive({ key: target.textContent.trim(), rect })
      }
    }
    const node = ref.current
    node.addEventListener('click', onClick)
    return () => node.removeEventListener('click', onClick)
  }, [])

  return (
    <>
      <span ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
      {active && (
        <MiniWiki termKey={active.key} anchorRect={active.rect} onClose={() => setActive(null)} />
      )}
    </>
  )
}
