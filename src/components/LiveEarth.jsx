import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Globe from 'react-globe.gl'
import { supabase } from '../lib/supabase'

const EARTH_DAY   = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_NIGHT = '//unpkg.com/three-globe/example/img/earth-night.jpg'
const STAR_BG     = '//unpkg.com/three-globe/example/img/night-sky.png'

const RING_LIFETIME_MS = 8000

// Sonnen-Position berechnen: aktuelle UTC-Zeit → Längengrad mit Solar-Noon,
// Deklination aus Tag des Jahres.
function sunDirection(date = new Date()) {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000) + 1

  const sunLng = (12 - utcHours) * 15                                     // Grad
  const sunLat = 23.45 * Math.sin(((dayOfYear - 81) * 2 * Math.PI) / 365) // Deklination

  // Konsistent zur three-globe lat/lng-zu-XYZ Konvention
  const phi   = (90 - sunLat) * Math.PI / 180
  const theta = (sunLng + 180) * Math.PI / 180
  return new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta),
  ).normalize()
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
  // Sanfter Übergang am Terminator
  float blend = smoothstep(-0.12, 0.12, cosA);

  // Tag: leicht moduliert mit Lichtwinkel
  vec3 dayLit = day * (max(cosA, 0.0) * 0.75 + 0.25);
  // Nacht: Stadtlichter, leicht abgedunkelt
  vec3 nightLit = night * 0.95;

  vec3 color = mix(nightLit, dayLit, blend);
  gl_FragColor = vec4(color, 1.0);
}
`

export default function LiveEarth({ height = 900 }) {
  const globeRef = useRef()
  const [users, setUsers] = useState([])
  const [rings, setRings] = useState([])

  // Earth-Material mit Day/Night-Shader
  const { earthMaterial, sunUniformRef } = useMemo(() => {
    const loader = new THREE.TextureLoader()
    const sunUniform = { value: sunDirection() }
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

  // Sonne wandert mit der Erddrehung: alle 60 Sekunden updaten
  useEffect(() => {
    const tick = () => { sunUniformRef.value = sunDirection() }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [sunUniformRef])

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

  // Realtime-Pulse
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

  // Scene-Setup: Sonnen-DirectionalLight (für den Mond!), Mond, Sterne
  useEffect(() => {
    const g = globeRef.current
    if (!g) return

    const scene = g.scene()

    // Sun-Light positionieren — gleiche Richtung wie der Shader-Uniform
    const sunPos = sunDirection().multiplyScalar(800)
    const sun = new THREE.DirectionalLight(0xfff2cc, 1.4)
    sun.position.copy(sunPos)
    scene.add(sun)

    const ambient = new THREE.AmbientLight(0x223355, 0.15)
    scene.add(ambient)

    // Mond
    const moonGroup = new THREE.Group()
    const moonGeo = new THREE.SphereGeometry(18, 48, 48)
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xfdf5d3,
      emissive: 0xaa9966,
      emissiveIntensity: 0.5,
      roughness: 0.65,
      metalness: 0.0,
    })
    moonGroup.add(new THREE.Mesh(moonGeo, moonMat))
    // Halo
    moonGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(22, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff4cf, transparent: true, opacity: 0.12, depthWrite: false }),
    ))
    moonGroup.position.set(-320, 140, -180)
    scene.add(moonGroup)

    // Sonne als sichtbarer Glow (klein, weit weg in Sonnenrichtung)
    const sunGlowGroup = new THREE.Group()
    sunGlowGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(30, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.85 }),
    ))
    sunGlowGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff5bb, transparent: true, opacity: 0.18, depthWrite: false }),
    ))
    sunGlowGroup.position.copy(sunPos);
    scene.add(sunGlowGroup)

    // Sonne (Light + visuelle Sphere) jeden Tick mitlaufen lassen
    const moveSun = () => {
      const p = sunDirection().multiplyScalar(800)
      sun.position.copy(p)
      sunGlowGroup.position.copy(p)
    }
    const sunMoveId = setInterval(moveSun, 60_000)

    g.controls().autoRotate = true
    g.controls().autoRotateSpeed = 0.35
    g.controls().enableZoom = false
    g.controls().enablePan = false
    g.pointOfView({ lat: 25, lng: 10, altitude: 2.2 }, 0)

    return () => {
      clearInterval(sunMoveId)
      scene.remove(sun, ambient, moonGroup, sunGlowGroup)
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
