import { useMemo } from 'react'

function generateStars(count, seed) {
  const stars = []
  let s = seed
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * 100,
      y: rand() * 100,
      size: rand() * 2 + 0.5,
      duration: rand() * 4 + 3,
      delay: rand() * 5,
      opacity: rand() * 0.6 + 0.2,
    })
  }
  return stars
}

export default function Starfield() {
  const layers = useMemo(() => [
    generateStars(120, 1337),
    generateStars(80, 42),
    generateStars(40, 999),
  ], [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{
      background: 'radial-gradient(ellipse at 30% 20%, #0d0d2b 0%, #050510 50%, #020208 100%)',
    }}>
      {/* Nebula glow */}
      <div className="absolute w-[600px] h-[600px] rounded-full opacity-15 blur-3xl" style={{
        background: 'radial-gradient(circle, rgba(124,58,237,0.4) 0%, rgba(59,130,246,0.2) 40%, transparent 70%)',
        left: '10%',
        top: '60%',
        transform: 'translate(-50%, -50%)',
        animation: 'nebula-drift 30s ease-in-out infinite alternate',
      }} />
      <div className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-3xl" style={{
        background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(16,185,129,0.1) 50%, transparent 70%)',
        right: '5%',
        top: '15%',
        animation: 'nebula-drift 25s ease-in-out infinite alternate-reverse',
      }} />

      {/* Stars */}
      {layers.map((stars, layerIdx) => (
        <div key={layerIdx} className="absolute inset-0">
          {stars.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: layerIdx === 0
                  ? `rgba(255,255,255,${star.opacity})`
                  : layerIdx === 1
                    ? `rgba(200,210,255,${star.opacity})`
                    : `rgba(255,240,200,${star.opacity * 0.8})`,
                boxShadow: star.size > 1.5
                  ? `0 0 ${star.size * 3}px rgba(255,255,255,${star.opacity * 0.3})`
                  : 'none',
                animation: `twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
