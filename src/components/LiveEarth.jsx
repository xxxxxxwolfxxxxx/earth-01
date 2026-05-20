import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Globe from 'react-globe.gl'
import { supabase } from '../lib/supabase'

const EARTH_DAY     = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_NIGHT   = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const BUMP_TEXTURE  = '//unpkg.com/three-globe/example/img/earth-topology.png'
const SPECULAR_MAP  = '//unpkg.com/three-globe/example/img/earth-water.png'
const STAR_BG       = '//unpkg.com/three-globe/example/img/night-sky.png'

const RING_LIFETIME_MS = 8000

export default function LiveEarth({ height = 900 }) {
  const globeRef = useRef()
  const [users, setUsers] = useState([])
  const [rings, setRings] = useState([])

  // Material mit Tag-Textur + sanftem Glanz auf den Ozeanen
  const earthMaterial = useMemo(() => {
    const loader = new THREE.TextureLoader()
    return new THREE.MeshPhongMaterial({
      map:         loader.load(EARTH_DAY),
      bumpMap:     loader.load(BUMP_TEXTURE),
      bumpScale:   0.6,
      specularMap: loader.load(SPECULAR_MAP),
      specular:    new THREE.Color('#888'),
      shininess:   12,
    })
  }, [])

  // Initial-Daten laden
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

  // Scene-Setup: Sonne (DirectionalLight), Ambient, Mond
  useEffect(() => {
    const g = globeRef.current
    if (!g) return

    // Sonne — von rechts oben. Sorgt für Tag-/Nachtgrenze auf dem Globus.
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.6)
    sun.position.set(400, 200, 350)
    g.scene().add(sun)

    // Dezentes Umgebungslicht damit Nachtseite nicht völlig schwarz ist
    const ambient = new THREE.AmbientLight(0x223355, 0.55)
    g.scene().add(ambient)

    // Mond: warm-weißes Sphäre, leicht selbstleuchtend, mit subtilem Glow
    const moonGroup = new THREE.Group()
    const moonGeo  = new THREE.SphereGeometry(18, 48, 48)
    const moonMat  = new THREE.MeshStandardMaterial({
      color: 0xfdf5d3,
      emissive: 0xaa9966,
      emissiveIntensity: 0.45,
      roughness: 0.6,
      metalness: 0.0,
    })
    const moon = new THREE.Mesh(moonGeo, moonMat)
    moonGroup.add(moon)
    // Glow-Halo
    const haloGeo = new THREE.SphereGeometry(22, 32, 32)
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfff4cf, transparent: true, opacity: 0.12, depthWrite: false,
    })
    moonGroup.add(new THREE.Mesh(haloGeo, haloMat))
    moonGroup.position.set(-320, 140, -180)
    g.scene().add(moonGroup)

    // Kamera + Auto-Rotate
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.35
    g.controls().enableZoom = false
    g.controls().enablePan = false
    g.pointOfView({ lat: 25, lng: 10, altitude: 2.2 }, 0)

    return () => {
      g.scene().remove(sun)
      g.scene().remove(ambient)
      g.scene().remove(moonGroup)
    }
  }, [])

  // Responsive Größe
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { w: 1000, h: height }
    return {
      w: Math.min(window.innerWidth, 1400),
      h: Math.min(window.innerHeight * 0.85, height),
    }
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
        backgroundImageUrl={STAR_BG}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={earthMaterial}
        atmosphereColor="#7ec8ff"
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
