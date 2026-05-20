import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import TechTree from './pages/TechTree'
import Lesson from './pages/Lesson'
import Keys from './pages/Keys'

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AuthProvider>
      {!isHome && <Starfield />}
      <Navigation />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wissen" element={<Knowledge />} />
          <Route path="/tech-tree" element={<TechTree />} />
          <Route path="/lesson/:skillId" element={<Lesson />} />
          <Route path="/keys" element={<Keys />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  )
}
