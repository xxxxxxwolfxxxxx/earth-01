import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Network, Key, BookOpen, Sparkles, Zap, Brain, Smartphone, Lock, Send } from 'lucide-react'

// LiveEarth ist groß (three.js + react-globe.gl + astronomy-engine ≈ 1 MB).
// Lazy laden, damit der Hero-Text schon sichtbar ist während die Erde im Hintergrund nachlädt.
const LiveEarth = lazy(() => import('../components/LiveEarth'))

const features = [
  {
    icon: Network,
    title: 'Lernpfad zum Anklicken',
    desc: 'Ein visueller Tech-Baum mit 7 Themen-Pfaden. Du wählst was dich interessiert — Daten, Sicherheit, Automation, Sprachmodelle — und lernst es Schritt für Schritt.',
  },
  {
    icon: Brain,
    title: 'KI-Konzepte hands-on',
    desc: 'Token, RAG, Cron, OAuth, Quantisierung — keine Theorie, sondern Klick im Mini-Wiki und sofort selbst ausprobieren. Jede Fähigkeit lehrt ein echtes Konzept.',
  },
  {
    icon: Zap,
    title: 'Echter Agent als Belohnung',
    desc: 'Was du im Spiel lernst, kann dein Telegram-Bot danach für dich tun: Wetter abfragen, Notizen verwalten, Erinnerungen setzen, Passwort-Leaks prüfen — wie du willst.',
  },
  {
    icon: Smartphone,
    title: 'Mobile zuerst',
    desc: 'Kein PC nötig. Smartphone + Telegram reichen. Die ganze Plattform läuft im Browser, dein Agent in Telegram.',
  },
  {
    icon: Lock,
    title: 'Deine Daten bleiben bei dir',
    desc: 'API-Keys hinterlegst du selbst, optional sogar dein eigener Cloud-Speicher (Google Drive, GitHub). Wir leiten nur durch — speichern nichts Privates.',
  },
  {
    icon: Sparkles,
    title: 'Kostenlos',
    desc: 'Wir laufen auf Free-Tiers von Supabase und Netlify. Du bringst deine eigenen kostenlosen API-Keys mit (Groq, Hugging Face). Token-sparsam designt.',
  },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-2 sm:px-4 pt-16 pb-8 relative">
        <div className="w-full flex justify-center -mb-12 sm:-mb-16 min-h-[400px]">
          <Suspense fallback={<div className="text-gray-500 text-sm pt-32">Lade Welt …</div>}>
            <LiveEarth height={900} />
          </Suspense>
        </div>
        <div className="max-w-3xl relative">
          <h1 className="font-display text-5xl sm:text-7xl font-bold text-white leading-tight tracking-tight">
            Earth <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">0.1</span>
          </h1>
          <p className="text-xl sm:text-2xl text-gray-300 mt-4 leading-relaxed font-light">
            Ein Zuhause für deinen Agenten — und für alle anderen.
          </p>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto leading-relaxed">
            Jedes Licht auf der Erde ist ein User, dessen Bot hier lebt. Jeder Pulse
            zeigt einen Bot, der gerade was tut. Du lernst KI, baust dir deinen
            eigenen Agenten — und siehst, wer noch da ist.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link
              to="/tech-tree"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold text-lg no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition-all hover:-translate-y-0.5"
            >
              <Network className="w-5 h-5" /> Zum Tech-Baum
            </Link>
            <Link
              to="/wissen"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 text-white rounded-xl font-display font-semibold text-lg no-underline border border-white/10 hover:bg-white/10 transition-all hover:-translate-y-0.5"
            >
              <BookOpen className="w-5 h-5" /> Erstmal stöbern
            </Link>
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white">
            Was ist Earth 0.1?
          </h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
            Eine Bildungsplattform für KI-Grundlagen — verpackt als Lernspiel. Du arbeitest
            dich durch einen Tech-Baum aus 20+ Fähigkeiten, jede lehrt ein konkretes
            Konzept und resultiert in einem echten Werkzeug, das dein persönlicher Agent
            danach nutzen kann.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-nebula-500/30 hover:bg-white/[0.05] transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-nebula-500/10 flex items-center justify-center mb-4 group-hover:bg-nebula-500/20 transition">
                <Icon className="w-6 h-6 text-nebula-400" />
              </div>
              <h3 className="font-display text-white font-bold text-lg mb-2">{title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white text-center mb-16">
          So funktioniert es
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              step: '01',
              title: 'Pfad wählen',
              desc: 'Im Tech-Baum siehst du sieben Themen-Pfade. Klick auf den der dich interessiert — Sicherheit, Daten-APIs, Automation, ...',
              icon: Network,
            },
            {
              step: '02',
              title: 'Skill erlernen',
              desc: 'Pro Skill eine Lern-Karte: kurz lesen was es ist und wozu, dann direkt ausprobieren — im Browser oder per Telegram-Nachricht an deinen Bot.',
              icon: BookOpen,
            },
            {
              step: '03',
              title: 'Werkzeug nutzen',
              desc: 'Jeder freigeschaltete Skill wird zu einer Fähigkeit deines Bots. „/wetter Berlin" — und dein Bot kann es ab sofort. Für immer.',
              icon: Send,
            },
          ].map(({ step, title, desc, icon: Icon }) => (
            <div key={step} className="relative">
              <div className="text-6xl font-display font-bold text-nebula-500/10 absolute -top-4 -left-2">{step}</div>
              <div className="relative pt-8">
                <div className="w-10 h-10 rounded-lg bg-nebula-500/20 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-nebula-400" />
                </div>
                <h3 className="font-display text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Origin Story */}
      <section className="max-w-3xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-br from-nebula-500/10 to-blue-500/10 border border-nebula-500/20 rounded-2xl p-8 sm:p-12">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-6">
            Warum es das gibt
          </h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              KI-Agenten sind in aller Munde. Aber wer ohne Tech-Hintergrund verstehen will
              wie das funktioniert, scheitert an zwei Hürden: <em className="text-white">die
              Erklärungen sind entweder zu oberflächlich oder zu technisch</em>, und
              die guten Tools (OpenAI-API, Bezahl-Frameworks) sind teuer. Mit einem
              Free-Tier kommt man im echten Agenten-Betrieb kaum drei Tage weit.
            </p>
            <p>
              Earth 0.1 löst beides: Du lernst <em className="text-white">durch Tun</em>,
              nicht durch Lesen. Jede Fähigkeit ist ein kleines Skript — keine Sprachmodell-Calls
              wo es nicht sein muss. Das spart Token, hält Free-Tiers stabil, und nebenbei
              verstehst du wo ein LLM wirklich hilft und wo simpler Code reicht.
            </p>
            <p>
              Der Quellcode ist öffentlich einsehbar (nicht-kommerzielle Nutzung erlaubt)
              und läuft auf kostenlosen Bausteinen (Supabase, Netlify, dein eigenes
              Telegram). Sie soll Schulen, Auszubildenden
              und KI-Neugierigen einen ehrlichen Einstieg geben — und dabei direkt ein
              nützliches Werkzeug an die Hand drücken.
            </p>
          </div>
        </div>
      </section>

      {/* Telegram */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-8 sm:p-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                <Send className="w-10 h-10 text-blue-400" />
              </div>
            </div>
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-3">
                Dein Bot lebt in deinem Telegram
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Erstelle in drei Minuten deinen eigenen Telegram-Bot. Jede Fähigkeit die du
                im Tech-Baum freischaltest versteht er ab sofort. Schreib ihm „/wetter Hamburg"
                — er antwortet. „in 30 min erinnere mich an Yoga" — er pingt dich pünktlich.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">🤖 Dein eigener Bot</span>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">⚡ 0 Tokens für die meisten Skills</span>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">📲 Funktioniert mobil</span>
                <span className="text-xs px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">🔒 Deine Daten bleiben bei dir</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-white mb-4">
          Bereit anzufangen?
        </h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          Login mit Google, GitHub oder Email. Danach klick dich in den Tech-Baum und schalt
          deinen ersten Skill frei — Wetter, Web-Suche oder Passwort-Generator brauchen
          nicht mal eine API-Konfiguration.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/tech-tree"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold text-lg no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition-all"
          >
            Zum Tech-Baum <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/keys"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 text-white rounded-xl font-display font-semibold text-lg no-underline border border-white/10 hover:bg-white/10 transition-all"
          >
            <Key className="w-5 h-5" /> Keys einrichten
          </Link>
        </div>
      </section>
    </div>
  )
}
