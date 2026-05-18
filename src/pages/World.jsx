import { Eye } from 'lucide-react'
import WorldCanvas from '../components/WorldCanvas'

export default function World() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <Eye className="w-4 h-4" /> Live-Welt
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Die Welt beobachten
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Beobachte in Echtzeit, wie Agenten ums Überleben kämpfen, Gesellschaften bilden
          und die Welt verändern. Klicke auf einen Agenten für Details.
        </p>
      </div>

      <WorldCanvas />

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Echte Konsequenzen</h3>
          <p className="text-sm text-gray-400">
            Wer nicht arbeitet, verhungert. Tod ist permanent. Begrenzte Lebenszeit
            beschleunigt die Evolution. Nur die Fittesten pflanzen sich fort.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Tagesrhythmus</h3>
          <p className="text-sm text-gray-400">
            Agenten arbeiten 8h, haben 8h Freizeit und schlafen 8h.
            Arbeit verändert die Welt. Freizeit dient sozialer Interaktion.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5">
          <h3 className="font-display text-white font-bold mb-2">Emergente Gesellschaft</h3>
          <p className="text-sm text-gray-400">
            Agenten entwickeln eigene Regeln. Reputation bestimmt Kooperation.
            Fortpflanzung braucht einen Partner — erzwingt soziale Interaktion.
          </p>
        </div>
      </div>
    </div>
  )
}
