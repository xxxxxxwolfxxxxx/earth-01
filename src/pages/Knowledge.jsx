import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen, ExternalLink, ChevronDown, Lightbulb, Sparkles, Network, Brain, Key,
  Send, Zap, Lock, Database, Clock, Cloud, Rocket, GraduationCap, Search,
  ShieldCheck, Workflow, Smartphone, Heart, Globe,
} from 'lucide-react'
import { fetchGlossary } from '../lib/skillService'

/* ───────────────────────────────────────────────
   Daten: Pfade, Free-Tier-Provider, Lern-Themen
   ─────────────────────────────────────────────── */

const PATHS = [
  {
    id: 'hub',
    icon: Key,
    color: 'from-purple-500/20 to-fuchsia-500/20 border-purple-500/30',
    title: 'Hub — Dein Startpunkt',
    skills: ['API-Keys einrichten', 'Telegram-Bot anlegen'],
    desc: 'Zwei Fähigkeiten ohne die nichts weiter geht. Du holst dir gratis API-Keys bei Groq, NVIDIA und Hugging Face und verknüpfst deinen eigenen Telegram-Bot. Danach hast du eine voll funktionierende Basis: Sprachmodell + Chatkanal.',
  },
  {
    id: 'daten',
    icon: Database,
    color: 'from-blue-500/20 to-sky-500/20 border-blue-500/30',
    title: 'Daten aus dem Netz',
    skills: ['Wetter', 'Web-Suche', 'Wikipedia', 'Währungen', 'Länderdaten', 'RSS-Feeds'],
    desc: 'Sechs öffentliche APIs, die ohne Bezahlung Daten liefern. Du lernst was eine REST-API ist, wie JSON aussieht und warum „Endpoint" nicht das Ende der Welt bedeutet. Jeder Skill = ein neuer Befehl für deinen Bot.',
  },
  {
    id: 'sicherheit',
    icon: ShieldCheck,
    color: 'from-red-500/20 to-orange-500/20 border-red-500/30',
    title: 'Sicherheit',
    skills: ['Hash-Tools', 'Passwort-Generator', 'Leak-Check'],
    desc: 'Was ist ein Hash? Wieso ist „1234" das schlechteste Passwort aller Zeiten? Wurde meine Mail in einem Datenleck genannt? Du übst k-Anonymity (ein cleverer Datenschutz-Trick) und siehst was Crypto-Random ist.',
  },
  {
    id: 'tracking',
    icon: Heart,
    color: 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
    title: 'Mich verstehen',
    skills: ['Notizen', 'Stimmungs-Tagebuch', 'Gewohnheiten'],
    desc: 'Drei Tools, die deinen Alltag dokumentieren — direkt im Bot, aber gespeichert auf deinem eigenen Cloud-Speicher (optional). Streak-Counter motivieren, Mood-Verläufe machen Muster sichtbar.',
  },
  {
    id: 'automation',
    icon: Workflow,
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    title: 'Automation',
    skills: ['Erinnerungen', 'Pomodoro-Timer'],
    desc: 'Hier lernst du was ein Cron-Job ist und warum „* * * * *" wichtiger ist als es aussieht. Dein Bot pingt dich pünktlich — egal ob in 20 Minuten oder jeden Montag um 9.',
  },
  {
    id: 'spielerei',
    icon: Sparkles,
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
    title: 'Werkzeuge & Spielereien',
    skills: ['QR-Code', 'Würfel', 'Mathe-Übung', 'Witz/Zitat'],
    desc: 'Vier kleine Helfer, die nichts kosten. QR-Code für deine Wifi-Zugangsdaten, Würfel für faire Entscheidungen, Mathe-Übung für die Kinder, Zitat-Generator für die Morgenmotivation.',
  },
]

