import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

export type AgentState = 'idle' | 'thinking' | 'answering' | 'error'

/** A softly deforming contour sphere, with a stable X at its centre. */
export default function AgentX({ size = 40, state = 'idle' }: { size?: number; state?: AgentState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * dpr)
    canvas.height = Math.round(size * dpr)
    ctx.scale(dpr, dpr)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let visible = true
    let previous = 0
    let time = 0
    const active = state === 'thinking' || state === 'answering'
    const animated = active || size >= 64
    const draw = () => {
      ctx.clearRect(0, 0, size, size)
      const radius = size * .37
      const centre = size / 2
      const glow = ctx.createRadialGradient(centre, centre, size * .12, centre, centre, size * .49)
      glow.addColorStop(0, 'rgba(81,60,155,0)')
      glow.addColorStop(.65, 'rgba(95,75,191,.12)')
      glow.addColorStop(1, 'rgba(110,80,190,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, size, size)
      const rings = size >= 64 ? 46 : 20
      const tilt = .52 + Math.sin(time * .32) * .18
      for (let ring = 0; ring < rings; ring++) {
        const latitude = -.5 * Math.PI + (ring + .5) / rings * Math.PI
        ctx.beginPath()
        for (let point = 0; point <= 100; point++) {
          const angle = point / 100 * Math.PI * 2
          const wave = 1 + .1 * Math.sin(angle * 3 + latitude * 2 + time) + .07 * Math.cos(angle * 2 - latitude * 3 - time * .7)
          const r = radius * wave
          const x = r * Math.cos(latitude) * Math.cos(angle)
          const y = r * Math.sin(latitude)
          const z = r * Math.cos(latitude) * Math.sin(angle)
          const rotatedY = y * Math.cos(tilt) - z * Math.sin(tilt)
          const rotatedZ = y * Math.sin(tilt) + z * Math.cos(tilt)
          const turn = .25 * Math.sin(time * .22) - .24
          const px = centre + x * Math.cos(turn) - rotatedY * Math.sin(turn)
          const py = centre + x * Math.sin(turn) + rotatedY * Math.cos(turn)
          const perspective = 1 + rotatedZ / size * .12
          const sx = centre + (px - centre) * perspective
          const sy = centre + (py - centre) * perspective
          if (!point) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        const highlight = .25 + .42 * Math.pow(Math.abs(Math.sin(latitude)), 2)
        ctx.strokeStyle = state === 'error' ? `rgba(214,134,165,${highlight})` : `rgba(161,151,248,${highlight})`
        ctx.lineWidth = size >= 64 ? .55 : .45
        ctx.stroke()
      }
      // Fade the mesh just behind the X to keep its silhouette legible.
      const core = ctx.createRadialGradient(centre, centre, 0, centre, centre, size * .2)
      core.addColorStop(0, 'rgba(21,22,28,.9)')
      core.addColorStop(1, 'rgba(21,22,28,0)')
      ctx.fillStyle = core
      ctx.fillRect(0, 0, size, size)
    }
    const tick = (now: number) => {
      if (now - previous >= 33) {
        time += previous ? Math.min(now - previous, 60) / 1000 * (active ? .9 : .35) : 0
        previous = now
        draw()
      }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      previous = 0
      draw()
      if (animated && visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync() })
    observer.observe(canvas)
    motion.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      motion.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [size, state])
  return (
    <span className={`ax-orb ax-contour ax-orb--${state}`} style={{ '--orb-size': `${size}px` } as CSSProperties} aria-hidden="true">
      <canvas ref={canvasRef} />
      <svg viewBox="0 0 32 32" fill="none"><path d="M10 9 22 23M22 9 10 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
    </span>
  )
}
