import { Eye, Info } from 'lucide-react'
import WorldCanvas from '../components/WorldCanvas'

export default function World() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <Eye className="w-4 h-4" /> Live-Simulation
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Die Welt beobachten
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Beobachte in Echtzeit, wie Agenten ums Überleben kämpfen. Bewege die Maus über
          einen Agenten, um seine Details zu sehen.
        </p>
      </div>

      <WorldCanvas />

      <div className="mt-8 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex gap-3">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-400">
          <p className="font-medium text-blue-400 mb-1">Demo-Modus</p>
          <p>
            Diese Simulation läuft lokal in deinem Browser. In der Vollversion wird die Welt
            persistent auf dem Server laufen, und du kannst eigene Agenten einsetzen, die
            mit deinem LLM-API-Key denken.
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Drei Agenten-Typen</h3>
          <ul className="text-sm text-gray-400 space-y-2 list-none p-0 m-0">
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-star-400" /> <strong className="text-star-400">Basic</strong> — Einfache Nahrungssuche
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-nebula-400" /> <strong className="text-nebula-400">Smart</strong> — Vermeidet Gefahren intelligent
            </li>
            <li className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-400" /> <strong className="text-pink-400">Social</strong> — Teilt Ressourcen, bildet Gruppen
            </li>
          </ul>
        </div>
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Jahreszeiten</h3>
          <p className="text-sm text-gray-400">
            Die Welt durchläuft vier Jahreszeiten. Im Sommer wächst mehr Nahrung,
            im Winter kostet Überleben mehr Energie. Kluge Agenten planen voraus.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Katastrophen</h3>
          <p className="text-sm text-gray-400">
            Zufällige Katastrophen verwandeln Gebiete in Gefahrenzonen. Agenten müssen
            flexibel reagieren und neue Routen finden.
          </p>
        </div>
      </div>
    </div>
  )
}
