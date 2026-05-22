import { Globe, Heart, Network, BookOpen, Key, Sparkles } from 'lucide-react'

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
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-white">Earth 0.1</span>
            </div>
            <p className="text-sm text-gray-400 max-w-md leading-relaxed">
              Lernspiel über KI, Agenten und das Internet. Du klickst dich durch einen Tech-Baum,
              verstehst nebenbei wie KI funktioniert und schaltest dabei echte Werkzeuge frei,
              die dein Telegram-Bot für dich nutzt.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
              <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Code einsehbar</span>
              <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">Free Tier</span>
              <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">Mobile-first</span>
            </div>
          </div>

          {/* Plattform */}
          <div>
            <h4 className="font-display text-white text-sm font-bold mb-3">Plattform</h4>
            <ul className="space-y-2 text-sm text-gray-400 list-none m-0 p-0">
              <li><a href="/tech-tree" className="hover:text-white transition flex items-center gap-1.5"><Network className="w-3.5 h-3.5" /> Tech-Baum</a></li>
              <li><a href="/wissen" className="hover:text-white transition flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Wissen</a></li>
              <li><a href="/provider" className="hover:text-white transition flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Anbieter</a></li>
              <li><a href="/keys" className="hover:text-white transition flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> Schlüssel</a></li>
            </ul>
          </div>

          {/* Weiterführend */}
          <div>
            <h4 className="font-display text-white text-sm font-bold mb-3">Weiterführend</h4>
            <ul className="space-y-2 text-sm text-gray-400 list-none m-0 p-0">
              <li>
                <a href="https://github.com/xxxxxxwolfxxxxx/earth-01" target="_blank" rel="noopener noreferrer" className="hover:text-white transition flex items-center gap-1.5">
                  <GithubIcon className="w-3.5 h-3.5" /> GitHub
                </a>
              </li>
              <li>
                <a href="https://core.telegram.org/bots" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Telegram Bot API
                </a>
              </li>
              <li>
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Supabase
                </a>
              </li>
              <li>
                <a href="https://crontab.guru" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">
                  Cron-Syntax
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Rechtliches */}
        <div className="border-t border-white/5 mt-8 pt-6 flex flex-wrap gap-x-5 gap-y-2 justify-center">
          <a href="/impressum" className="text-xs text-gray-400 hover:text-white transition">Impressum</a>
          <a href="/datenschutz" className="text-xs text-gray-400 hover:text-white transition">Datenschutz</a>
          <a href="/agb" className="text-xs text-gray-400 hover:text-white transition">Nutzungsbedingungen</a>
        </div>

        <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            Earth 0.1 &copy; {new Date().getFullYear()} Matthias Dührkop ·
            Daten bleiben bei dir · Affiliate-Links sind <span className="text-amber-300/80">markiert</span>
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            Gebaut mit <Heart className="w-3 h-3 text-red-400" /> für Neugierige
          </p>
        </div>
      </div>
    </footer>
  )
}
