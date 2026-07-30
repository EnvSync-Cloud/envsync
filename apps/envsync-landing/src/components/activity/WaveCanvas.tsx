import * as React from "react"
import { cn } from "@/lib/utils"

export interface WaveCanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  /**
   * Dot color for the waveform.
   * Intentional dark-surface token per DESIGN.md §2 — the ActivityStream frame
   * is always dark in both themes, so no theme re-read is needed.
   */
  color?: string
}

/**
 * Dot-waveform canvas: 1.5px dots on a 6px grid, stepped (not sine) amplitudes
 * from a deterministic sin-hash, center line at 54% height, scrolls left,
 * alpha falls off from center. DPR capped at 2. ResizeObserver + rAF.
 * Reduced-motion freezes elapsed time.
 *
 * Faithful port of envsync-landing-concept/src/components/WaveCanvas.astro.
 */
const WaveCanvas = React.forwardRef<HTMLCanvasElement, WaveCanvasProps>(
  ({ className, color = "#1DC379", ...props }, ref) => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null)

    // Merge forwarded ref
    React.useImperativeHandle(ref, () => canvasRef.current as HTMLCanvasElement)

    React.useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
      let frameId = 0
      let width = 0
      let height = 0
      let elapsed = 0
      let previousTime = performance.now()

      function random(seed: number): number {
        const value = Math.sin(seed * 12.9898) * 43758.5453
        return value - Math.floor(value)
      }

      function resize(): void {
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (w === 0 || h === 0) return
        width = w
        height = h
        canvas.width = Math.min(Math.round(w * ratio), 4096)
        canvas.height = Math.min(Math.round(h * ratio), 4096)
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      }

      function draw(time: number): void {
        const delta = Math.min(time - previousTime, 50)
        previousTime = time

        if (!reducedMotion.matches) elapsed += delta

        ctx.clearRect(0, 0, width, height)

        const gap = 6
        const dotSize = 1.5
        const center = Math.round((height * 0.54) / gap) * gap
        const speed = elapsed * 0.018
        const offset = speed % gap

        for (let x = -gap + offset; x < width + gap; x += gap) {
          const column = Math.floor((x - speed) / gap)
          const activity = 0.25 + random(Math.floor(column / 9) + 41) * 0.75
          const texture = random(column * 3 + 17)
          const peakChance = random(column * 7 + 83)
          const peak = peakChance > 0.82 ? ((peakChance - 0.82) / 0.18) * 52 : 0
          const amplitude = Math.min(
            height * 0.25,
            10 + activity * 24 + texture * 18 + peak * 1.2,
          )
          const rows = Math.max(1, Math.floor(amplitude / gap))

          // Drawing out from a shared center keeps every dot on the same grid.
          // The stepped amplitude creates sharp vertical edges, not sine curves.
          for (let row = -rows; row <= rows; row += 1) {
            const distance = Math.abs(row) / rows
            ctx.globalAlpha = 0.28 + (1 - distance) * 0.52
            ctx.fillStyle = color
            ctx.fillRect(Math.round(x), center + row * gap, dotSize, dotSize)
          }
        }

        ctx.globalAlpha = 1
      }

      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      // Perf: draw at 30fps (every 2nd tick) — the drift is slow, motion is
      // visually identical at half the fillRect cost. Elapsed accumulates via
      // time delta, so speed is unaffected.
      let tick = 0
      function loop(time: number): void {
        tick += 1
        if (tick % 2 === 0) draw(time)
        frameId = requestAnimationFrame(loop)
      }

      // Perf: only run the rAF loop while the canvas is on screen.
      // Without this the loop burns the main thread site-wide.
      const visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (frameId === 0) {
              previousTime = performance.now()
              frameId = requestAnimationFrame(loop)
            }
          } else if (frameId !== 0) {
            cancelAnimationFrame(frameId)
            frameId = 0
          }
        },
        { threshold: 0.05 },
      )
      visibilityObserver.observe(canvas)

      return () => {
        if (frameId !== 0) cancelAnimationFrame(frameId)
        observer.disconnect()
        visibilityObserver.disconnect()
      }
    }, [color])

    return (
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={cn("absolute inset-0 z-0 h-full w-full opacity-[0.72]", className)}
        {...props}
      />
    )
  },
)
WaveCanvas.displayName = "WaveCanvas"

export { WaveCanvas }
