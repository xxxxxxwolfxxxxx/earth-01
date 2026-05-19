import { useState } from 'react'
import { ScrollText, GitBranch, Trophy, Settings2 } from 'lucide-react'
import FamilyTreePanel from '../components/chronik/FamilyTreePanel'
import ChronicleListPanel from '../components/chronik/ChronicleListPanel'
import ToolsPanel from '../components/chronik/ToolsPanel'
import AchievementGrid from '../components/AchievementGrid'

const TABS = [
  { id: 'tree', label: 'Stammbaum', icon: GitBranch },
  { id: 'chronicle', label: 'Chronik', icon: ScrollText },
  { id: 'achievements', label: 'Erfolge', icon: Trophy },
  { id: 'tools', label: 'Tools', icon: Settings2 },
]

export default function Chronik() {
  const [tab, setTab] = useState('tree')

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-nebula-500/10 border border-nebula-500/20 text-nebula-400 text-sm mb-4">
          <ScrollText className="w-4 h-4" /> Familien-Chronik
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
          Deine Dynastie
        </h1>
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 flex items-center gap-2 text-sm border-b-2 transition whitespace-nowrap ${
                active
                  ? 'border-nebula-400 text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'tree' && <FamilyTreePanel />}
        {tab === 'chronicle' && <ChronicleListPanel />}
        {tab === 'achievements' && <AchievementGrid />}
        {tab === 'tools' && <ToolsPanel />}
      </div>
    </div>
  )
}
