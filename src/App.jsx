import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import OnboardingBanner from './components/OnboardingBanner'

// Eager (klein, immer gebraucht):
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import AuthCloudCallback from './pages/AuthCloudCallback'

// Lazy (groß oder selten besucht — eigene Chunks):
const Home       = lazy(() => import('./pages/Home'))         // wegen LiveEarth (three.js + astronomy-engine + react-globe.gl)
const Knowledge  = lazy(() => import('./pages/Knowledge'))
const TechTree   = lazy(() => import('./pages/TechTree'))
const Lesson     = lazy(() => import('./pages/Lesson'))
const Keys       = lazy(() => import('./pages/Keys'))
const Provider   = lazy(() => import('./pages/Provider'))
const Data       = lazy(() => import('./pages/Data'))
const ErdeLernt  = lazy(() => import('./pages/ErdeLernt'))
const BotProfile = lazy(() => import('./pages/BotProfile'))

function PageFallback() {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-32 text-center text-gray-400">
      <div className="inline-block w-6 h-6 border-2 border-nebula-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <AuthProvider>
      {!isHome && <Starfield />}
      <Navigation />
      <OnboardingBanner />
      <main className="min-h-screen">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wissen" element={<Knowledge />} />
            <Route path="/tech-tree" element={<TechTree />} />
            <Route path="/lesson/:skillId" element={<Lesson />} />
            <Route path="/keys" element={<Keys />} />
            <Route path="/provider" element={<Provider />} />
            <Route path="/login" element={<Login />} />
            <Route path="/data" element={<Data />} />
            <Route path="/bot" element={<BotProfile />} />
            <Route path="/erde-lernt" element={<ErdeLernt />} />
            <Route path="/erde-lernt/:slug" element={<ErdeLernt />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/cloud-callback" element={<AuthCloudCallback />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </AuthProvider>
  )
}
