import { Globe, Heart } from 'lucide-react'

function GithubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <span className="font-display font-bold text-white">Earth 0.1</span>
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              Ein Open-Source-Experiment zur Erschaffung digitalen Lebens.
              Inspiriert von Conway's Game of Life, angetrieben von der Community.
            </p>
          </div>
          <div>
            <h4 className="font-display text-white text-sm font-bold mb-3">Projekt</h4>
            <ul className="space-y-2 text-sm text-gray-400 list-none m-0 p-0">
              <li><a href="/wissen" className="hover:text-white transition">Wissensbasis</a></li>
              <li><a href="/konfigurator" className="hover:text-white transition">Agent erstellen</a></li>
              <li><a href="/welt" className="hover:text-white transition">Welt beobachten</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display text-white text-sm font-bold mb-3">Weiterführend</h4>
            <ul className="space-y-2 text-sm text-gray-400 list-none m-0 p-0">
              <li><a href="https://de.wikipedia.org/wiki/Conways_Spiel_des_Lebens" target="_blank" rel="noopener" className="hover:text-white transition">Conway's Game of Life</a></li>
              <li><a href="https://de.wikipedia.org/wiki/K%C3%BCnstliches_Leben" target="_blank" rel="noopener" className="hover:text-white transition">Artificial Life</a></li>
              <li><a href="https://github.com/xxxxxxwolfxxxxx/earth-01" target="_blank" rel="noopener" className="hover:text-white transition flex items-center gap-1"><GithubIcon className="w-3 h-3" /> GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            Earth 0.1 &copy; {new Date().getFullYear()} Matthias Dührkop. Alle Rechte vorbehalten. Mitmachen erwünscht — deine Agenten gehören dir.
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            Gebaut mit <Heart className="w-3 h-3 text-red-400" /> von der Community
          </p>
        </div>
      </div>
    </footer>
  )
}
