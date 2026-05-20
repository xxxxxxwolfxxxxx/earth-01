// Wandelt astronomy-engine-Positionen (J2000-ECI) in three-globe-Szenenkoordinaten um.
import * as Astronomy from 'astronomy-engine'
import * as THREE from 'three'

// J2000-Vektor (Astronomy-Engine, in AU) → geozentrisch-Erdfeste Lat/Lng.
// Wir drehen um die Z-Achse um den aktuellen Greenwich-Sternzeit-Winkel.
function j2000ToGeographic(vec, date) {
  const gmstHours = Astronomy.SiderealTime(date) // 0..24
  const gmstRad = (gmstHours * 15 * Math.PI) / 180

  const cos = Math.cos(-gmstRad)
  const sin = Math.sin(-gmstRad)
  const fx = vec.x * cos - vec.y * sin
  const fy = vec.x * sin + vec.y * cos
  const fz = vec.z

  const r   = Math.sqrt(fx * fx + fy * fy + fz * fz)
  const lat = (Math.asin(fz / r) * 180) / Math.PI
  const lng = (Math.atan2(fy, fx) * 180) / Math.PI
  return { lat, lng, r }
}

// Konvertiert (lat, lng) in three-globe-Cartesian (selbe Konvention wie der Globe-Surface).
function latLngToScene(lat, lng, distance) {
  const phi   = ((90 - lat) * Math.PI) / 180
  const theta = ((lng + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -distance * Math.sin(phi) * Math.cos(theta),
     distance * Math.cos(phi),
     distance * Math.sin(phi) * Math.sin(theta),
  )
}

// Subsolar/sublunar Punkt: wo ist gerade auf der Erde direkt darunter?
// Dann diesen lat/lng in Szenenkoordinaten mit kosmetischer Distanz.
export function bodyScenePosition(body, date, sceneDistance) {
  const vec = body === 'Moon'
    ? Astronomy.GeoMoon(date)
    : Astronomy.GeoVector(Astronomy.Body[body], date, false)
  const { lat, lng } = j2000ToGeographic(vec, date)
  return { lat, lng, position: latLngToScene(lat, lng, sceneDistance) }
}

// Sonne — basiert auf GeoVector(Sun) (oder dem entgegengesetzten von Sun→Earth)
// astronomy-engine: GeoVector(Sun) gibt Sonne von Erde aus.
export function sunScenePosition(date, sceneDistance) {
  return bodyScenePosition('Sun', date, sceneDistance)
}

// Bequemer Helper: unit vector zur Sonne (für den Shader-Uniform sunDir).
export function sunUnitDirection(date) {
  const s = bodyScenePosition('Sun', date, 1)
  return s.position.normalize()
}
