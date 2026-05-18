import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WorldProvider } from './contexts/WorldContext'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import Configurator from './pages/Configurator'
import World from './pages/World'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AuthProvider>
      <WorldProvider>
        {!isHome && <Starfield />}
        <Navigation />
        <main className="min-h-screen">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wissen" element={<Knowledge />} />
            <Route path="/konfigurator" element={<Configurator />} />
            <Route path="/welt" element={<World />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
          </Routes>
        </main>
        <Footer />
      </WorldProvider>
    </AuthProvider>
  )
}