const PROVIDERS = [
  {
    name: 'Groq',
    url: 'https://console.groq.com/keys',
    prefix: 'gsk_…',
    free: 'Ca. 14.000 Tokens/Minute, sehr schnell',
    use: 'Sprachmodell-Antworten (Llama 3, Mixtral)',
  },
  {
    name: 'NVIDIA Build',
    url: 'https://build.nvidia.com',
    prefix: 'nvapi-…',
    free: '1000 Credits/Monat (~10 Mio. Tokens)',
    use: 'Größere Modelle (Kimi K2, DeepSeek V3)',
  },
  {
    name: 'Hugging Face',
    url: 'https://huggingface.co/settings/tokens',
    prefix: 'hf_…',
    free: 'Inferenz-API für viele OpenSource-Modelle',
    use: 'Image-Generation, Embeddings, Klassifikation',
  },
  {
    name: 'Resend',
    url: 'https://resend.com/api-keys',
    prefix: 're_…',
    free: '3000 Mails/Monat',
    use: 'Versand von Benachrichtigungen per Mail',
  },
  {
    name: 'OpenWeather',
    url: 'https://openweathermap.org/api',
    prefix: '32-Zeichen-Hex',
    free: '1000 Anfragen/Tag',
    use: 'Wetterdaten weltweit',
  },
]

