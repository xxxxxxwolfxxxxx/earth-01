import { useEffect, useRef } from 'react'

export default function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let stars = []
    let pulsar = { x: 0, y: 0, phase: 0 }

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    function initStars() {
      stars = Array.from({ length: 300 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        brightness: Math.random(),
      }))
      pulsar.x = canvas.width * 0.85
      pulsar.y = canvas.height * 0.15
    }

    function drawStar(star, time) {
      const twinkle = Math.sin(time * star.speed + star.phase) * 0.5 + 0.5
      const alpha = 0.2 + twinkle * 0.8
      const hue = star.brightness > 0.8 ? 220 : star.brightness > 0.5 ? 40 : 0
      const sat = star.brightness > 0.5 ? '80%' : '0%'
      const light = star.brightness > 0.8 ? '90%' : '95%'
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fillStyle = `hsla(${hue}, ${sat}, ${light}, ${alpha})`
      ctx.fill()
      if (star.size > 1.5) {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, ${sat}, ${light}, ${alpha * 0.1})`
        ctx.fill()
      }
    }

    function drawPulsar(time) {
      pulsar.phase += 0.03
      const intensity = Math.sin(pulsar.phase) * 0.5 + 0.5
      const baseRadius = 3
      const glowRadius = 20 + intensity * 40

      const gradient = ctx.createRadialGradient(
        pulsar.x, pulsar.y, baseRadius,
        pulsar.x, pulsar.y, glowRadius
      )
      gradient.addColorStop(0, `rgba(124, 58, 237, ${0.8 + intensity * 0.2})`)
      gradient.addColorStop(0.3, `rgba(124, 58, 237, ${0.3 * intensity})`)
      gradient.addColorStop(1, 'rgba(124, 58, 237, 0)')
      ctx.beginPath()
      ctx.arc(pulsar.x, pulsar.y, glowRadius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.beginPath()
      ctx.arc(pulsar.x, pulsar.y, baseRadius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200, 180, 255, ${0.9 + intensity * 0.1})`
      ctx.fill()

      const beamLen = 60 + intensity * 30
      const beamGrad = ctx.createLinearGradient(
        pulsar.x - beamLen, pulsar.y,
        pulsar.x + beamLen, pulsar.y
      )
      beamGrad.addColorStop(0, 'rgba(124, 58, 237, 0)')
      beamGrad.addColorStop(0.5, `rgba(124, 58, 237, ${0.3 * intensity})`)
      beamGrad.addColorStop(1, 'rgba(124, 58, 237, 0)')
      ctx.fillStyle = beamGrad
      ctx.fillRect(pulsar.x - beamLen, pulsar.y - 1, beamLen * 2, 2)
    }

    function drawNebula(time) {
      const x = canvas.width * 0.2
      const y = canvas.height * 0.7
      const pulse = Math.sin(time * 0.0005) * 0.1 + 0.15
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 200)
      gradient.addColorStop(0, `rgba(124, 58, 237, ${pulse})`)
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${pulse * 0.5})`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(x - 200, y - 200, 400, 400)
    }

    function animate(time) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawNebula(time)
      stars.forEach(star => drawStar(star, time))
      drawPulsar(time)
      animationId = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)
    animationId = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #0a0a2e 0%, #050510 70%)' }}
    />
  )
}
