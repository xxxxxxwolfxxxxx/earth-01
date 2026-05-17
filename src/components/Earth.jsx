import { useEffect, useRef } from 'react'

export default function Earth({ size = 400 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const s = size * 2
    canvas.width = s
    canvas.height = s
    let rotation = 0
    let animId

    const continents = [
      { cx: 0.35, cy: 0.4, rx: 0.15, ry: 0.2 },
      { cx: 0.55, cy: 0.35, rx: 0.08, ry: 0.12 },
      { cx: 0.6, cy: 0.55, rx: 0.12, ry: 0.15 },
      { cx: 0.3, cy: 0.65, rx: 0.06, ry: 0.08 },
      { cx: 0.7, cy: 0.4, rx: 0.1, ry: 0.18 },
      { cx: 0.45, cy: 0.7, rx: 0.09, ry: 0.06 },
    ]

    function draw() {
      ctx.clearRect(0, 0, s, s)
      const cx = s / 2, cy = s / 2, r = s * 0.42

      const atmosphere = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.15)
      atmosphere.addColorStop(0, 'rgba(59, 130, 246, 0.15)')
      atmosphere.addColorStop(0.5, 'rgba(59, 130, 246, 0.08)')
      atmosphere.addColorStop(1, 'rgba(59, 130, 246, 0)')
      ctx.beginPath()
      ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2)
      ctx.fillStyle = atmosphere
      ctx.fill()

      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.clip()

      const oceanGrad = ctx.createRadialGradient(cx * 0.7, cy * 0.7, 0, cx, cy, r)
      oceanGrad.addColorStop(0, '#2563eb')
      oceanGrad.addColorStop(0.5, '#1e40af')
      oceanGrad.addColorStop(1, '#1e3a5f')
      ctx.fillStyle = oceanGrad
      ctx.fillRect(0, 0, s, s)

      rotation += 0.001
      continents.forEach(cont => {
        const offsetX = (Math.sin(rotation) * 0.1)
        const x = (cont.cx + offsetX) * s
        const y = cont.cy * s
        ctx.beginPath()
        ctx.ellipse(x, y, cont.rx * s, cont.ry * s, 0.3, 0, Math.PI * 2)
        const landGrad = ctx.createRadialGradient(x, y, 0, x, y, cont.rx * s)
        landGrad.addColorStop(0, '#22c55e')
        landGrad.addColorStop(0.7, '#16a34a')
        landGrad.addColorStop(1, '#15803d')
        ctx.fillStyle = landGrad
        ctx.fill()
      })

      for (let i = 0; i < 8; i++) {
        const cloudX = ((i * 0.13 + rotation * 0.5) % 1.2 - 0.1) * s
        const cloudY = (0.2 + i * 0.08) * s
        ctx.beginPath()
        ctx.ellipse(cloudX, cloudY, s * 0.08, s * 0.02, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
        ctx.fill()
      }

      ctx.restore()

      const highlight = ctx.createRadialGradient(cx * 0.7, cy * 0.6, 0, cx, cy, r)
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.12)')
      highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
      highlight.addColorStop(1, 'rgba(0, 0, 0, 0.3)')
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = highlight
      ctx.fill()

      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      className="drop-shadow-2xl"
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(0 0 60px rgba(59, 130, 246, 0.3))',
        animation: 'float 8s ease-in-out infinite',
      }}
    />
  )
}
