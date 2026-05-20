import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { supabase } from '../lib/supabase'

// Earth-Texturen: NASA Black Marble (Night) + Topology Bumps für 3D-Gefühl.
// Quelle: react-globe.gl Beispiele, CDN-hosted.
const EARTH_NIGHT = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const BUMP_TEXTURE = '//unpkg.com/three-globe/example/img/earth-topology.png'

// Punkte verblassen nach 8 Sekunden — danach werden sie aus dem Ringe-Array entfernt.
const RING_LIFETIME_MS = 8000

export default function LiveEarth({ height = 500 }) {
  const globeRef = useRef()
  const [users, setUsers] = useState([])      // pointsData: alle User mit Standort
  const [rings, setRings] = useState([])      // ringsData: aktive Pulses

  // Initiale Standort-Daten laden
  useEffect(() => {
    let cancelled = false
    supabase
      .from('profiles')
      .select('home_lat, home_lon, home_city')
      .not('home_lat', 'is', null)
      .not('home_lon', 'is', null)
      .then(({ data }) => {
        if (cancelled || !data) return
        // Anonymisieren: nur Koordinaten + city, keine User-ID
        const points = data.map((p, i) => ({
          id: `static-${i}`,
          lat: p.home_lat,
          lng: p.home_lon,
          city: p.home_city ?? '',
        }))
        setUsers(points)
      })
    return () => { cancelled = true }
  }, [])

  // Realtime-Subscription auf agent_activity
  useEffect(() => {
    const channel = supabase
      .channel('live-earth-' + Date.now())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_activity' },
        (payload) => {
          const a = payload.new
          if (a.lat == null || a.lon == null) return
          const id = `ring-${a.id}-${Date.now()}`
          setRings(prev => [...prev, {
            id, lat: Number(a.lat), lng: Number(a.lon), skill: a.skill_id,
          }])
          // Auto-Cleanup
          setTimeout(() => {
            setRings(prev => prev.filter(r => r.id !== id))
          }, RING_LIFETIME_MS)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Auto-Rotation der Globe-Kamera
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.3
    g.controls().enableZoom = false
    g.controls().enablePan = false
    // Initiale Kamera-Position: leicht von oben für besseren Blick
    g.pointOfView({ lat: 30, lng: 10, altitude: 2.5 }, 0)
  }, [])

  // Responsive Width
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 800)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const globeWidth = Math.min(width, 1000)

  return (
    <div className="relative pointer-events-none select-none" style={{ height }}>
      <Globe
        ref={globeRef}
        width={globeWidth}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={EARTH_NIGHT}
        bumpImageUrl={BUMP_TEXTURE}
        atmosphereColor="#4488ff"
        atmosphereAltitude={0.18}

        // Statische Punkte (User mit Standort)
        pointsData={users}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.005}
        pointColor={() => '#fcd34d'}
        pointRadius={0.18}
        pointResolution={6}
        pointLabel={(d) => `<div style="color:#fff;font-family:Inter,sans-serif;padding:4px 8px;background:rgba(0,0,0,0.7);border-radius:6px;border:1px solid rgba(255,255,255,0.1);font-size:12px">📍 ${d.city || 'Earth-User'}</div>`}

        // Aktivitäts-Rings (Live-Pulse)
        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(255, 220, 100, ${1 - t})`}
        ringMaxRadius={5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={1000}
        ringAltitude={0.01}
      />
      {/* Live-Counter Overlay */}
      <div className="absolute bottom-3 left-3 text-[10px] text-white/40 font-mono pointer-events-none">
        {users.length} aktive Earth-Bewohner · {rings.length > 0 && <span className="text-yellow-300">{rings.length} live</span>}
      </div>
    </div>
  )
}
