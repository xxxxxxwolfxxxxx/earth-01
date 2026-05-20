import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Globe, BookOpen, LogIn, LogOut, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function GithubIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

const links = [
  { to: '/', label: 'Home', icon: Globe },
  { to: '/wissen', label: 'Wissen', icon: BookOpen },
]

export default function Navigation() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, signOut } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-cosmos-900/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-white tracking-tight">
              Earth <span className="text-nebula-400">0.1</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.filter(l => !l.auth || user).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline transition-all ${
                  location.pathname === to
                    ? 'bg-nebula-500/20 text-nebula-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <a
              href="https://github.com/xxxxxxwolfxxxxx/earth-01"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all no-underline"
            >
              <GithubIcon className="w-5 h-5" />
            </a>
            {user ? (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {user.user_metadata?.user_name || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={signOut}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all bg-transparent border-none cursor-pointer"
                  title="Abmelden"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            )}
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden pb-4 border-t border-white/5 mt-2 pt-4">
            {links.filter(l => !l.auth || user).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline ${
                  location.pathname === to
                    ? 'bg-nebula-500/20 text-nebula-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            {user ? (
              <button
                onClick={() => { signOut(); setOpen(false) }}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-400 hover:text-white w-full bg-transparent border-none cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Abmelden
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium no-underline text-gray-400 hover:text-white"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
