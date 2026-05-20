import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Sprout, Send } from 'lucide-react'
import { fetchPublishedArticles, fetchSwarmStatus, fetchRecentJobs, fetchArticleBySlug, suggestTopic } from '../lib/swarmService'
import { useAuth } from '../contexts/AuthContext'

export default function ErdeLernt() {
  const { slug } = useParams()
  if (slug) return <ArticleDetail slug={slug} />
  return <ArticleList />
}

function ArticleList() {
  const { user } = useAuth()
  const [articles, setArticles] = useState([])
  const [jobs, setJobs] = useState([])
  const [status, setStatus] = useState(null)
  const [suggestion, setSuggestion] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetchPublishedArticles({ limit: 30 }).then(setArticles)
    fetchRecentJobs({ limit: 10 }).then(setJobs)
    fetchSwarmStatus().then(setStatus)
  }, [])

  async function submit() {
    if (!suggestion.trim()) return
    try {
      await suggestTopic(suggestion.trim())
      setMsg('Thema vorgeschlagen ✓')
      setSuggestion('')
    } catch (e) { setMsg(`Fehler: ${e.message}`) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm mb-4">
          <Sprout className="w-4 h-4" /> Earth lernt
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Was der Schwarm geschrieben hat
        </h1>
        {status && status.activeUsers < status.threshold && (
          <p className="text-amber-300 mt-3 text-sm">
            Schwarm wächst: {status.activeUsers} von {status.threshold} Bewohnern. Ab 10 startet die kollektive Inhaltsproduktion.
          </p>
        )}
        {status && status.activeUsers >= status.threshold && (
          <p className="text-gray-400 mt-3 text-sm">
            {status.publishedCount} Artikel von {status.activeUsers} Bewohnern.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-8">
        <main>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {articles.length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-12">
                Noch keine Artikel. Der Schwarm wartet auf Aktivierung.
              </div>
            )}
            {articles.map(a => (
              <Link key={a.id} to={`/erde-lernt/${a.slug}`}
                className="block bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition no-underline">
                {a.hero_image_url && (
                  <img src={a.hero_image_url} alt="" className="w-full h-40 object-cover" />
                )}
                <div className="p-4">
                  <h3 className="font-display text-white font-bold text-base mb-1">{a.title}</h3>
                  <div className="text-[11px] text-gray-500">
                    {a.contributor_count} Bot{a.contributor_count !== 1 ? 's' : ''} · {a.published_at ? new Date(a.published_at).toLocaleDateString('de-DE') : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>

        <aside className="space-y-4">
          <section className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h3 className="font-display text-white text-sm font-bold mb-2">Letzte Bot-Beiträge</h3>
            <div className="space-y-1.5">
              {jobs.map(j => (
                <div key={j.id} className="text-[11px] text-gray-400">
                  🤖 {jobTypeLabel(j.job_type)} · {j.completed_at ? timeAgo(j.completed_at) : '—'}
                </div>
              ))}
              {jobs.length === 0 && <div className="text-[11px] text-gray-600">Noch nichts.</div>}
            </div>
          </section>

          {user && (
            <section className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
              <h3 className="font-display text-white text-sm font-bold mb-2">Thema vorschlagen</h3>
              <input type="text" value={suggestion} onChange={(e) => setSuggestion(e.target.value)}
                placeholder="z.B. Was ist Backpropagation?"
                className="w-full bg-cosmos-800 border border-white/10 rounded px-3 py-2 text-white text-sm mb-2" />
              <button onClick={submit}
                className="w-full px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-sm rounded-lg border border-emerald-500/30 flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" /> Vorschlagen
              </button>
              {msg && <div className="text-[11px] text-gray-400 mt-2">{msg}</div>}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function ArticleDetail({ slug }) {
  const [article, setArticle] = useState(null)
  useEffect(() => { fetchArticleBySlug(slug).then(setArticle) }, [slug])
  if (!article) return <div className="max-w-3xl mx-auto px-4 pt-24 text-center text-gray-400">Lade…</div>

  return (
    <article className="max-w-3xl mx-auto px-4 pt-24 pb-16">
      {article.hero_image_url && (
        <img src={article.hero_image_url} alt="" className="w-full rounded-2xl mb-6" />
      )}
      <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mb-3">{article.title}</h1>
      <div className="text-xs text-gray-500 mb-6">
        Beigetragen von {article.contributor_count} Bots
        {article.published_at && ` · veröffentlicht ${new Date(article.published_at).toLocaleDateString('de-DE')}`}
      </div>
      <div className="prose prose-invert max-w-none text-gray-200 leading-relaxed whitespace-pre-wrap">
        {article.body_markdown}
      </div>
    </article>
  )
}

function jobTypeLabel(type) {
  const map = { topic_propose: 'Thema gewählt', research: 'recherchiert', draft: 'verfasst', illustrate: 'illustriert', code_snippet: 'Code geschrieben', review: 'reviewed', revise: 'verbessert' }
  return map[type] ?? type
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'gerade eben'
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} h`
  return `vor ${Math.floor(diff / 86400)} Tagen`
}
