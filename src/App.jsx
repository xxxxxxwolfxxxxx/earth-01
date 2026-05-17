import { Routes, Route } from 'react-router-dom'
import Starfield from './components/Starfield'
import Navigation from './components/Navigation'
import Footer from './components/Footer'
import Home from './pages/Home'
import Knowledge from './pages/Knowledge'
import Configurator from './pages/Configurator'
import World from './pages/World'

export default function App() {
  return (
    <>
      <Starfield />
      <Navigation />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wissen" element={<Knowledge />} />
          <Route path="/konfigurator" element={<Configurator />} />
          <Route path="/welt" element={<World />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