const TOPICS = [
  {
    id: 'platform',
    icon: Rocket,
    title: 'Wie funktioniert die Plattform?',
    color: 'text-purple-400 bg-purple-500/10',
    paragraphs: [
      'Earth 0.1 ist <strong>kein klassischer Online-Kurs</strong>. Du schaust keine Video-Vorlesung, du machst keine Multiple-Choice-Quizze. Stattdessen klickst du dich durch einen <strong>Tech-Baum</strong>: 20 Fähigkeiten in sieben Themen-Pfaden, jede einzelne ein echtes Werkzeug.',
      'Klickst du eine Fähigkeit an, öffnet sich eine <strong>kompakte Lektion</strong>: Zuerst erfährst du <em>warum sich das für dich lohnt</em> und wie es funktioniert (mit anklickbaren Begriffen für ein Mini-Wiki). Direkt darunter probierst du das Werkzeug einmal selbst aus — im Browser oder per Nachricht an deinen Telegram-Bot. Danach ist die Fähigkeit dauerhaft freigeschaltet. Ab jetzt versteht dein Bot diesen Befehl. Für immer.',
      'Du lernst <em>durch Tun</em>, nicht durch Lesen. Jede Fähigkeit ist 5-10 Minuten kurz. Es gibt keine Hausaufgaben. Es gibt keine Prüfung. Wenn du den Skill nutzt, hast du verstanden was er macht — und dein Bot kann es ab sofort.',
    ],
  },
  {
    id: 'free-tier',
    icon: Zap,
    title: 'Warum kostet das nichts?',
    color: 'text-emerald-400 bg-emerald-500/10',
    paragraphs: [
      'Die Plattform läuft auf <strong>Free-Tiers</strong>: Netlify hostet das Frontend (100 GB Traffic/Monat gratis), Supabase die Datenbank und die Edge-Functions (500 MB DB + 500.000 Function-Calls/Monat gratis), Telegram die Bot-Infrastruktur (komplett gratis ohne Limits).',
      'Die Sprachmodelle nutzen <strong>du selbst</strong>: Du hinterlegst deinen eigenen Groq-Key (~14.000 Tokens/Minute frei) oder einen NVIDIA-Key (~10 Millionen Tokens/Monat frei). Wir leiten nur durch, speichern nichts. Wenn dein Token-Budget aufgebraucht ist, kommt eine sichtbare Anzeige — wir schicken keine versteckten Rechnungen.',
      'Die meisten Skills sind <strong>reine Skripte</strong>, ohne Sprachmodell. „/wetter Berlin" ruft direkt OpenWeather — null Tokens. „/würfel" generiert eine Zufallszahl — null Tokens. Sprachmodelle setzen wir nur ein wenn sie wirklich helfen (Übersetzung, Notiz-Zusammenfassung, freier Chat).',
      'So passen ~2000 aktive User in den Free-Tier. Genug für Schulklassen, Azubi-Gruppen und neugierige Einzelpersonen.',
    ],
  },
  {
    id: 'data',
    icon: Lock,
    title: 'Wo bleiben deine Daten?',
    color: 'text-amber-400 bg-amber-500/10',
    paragraphs: [
      'Wir speichern <strong>nichts Privates</strong> auf unseren Servern. API-Keys liegen verschlüsselt in deinem Profil. Notizen, Stimmungen und Gewohnheiten gehen — wenn du das möchtest — auf <strong>deinen eigenen Cloud-Speicher</strong>: Google Drive, GitHub Gist oder OneDrive. Du verbindest den Speicher per OAuth, wir bekommen nur einen Schreib-Token für deinen Earth-0.1-Ordner.',
      'Wenn du das nicht möchtest, ist das auch okay: Dann liegen die Daten in unserer Postgres-Datenbank, abgesichert durch <em>Row Level Security</em> (RLS) — niemand außer dir kann sie lesen. Bei Abmeldung wird alles gelöscht.',
      'Der Telegram-Bot ist <strong>dein eigener</strong> Bot. Du erstellst ihn beim BotFather, du besitzt den Token, du kannst ihn jederzeit löschen und damit den kompletten Datenkanal kappen.',
    ],
  },
  {
    id: 'tokens',
    icon: Brain,
    title: 'Was sind eigentlich Tokens?',
    color: 'text-blue-400 bg-blue-500/10',
    paragraphs: [
      'Ein <strong>Token</strong> ist die kleinste Texteinheit eines Sprachmodells — ungefähr drei bis vier Buchstaben. „Hallo" ist ein Token. „außergewöhnlich" sind drei Tokens. Ein durchschnittlicher Satz hat 15-20 Tokens.',
      'Sprachmodelle „lesen" und „schreiben" in Tokens. Du sendest 100 Tokens (Eingabe), bekommst 200 Tokens (Antwort) zurück — das sind 300 verbrauchte Tokens. Free-Tiers messen genau das.',
      'Das <strong>Kontext-Fenster</strong> ist wie viele Tokens das Modell auf einmal lesen kann. Llama 3 schafft 8.000 Tokens (~6.000 Wörter), GPT-4 Turbo bis zu 128.000 (ein ganzes Buch). Schickst du mehr, kappt das Modell den Anfang ab oder lehnt ab.',
      '<strong>Quantisierung</strong> ist der Trick, mit dem Sprachmodelle auf Handys laufen: Statt 32 Bit pro Zahl nur noch 4 Bit. Das Modell schrumpft auf ein Achtel — bei minimalem Qualitätsverlust. So passt ein 7-Milliarden-Parameter-Modell in 4 GB RAM.',
    ],
  },
  {
    id: 'api',
    icon: Network,
    title: 'Was ist eine API?',
    color: 'text-cyan-400 bg-cyan-500/10',
    paragraphs: [
      'Eine <strong>API</strong> (Application Programming Interface) ist eine Schnittstelle, mit der zwei Programme miteinander reden. Wenn der Wetterdienst eine API hat, kann dein Bot direkt fragen — ohne dass jemand eine Webseite öffnen muss.',
      'Die häufigste Form ist die <strong>REST-API</strong>. Du fragst per URL etwas an, kriegst die Antwort als JSON zurück. Beispiel: <code>GET https://api.openweather.org/data/2.5/weather?q=Berlin&appid=DEIN_KEY</code> — die Antwort sieht aus wie <code>{"main":{"temp":8.4}}</code>.',
      'JSON ist nur ein Daten-Format: geschwungene Klammern, Schlüssel-Wert-Paare, Listen mit eckigen Klammern. Computer-lesbar, aber von Menschen verstehbar. Wenn du verstehst was JSON ist, hast du die halbe Web-Welt verstanden.',
      'Ein <strong>Webhook</strong> ist eine umgekehrte API: Statt dass du anfragst, ruft ein anderes System dich an, wenn etwas passiert. Telegram nutzt das — sobald du dem Bot schreibst, klingelt unsere Edge-Function.',
    ],
  },
  {
    id: 'security',
    icon: ShieldCheck,
    title: 'Sicherheit-Grundlagen',
    color: 'text-red-400 bg-red-500/10',
    paragraphs: [
      'Eine <strong>Hash-Funktion</strong> verwandelt einen beliebig langen Text in einen kurzen Fingerabdruck. Aus „passwort" wird zum Beispiel <code>e8d8…f12b</code>. Selbst kleinste Änderungen am Text erzeugen einen komplett anderen Hash. Wichtig: Aus dem Hash kann man den Originaltext nicht zurückrechnen.',
      'Deshalb speichern alle ernsthaften Webseiten Passwörter <em>nur als Hash</em>. Bei einem Datenleck sieht der Angreifer nur Hashes — und muss dann erraten welcher Klartext dazu gehört.',
      '<strong>k-Anonymity</strong> ist ein cleverer Datenschutz-Trick. Beim Leak-Check zum Beispiel: Du willst wissen, ob dein Passwort geleakt ist — möchtest aber nicht das komplette Passwort zur Prüfung verschicken. Lösung: Du schickst nur die ersten fünf Zeichen des Hashes. Der Server liefert dir alle ~500 passenden Treffer zurück. Du filterst lokal. Niemand erfährt dein echtes Passwort.',
      '<strong>Crypto-Random</strong> ist der sichere Zufallszahlen-Generator des Browsers (<code>crypto.getRandomValues()</code>). Anders als <code>Math.random()</code> ist er nicht vorhersagbar — gut für Passwörter und Session-Keys.',
      '<strong>OAuth</strong> erlaubt einer App, in deinem Namen zu handeln, ohne dein Passwort zu kennen. „Mit Google anmelden" ist OAuth. Du gibst Google das Passwort, Google gibt der App nur ein Ticket — und du kannst das Ticket jederzeit widerrufen.',
    ],
  },
  {
    id: 'cron',
    icon: Clock,
    title: 'Was ist Cron?',
    color: 'text-green-400 bg-green-500/10',
    paragraphs: [
      '<strong>Cron</strong> ist eine winzige Zeitplan-Sprache, fünfzig Jahre alt und immer noch überall im Einsatz. Fünf Sterne. Jeder Stern steht für etwas: Minute, Stunde, Tag-im-Monat, Monat, Wochentag.',
      '<code>* * * * *</code> heißt „jede Minute". <code>0 8 * * *</code> heißt „jeden Tag um 8 Uhr". <code>0 9 * * 1</code> heißt „jeden Montag um 9 Uhr".',
      'Unsere Erinnerungs-Funktion läuft als <strong>Cron-Job</strong>: Jede Minute prüft eine Edge-Function welche Reminder fällig sind und schickt sie an Telegram. Du musst nichts anstoßen — der Bot pingt dich pünktlich, auch wenn du das Handy weggelegt hast.',
      'Pomodoro nutzt das gleiche Prinzip, nur mit relativen Zeiten („in 25 Minuten"). Habits prüfen täglich um Mitternacht ob du deine Gewohnheit eingehalten hast und erhöhen den Streak-Counter.',
    ],
  },
  {
    id: 'rag',
    icon: GraduationCap,
    title: 'RAG, Embeddings, semantische Suche',
    color: 'text-fuchsia-400 bg-fuchsia-500/10',
    paragraphs: [
      'Sprachmodelle haben ein Problem: Sie wissen nicht was nach ihrem Training passiert ist. GPT-4 kennt keine News von gestern. Und sie haben ein Kontextfenster — du kannst ihnen nicht einfach 1000 Seiten Firmenwissen mitgeben.',
      'Die Lösung heißt <strong>RAG</strong> (Retrieval Augmented Generation). Idee: Du hast eine Wissensbasis (deine Notizen zum Beispiel). Bei einer Frage suchst du <em>nur die passenden Snippets</em> raus und gibst sie dem Modell als Kontext. Das Modell antwortet anhand der mitgelieferten Snippets — frisch, präzise, ohne Halluzinationen.',
      'Wie findet man „passende Snippets"? Mit <strong>Embeddings</strong>. Ein Embedding ist ein Text als Liste von Zahlen — sodass ähnliche Texte ähnliche Zahlen haben. „Hund" und „Hündchen" liegen nah beieinander, „Hund" und „Atomreaktor" weit auseinander. Mit Vektor-Mathematik findest du in Millisekunden die ähnlichsten Texte.',
      'Bei Earth 0.1 nutzen wir <code>multilingual-e5-small</code> von Hugging Face: 384 Dimensionen, mehrsprachig, gratis. Die Vektoren landen in <code>pgvector</code> in unserer Postgres-DB. Bei einer Frage embedde ich die Frage, suche per Cosine-Similarity die ähnlichsten 5 Notizen, und gebe sie dem Sprachmodell als Kontext.',
      '<strong>Wichtig:</strong> Klartext deiner Notizen liegt nicht bei uns — sondern auf deinem Google Drive oder GitHub Gist. Wir wissen nur die Embeddings (Lossy-Transformation, nicht lesbar). So bist du privat und wir bleiben schnell.',
      'Du steuerst auf <code>/data</code> welche Quellen indiziert werden (nur Notizen, oder auch Stimmungen, Gewohnheiten, Gespräche, Dateien). „/frag &lt;Frage&gt;" durchsucht explizit, „Auto-Erinnerung" lässt den Bot bei Freitext selbst nachschauen.',
    ],
  },
  {
    id: 'telegram',
    icon: Send,
    title: 'Telegram-Bot erstellen — 3 Minuten',
    color: 'text-sky-400 bg-sky-500/10',
    paragraphs: [
      '<strong>1. BotFather öffnen:</strong> In Telegram nach „@BotFather" suchen. Das ist Telegrams offizieller Bot zum Erstellen anderer Bots. Klick „Start".',
      '<strong>2. /newbot senden:</strong> Der BotFather fragt nach einem Anzeigenamen (z.B. „Mein Earth-Bot") und einem Username, der auf „_bot" enden muss (z.B. „matti_earth_bot").',
      '<strong>3. Token kopieren:</strong> Der BotFather gibt dir eine lange Zeichenkette wie <code>8682298999:AAFJujeK92ZsA4UqtledWtIkV--njrWQjZQ</code>. Das ist dein Bot-Token. Sicher aufbewahren — wer ihn hat, kann den Bot steuern.',
      '<strong>4. In Earth 0.1 einfügen:</strong> Geh auf <a href="/keys" class="text-nebula-400 underline">/keys</a>, finde den Bereich „Telegram", füge den Token ein und klick „Verbinden". Wir setzen den Webhook automatisch.',
      '<strong>5. Bot starten:</strong> Öffne deinen neuen Bot in Telegram, klick „Start". Ab jetzt versteht er alle Skills, die du im Tech-Baum freigeschaltet hast.',
    ],
  },
]

