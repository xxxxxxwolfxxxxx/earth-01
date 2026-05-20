import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { supabase } from '../lib/supabase'

const EARTH_NIGHT = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const BUMP_TEXTURE = '//unpkg.com/three-globe/example/img/earth-topology.png'

const RING_LIFETIME_MS = 8000

export default function LiveEarth({ height = 900 }) {
  const globeRef = useRef()
  const [users, setUsers] = useState([])
  const [rings, setRings] = useState([])

  // Initial: reale User-Standorte + Demo-Locations
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('profiles')
        .select('home_lat, home_lon, home_city')
        .not('home_lat', 'is', null).not('home_lon', 'is', null),
      supabase.from('demo_locations').select('lat, lon, city').eq('active', true),
    ]).then(([profiles, demos]) => {
      if (cancelled) return
      const real = (profiles.data ?? []).map((p, i) => ({
        id: `real-${i}`, lat: p.home_lat, lng: p.home_lon, city: p.home_city ?? '', kind: 'real',
      }))
      const demo = (demos.data ?? []).map((d, i) => ({
        id: `demo-${i}`, lat: d.lat, lng: d.lon, city: d.city, kind: 'demo',
      }))
      setUsers([...real, ...demo])
    })
    return () => { cancelled = true }
  }, [])

  // Realtime auf agent_activity
  useEffect(() => {
    const channel = supabase
      .channel('live-earth-' + Date.now())
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_activity' },
        (payload) => {
          const a = payload.new
          if (a.lat == null || a.lon == null) return
          const id = `ring-${a.id}-${Date.now()}`
          setRings(prev => [...prev, { id, lat: Number(a.lat), lng: Number(a.lon) }])
          setTimeout(() => setRings(prev => prev.filter(r => r.id !== id)), RING_LIFETIME_MS)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.35
    g.controls().enableZoom = false
    g.controls().enablePan = false
    g.pointOfView({ lat: 25, lng: 10, altitude: 2.2 }, 0)
  }, [])

  // Responsive: Width an Viewport binden
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { w: 900, h: height }
    const w = Math.min(window.innerWidth, 1400)
    return { w, h: Math.min(window.innerHeight * 0.85, height) }
  })
  useEffect(() => {
    const onResize = () => setSize({
      w: Math.min(window.innerWidth, 1400),
      h: Math.min(window.innerHeight * 0.85, height),
    })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [height])

  return (
    <div className="relative pointer-events-none select-none">
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={EARTH_NIGHT}
        bumpImageUrl={BUMP_TEXTURE}
        atmosphereColor="#5599ff"
        atmosphereAltitude={0.22}

        pointsData={users}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.005}
        pointColor={(d) => d.kind === 'real' ? '#fcd34d' : '#fde68a'}
        pointRadius={0.2}
        pointResolution={6}
        pointLabel={(d) => `<div style="color:#fff;font-family:Inter,sans-serif;padding:4px 8px;background:rgba(0,0,0,0.75);border-radius:6px;border:1px solid rgba(255,255,255,0.15);font-size:12px">📍 ${d.city}</div>`}

        ringsData={rings}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(255, 220, 100, ${1 - t})`}
        ringMaxRadius={5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={1000}
        ringAltitude={0.01}
      />
    </div>
  )
}
