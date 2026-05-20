import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Globe from 'react-globe.gl'
import { supabase } from '../lib/supabase'
import { bodyScenePosition, sunUnitDirection } from '../lib/ephemeris'

const EARTH_DAY   = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_NIGHT = '//unpkg.com/three-globe/example/img/earth-night.jpg'
// NASA Tycho Skymap — Equirectangular Projection des Sternkatalogs.
// Mit echten Konstellationen, kalibriert zur Himmelskugel.
const STAR_BG     = 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/TychoSkymap.t4_04096x02048.jpg'

const RING_LIFETIME_MS = 8000

// Visuelle Distanzen in Szenen-Einheiten (Erde-Radius = 100).
// Real-Distanzen ignoriert, weil sonst Mond ~6000 / Venus ~40000.
const DIST = {
  Moon:    250,
  Mercury: 700,
  Venus:   620,
  Mars:    760,
  Jupiter: 920,
  Saturn:  1050,
}

// Visuelle Größe + Farbe der Himmelskörper.
const BODY_STYLE = {
  Moon:    { radius: 18, color: 0xfdf5d3, emissive: 0xaa9966, emi: 0.5, halo: 22, haloAlpha: 0.12 },
  Mercury: { radius: 5,  color: 0xb5a394, emissive: 0x554840, emi: 0.4, halo: 8,  haloAlpha: 0.10 },
  Venus:   { radius: 9,  color: 0xfff2cc, emissive: 0xb09060, emi: 0.6, halo: 14, haloAlpha: 0.18 },
  Mars:    { radius: 6,  color: 0xff7a3d, emissive: 0xaa3a10, emi: 0.5, halo: 10, haloAlpha: 0.12 },
  Jupiter: { radius: 10, color: 0xe8d3a8, emissive: 0x8a7050, emi: 0.4, halo: 14, haloAlpha: 0.12 },
  Saturn:  { radius: 9,  color: 0xddc18b, emissive: 0x806840, emi: 0.4, halo: 14, haloAlpha: 0.12 },
}

function makeBodyMesh(name) {
  const s = BODY_STYLE[name]
  const group = new THREE.Group()
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(s.radius, 32, 32),
    new THREE.MeshStandardMaterial({
      color: s.color, emissive: s.emissive, emissiveIntensity: s.emi,
      roughness: 0.65, metalness: 0.0,
    }),
  ))
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(s.halo, 24, 24),
    new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.haloAlpha, depthWrite: false }),
  ))
  return group
}

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vUv = uv;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform vec3 sunDir;
varying vec2 vUv;
varying vec3 vWorldNormal;
void main() {
  vec3 day   = texture2D(dayMap,   vUv).rgb;
  vec3 night = texture2D(nightMap, vUv).rgb;
  float cosA = dot(normalize(vWorldNormal), normalize(sunDir));
  float blend = smoothstep(-0.12, 0.12, cosA);
  vec3 dayLit   = day * (max(cosA, 0.0) * 0.75 + 0.25);
  vec3 nightLit = night * 0.95;
  gl_FragColor = vec4(mix(nightLit, dayLit, blend), 1.0);
}
`

export default function LiveEarth({ height = 900 }) {
  const globeRef = useRef()
  const [users, setUsers] = useState([])
  const [rings, setRings] = useState([])

  const { earthMaterial, sunUniformRef } = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const sunUniform = { value: sunUnitDirection(new Date()) }
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap:   { value: loader.load(EARTH_DAY) },
        nightMap: { value: loader.load(EARTH_NIGHT) },
        sunDir:   sunUniform,
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    })
    return { earthMaterial: mat, sunUniformRef: sunUniform }
  }, [])

  // Sun-Uniform alle 60s aktualisieren
  useEffect(() => {
    const tick = () => { sunUniformRef.value = sunUnitDirection(new Date()) }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [sunUniformRef])

  // User + Demo-Standorte laden
  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase.from('profiles').select('home_lat, home_lon, home_city')
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

  // Scene: Sonne, Mond, Planeten, alle an ECHTEN Positionen
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const scene = g.scene()

    // ── Sun-Light (für Mond/Planeten-Beleuchtung) ──
    const sunPos = bodyScenePosition('Sun', new Date(), 800).position
    const sunLight = new THREE.DirectionalLight(0xfff2cc, 1.4)
    sunLight.position.copy(sunPos)
    scene.add(sunLight)

    const ambient = new THREE.AmbientLight(0x223355, 0.12)
    scene.add(ambient)

    // ── Visible Sun: gelber Glow ──
    const sunGlow = new THREE.Group()
    sunGlow.add(new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.85 }),
    ))
    sunGlow.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff5bb, transparent: true, opacity: 0.18, depthWrite: false }),
    ))
    sunGlow.position.copy(sunPos)
    scene.add(sunGlow)

    // ── Körper an realen Positionen ──
    const bodyMeshes = {}
    const allBodies = ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']
    for (const name of allBodies) {
      const m = makeBodyMesh(name)
      const p = bodyScenePosition(name, new Date(), DIST[name]).position
      m.position.copy(p)
      scene.add(m)
      bodyMeshes[name] = m
    }

    // Positionen alle 60 Sekunden updaten
    const updatePositions = () => {
      const now = new Date()
      const sp = bodyScenePosition('Sun', now, 800).position
      sunLight.position.copy(sp)
      sunGlow.position.copy(sp)
      for (const name of allBodies) {
        const p = bodyScenePosition(name, now, DIST[name]).position
        bodyMeshes[name].position.copy(p)
      }
    }
    const positionId = setInterval(updatePositions, 60_000)

    // Camera + Auto-Rotate
    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.35
    g.controls().enableZoom = false
    g.controls().enablePan = false
    g.pointOfView({ lat: 25, lng: 10, altitude: 2.2 }, 0)

    return () => {
      clearInterval(positionId)
      scene.remove(sunLight, ambient, sunGlow)
      for (const m of Object.values(bodyMeshes)) scene.remove(m)
    }
  }, [])

  // Responsive
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
        showAtmosphere={true}
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