/* ───────────────────────────────────────────────
   Sub-Komponenten
   ─────────────────────────────────────────────── */

function TopicCard({ topic, isOpen, onToggle }) {
  const Icon = topic.icon
  return (
    <div className="border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 sm:p-6 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.02] transition"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${topic.color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-display text-white font-bold text-base sm:text-lg flex-1 m-0">{topic.title}</h3>
        <ChevronDown className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-5 sm:px-6 pb-6">
          <div className="space-y-3 text-gray-300 text-sm sm:text-base leading-relaxed">
            {topic.paragraphs.map((p, i) => (
              <p key={i} dangerouslySetInnerHTML={{ __html: p }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PathCard({ path }) {
  const Icon = path.icon
  return (
    <div className={`p-5 rounded-2xl border bg-gradient-to-br ${path.color}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon className="w-6 h-6 text-white" />
        <h3 className="font-display text-white font-bold text-lg m-0">{path.title}</h3>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed mb-3">{path.desc}</p>
      <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/10">
        {path.skills.map(s => (
          <span key={s} className="text-xs px-2 py-1 rounded-md bg-white/10 text-gray-200">{s}</span>
        ))}
      </div>
    </div>
  )
}

function GlossaryItem({ entry }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-white/10 rounded-xl bg-white/[0.02]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left bg-transparent border-none cursor-pointer hover:bg-white/[0.03] transition rounded-xl"
      >
        <span className="text-2xl shrink-0">{entry.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm">{entry.key}</div>
          {!open && <div className="text-xs text-gray-500 truncate">{entry.short_desc}</div>}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-sm text-gray-300 leading-relaxed">{entry.short_desc}</p>
          {entry.example && (
            <div className="text-xs text-gray-400 bg-black/30 rounded-md px-2 py-1.5 font-mono">
              Beispiel: {entry.example}
            </div>
          )}
          {Array.isArray(entry.related) && entry.related.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {entry.related.map(r => (
                <span key={r} className="text-[10px] px-2 py-0.5 rounded-full bg-nebula-500/10 text-nebula-300 border border-nebula-500/20">
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CATEGORY_LABELS = {
  basics: 'Web & APIs',
  llm: 'Sprachmodelle',
  sicherheit: 'Sicherheit',
  automation: 'Automation',
  spielerei: 'Sonstiges',
}

/* ───────────────────────────────────────────────
   Hauptseite
   ─────────────────────────────────────────────── */

export default function Knowledge() {
  const [openTopics, setOpenTopics] = useState(new Set(['platform']))
  const [glossary, setGlossary] = useState([])
  const [glossaryFilter, setGlossaryFilter] = useState('all')
  const [glossarySearch, setGlossarySearch] = useState('')

  useEffect(() => {
    fetchGlossary().then(setGlossary).catch(() => setGlossary([]))
  }, [])

  const toggleTopic = (id) => {
    setOpenTopics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredGlossary = glossary
    .filter(e => glossaryFilter === 'all' || e.category === glossaryFilter)
    .filter(e => {
      if (!glossarySearch) return true
      const q = glossarySearch.toLowerCase()
      return e.key.toLowerCase().includes(q) || e.short_desc.toLowerCase().includes(q)
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  const categories = ['all', ...new Set(glossary.map(e => e.category))]

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <BookOpen className="w-4 h-4" /> Wissen
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Verstehen, was du tust
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Hintergrund-Wissen zu allem, was im Tech-Baum vorkommt. Keine Vorkenntnisse nötig,
          keine Werbung, keine Anmeldung. Lies in der Reihenfolge die dich interessiert.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-8">
          <Link
            to="/tech-tree"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition"
          >
            <Network className="w-4 h-4" /> Direkt zum Tech-Baum
          </Link>
          <Link
            to="/keys"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 text-white rounded-xl font-display font-semibold no-underline border border-white/10 hover:bg-white/10 transition"
          >
            <Key className="w-4 h-4" /> Keys einrichten
          </Link>
        </div>
      </div>

      {/* ── 1. Die Themen-Pfade ── */}
      <section className="mb-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl sm:text-3xl font-bold m-0">Die sieben Lernpfade</h2>
            <p className="text-gray-500 text-sm">Jeder Pfad enthält 2-6 Fähigkeiten, die zusammenpassen</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PATHS.map(p => <PathCard key={p.id} path={p} />)}
        </div>
      </section>

      {/* ── 2. Themen-Erklärungen (akkordeon) ── */}
      <section className="mb-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl sm:text-3xl font-bold m-0">Die wichtigsten Konzepte</h2>
            <p className="text-gray-500 text-sm">Klick auf ein Thema, um es aufzuklappen</p>
          </div>
        </div>
        <div className="space-y-3">
          {TOPICS.map(t => (
            <TopicCard
              key={t.id}
              topic={t}
              isOpen={openTopics.has(t.id)}
              onToggle={() => toggleTopic(t.id)}
            />
          ))}
        </div>
      </section>

      {/* ── 3. Free-Tier-Provider ── */}
      <section className="mb-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl sm:text-3xl font-bold m-0">Gratis-API-Provider</h2>
            <p className="text-gray-500 text-sm">Hier holst du dir die Keys, die wir empfehlen</p>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Anbieter</th>
                <th className="text-left px-4 py-3 font-medium">Key-Format</th>
                <th className="text-left px-4 py-3 font-medium">Free-Limit</th>
                <th className="text-left px-4 py-3 font-medium">Wofür</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map(p => (
                <tr key={p.name} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-nebula-400 hover:text-nebula-300 font-medium no-underline inline-flex items-center gap-1">
                      {p.name} <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.prefix}</td>
                  <td className="px-4 py-3 text-gray-300">{p.free}</td>
                  <td className="px-4 py-3 text-gray-400">{p.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300 leading-relaxed">
              <strong className="text-blue-300">Wichtig:</strong> Du brauchst nicht alle Keys. Für den Anfang reicht <em>einer</em> der Sprachmodell-Provider (Groq oder NVIDIA). Hugging Face und Resend kannst du später ergänzen, wenn du die entsprechenden Skills freischaltest.
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Glossar ── */}
      <section className="mb-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl sm:text-3xl font-bold m-0">Glossar</h2>
            <p className="text-gray-500 text-sm">{glossary.length} Begriffe aus der KI- und Web-Welt</p>
          </div>
        </div>

        {/* Filter + Suche */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Begriff suchen..."
            value={glossarySearch}
            onChange={e => setGlossarySearch(e.target.value)}
            className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-nebula-500/50"
          />
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setGlossaryFilter(c)}
                className={`px-3 py-2 rounded-xl text-xs border transition ${
                  glossaryFilter === c
                    ? 'bg-nebula-500/20 text-nebula-200 border-nebula-500/40'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {c === 'all' ? 'Alle' : (CATEGORY_LABELS[c] ?? c)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {filteredGlossary.map(e => <GlossaryItem key={e.key} entry={e} />)}
          {filteredGlossary.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12 text-sm">
              Keine Begriffe gefunden.
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Weiterlesen ── */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="font-display text-white text-2xl sm:text-3xl font-bold m-0">Weiterlesen</h2>
            <p className="text-gray-500 text-sm">Wenn dich ein Thema gepackt hat</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Was ist ein LLM? — Wikipedia', url: 'https://de.wikipedia.org/wiki/Large_Language_Model' },
            { label: 'REST-APIs erklärt — MDN', url: 'https://developer.mozilla.org/de/docs/Glossary/REST' },
            { label: 'JSON Spezifikation', url: 'https://www.json.org/json-de.html' },
            { label: 'Telegram Bot API — Offizielle Docs', url: 'https://core.telegram.org/bots' },
            { label: 'Hugging Face — Modelle ausprobieren', url: 'https://huggingface.co/models' },
            { label: 'Cron-Syntax interaktiv', url: 'https://crontab.guru/' },
            { label: 'HaveIBeenPwned — Passwort prüfen', url: 'https://haveibeenpwned.com/' },
            { label: 'Supabase Docs — Was wir nutzen', url: 'https://supabase.com/docs' },
          ].map(l => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] hover:border-white/20 transition no-underline group"
            >
              <span className="text-gray-300 text-sm group-hover:text-white">{l.label}</span>
              <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-nebula-400 shrink-0" />
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center pt-8 border-t border-white/5">
        <h3 className="font-display text-2xl font-bold text-white mb-3">Genug gelesen?</h3>
        <p className="text-gray-400 mb-6">Such dir eine Fähigkeit, die dich neugierig macht, und probier sie aus.</p>
        <Link
          to="/tech-tree"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nebula-500 to-blue-600 text-white rounded-xl font-display font-semibold no-underline hover:shadow-lg hover:shadow-nebula-500/25 transition"
        >
          <Network className="w-4 h-4" /> Zum Tech-Baum
        </Link>
      </section>
    </div>
  )
}
