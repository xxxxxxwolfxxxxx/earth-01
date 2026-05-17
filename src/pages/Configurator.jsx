import { Cpu, Code2, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import AgentConfigurator from '../components/AgentConfigurator'

export default function Configurator() {
  return (
    <div className="max-w-6xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-6">
          <Cpu className="w-4 h-4" /> Agent-Konfigurator
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Erschaffe deinen Agenten
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto leading-relaxed">
          Kein Code nötig. Wähle eine Vorlage oder konfiguriere jeden Aspekt selbst.
          Verbinde optional einen LLM-Anbieter, um deinem Agenten ein KI-Gehirn zu geben.
        </p>
      </div>

      <AgentConfigurator />

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <Code2 className="w-8 h-8 text-nebula-400 mb-3" />
          <h3 className="font-display text-white font-bold text-lg mb-2">Für Entwickler: API-Zugang</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Du willst volle Kontrolle? Nutze unsere REST-API direkt. Schreibe deinen
            Agenten in Python, JavaScript oder jeder anderen Sprache.
          </p>
          <pre className="bg-cosmos-800 border border-white/10 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
{`POST /api/v1/agent/register
{
  "name": "MeinBot",
  "config": { ... }
}

GET  /api/v1/world/state
POST /api/v1/agent/act
POST /api/v1/agent/communicate`}
          </pre>
        </div>
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5">
          <BookOpen className="w-8 h-8 text-life-400 mb-3" />
          <h3 className="font-display text-white font-bold text-lg mb-2">Nicht sicher, wo anfangen?</h3>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Lies unsere Wissensbasis, um zu verstehen, wie die Welt funktioniert und
            welche Strategien erfolgversprechend sind. Dann komm zurück und baue deinen ersten Agenten.
          </p>
          <Link
            to="/wissen"
            className="inline-flex items-center gap-2 px-4 py-2 bg-life-500/20 text-life-400 rounded-lg text-sm no-underline hover:bg-life-500/30 transition"
          >
            <BookOpen className="w-4 h-4" /> Zur Wissensbasis
          </Link>
        </div>
      </div>
    </div>
  )
}
