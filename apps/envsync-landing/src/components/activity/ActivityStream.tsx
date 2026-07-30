import * as React from "react"
import { cn } from "@/lib/utils"
import { SectionHeading } from "@/components/primitives/SectionHeading"
import { WaveCanvas } from "./WaveCanvas"

/* -------------------------------------------------------------------------- */
/*  Card data                                                                  */
/* -------------------------------------------------------------------------- */

type AlertTone = "primary" | "warning" | "error"

interface AlertItem {
  icon: string
  tone: AlertTone
  title?: string
  message: string
  label?: string
  left: number
  top: number
  travelSeconds: number
  delaySeconds: number
  floatPixels: number
  stack?: number
}

const alerts: AlertItem[] = [
  {
    icon: "\u25B3",
    tone: "warning",
    message: "DRIFT: .env.production changed outside review",
    left: -12,
    top: 14,
    travelSeconds: 8,
    delaySeconds: 0.2,
    floatPixels: 10,
  },
  {
    icon: "!",
    tone: "error",
    title: "Production drift",
    message: "API_URL differs from approved staging",
    label: "BLOCKED",
    left: 14,
    top: 6,
    travelSeconds: 7,
    delaySeconds: 1.4,
    floatPixels: 7,
  },
  {
    icon: "\u2301",
    tone: "warning",
    title: "Approval required",
    message: "Two reviewers needed before production",
    left: 8,
    top: 40,
    travelSeconds: 9,
    delaySeconds: 0.8,
    floatPixels: 13,
    stack: 2,
  },
  {
    icon: "\u2192",
    tone: "primary",
    title: "Promotion ready",
    message: "Staging matches the approved change set",
    label: "READY",
    left: -18,
    top: 72,
    travelSeconds: 7.5,
    delaySeconds: 2.2,
    floatPixels: 9,
  },
  {
    icon: "\u25A1",
    tone: "primary",
    title: "Rollback point saved",
    message: "Restore v30488 if checks fail",
    left: 43,
    top: 18,
    travelSeconds: 8.5,
    delaySeconds: 1.8,
    floatPixels: 11,
  },
  {
    icon: "\u25CF",
    tone: "error",
    message: "DATABASE_URL is missing from staging",
    left: 52,
    top: 63,
    travelSeconds: 9.5,
    delaySeconds: 0.4,
    floatPixels: 8,
  },
  {
    icon: "\u2713",
    tone: "primary",
    title: "Rotation complete",
    message: "postgres/prod rotated on schedule",
    left: 25,
    top: 82,
    travelSeconds: 7.8,
    delaySeconds: 2.8,
    floatPixels: 12,
  },
]

/* -------------------------------------------------------------------------- */
/*  Tone color map                                                            */
/* -------------------------------------------------------------------------- */

const toneColors: Record<AlertTone, string> = {
  primary: "text-[#1DC379]",
  warning: "text-[#F59E0B]",
  error: "text-[#EF4444]",
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

function ActivityStream({ className }: { className?: string }) {
  const frameRef = React.useRef<HTMLDivElement>(null)
  const reducedMotion = React.useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  /* WAAPI travel animations (skip entirely for reduced-motion) */
  React.useEffect(() => {
    if (reducedMotion) return

    const frame = frameRef.current
    if (!frame) return

    const cardEls = frame.querySelectorAll<HTMLElement>("[data-stream-card]")
    if (cardEls.length === 0) return

    const animations: Animation[] = []
    const power2Out = "cubic-bezier(0.25, 0.46, 0.45, 0.94)"
    const power2In = "cubic-bezier(0.55, 0.085, 0.68, 0.53)"

    alerts.forEach((alert, alertIndex) => {
      const copies = alert.stack ?? 1
      for (let s = 0; s < copies; s++) {
        // Each alert with stack copies occupies (stack ?? 1) elements in the flat DOM
        // Map (alertIndex, stackIndex) → flat DOM index
        let flatIndex = 0
        for (let a = 0; a < alertIndex; a++) {
          flatIndex += alerts[a].stack ?? 1
        }
        flatIndex += s

        const el = cardEls[flatIndex]
        if (!el) continue

        const travelSeconds = alert.travelSeconds
        const delaySeconds = alert.delaySeconds + s * 0.2
        const totalDuration = (0.4 + travelSeconds + 0.4) * 1000 // ms

        const fadeShare = 0.4 / (0.4 + travelSeconds + 0.4)
        const travelShare = travelSeconds / (0.4 + travelSeconds + 0.4)
        const fadeOutStart = fadeShare + travelShare

        const keyframes: Keyframe[] = [
          {
            offset: 0,
            transform: "translateX(-35%) scale(0.72)",
            opacity: 0,
            easing: power2Out,
          },
          {
            offset: fadeShare,
            transform: "translateX(0%) scale(1)",
            opacity: 0.94,
            easing: "linear",
          },
          {
            offset: fadeOutStart,
            transform: "translateX(220%) scale(1)",
            opacity: 0.94,
            easing: power2In,
          },
          {
            offset: 1,
            transform: "translateX(220%) scale(0.72)",
            opacity: 0,
          },
        ]

        const anim = el.animate(keyframes, {
          duration: totalDuration,
          delay: delaySeconds * 1000,
          iterations: Infinity,
          endDelay: 700,
          easing: "linear",
        })
        animations.push(anim)
      }
    })

    // Pause the loop while the section is off-screen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        animations.forEach((a) => {
          if (entry.isIntersecting) {
            a.play()
          } else {
            a.pause()
          }
        })
      },
      { threshold: 0.05 },
    )
    observer.observe(frame)

    return () => {
      animations.forEach((a) => a.cancel())
      observer.disconnect()
    }
  }, [reducedMotion])

  /* Build flat card list with stack duplication (port concept lines 131-155) */
  const flatCards = React.useMemo(() => {
    const result: Array<{
      alert: AlertItem
      alertIndex: number
      stackIndex: number
      animIndex: number
    }> = []
    let idx = 0
    alerts.forEach((alert, alertIndex) => {
      const copies = alert.stack ?? 1
      for (let s = 0; s < copies; s++) {
        result.push({ alert, alertIndex, stackIndex: s, animIndex: idx })
        idx++
      }
    })
    return result
  }, [])

  return (
    <section
      className={cn("border-t border-border bg-background", className)}
      aria-labelledby="activity-stream-title"
    >
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-8 md:py-24">
        <SectionHeading
          align="center"
          eyebrow="ACTIVITY"
          title="Watch config move. Safely."
          description="Live change events across dev, staging, CI, and production — every one versioned and reviewable."
        />

        <div
          ref={frameRef}
          className="relative mt-16 h-[420px] md:h-[520px] overflow-hidden rounded-lg border border-[#2E3642] bg-[#0C0E13]"
        >
          {/* Layer z-0: Wave canvas */}
          <WaveCanvas />

          {/* Layer z-1: Grid overlay */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[1] opacity-[0.38] hidden sm:block"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--hero-text)/0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--hero-text)/0.07) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
              maskImage:
                "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
            }}
          />

          {/* Layer z-3: Alert cards */}
          <div className="absolute inset-0 z-[3] overflow-hidden">
            {flatCards.map(({ alert, alertIndex, stackIndex, animIndex }) => {
              const copies = alert.stack ?? 1
              const stackLeft = alert.left + stackIndex * 24
              const stackTop = alert.top + stackIndex * 28
              const floatDuration =
                3.2 + ((alertIndex + stackIndex) % 4) * 0.6

              // Reduced-motion: first 4 anim-indices rendered static
              if (reducedMotion) {
                const isStatic = animIndex < 4
                const staticX = animIndex % 2 === 0 ? 10 : 45
                return (
                  <article
                    key={`${alertIndex}-${stackIndex}`}
                    className={cn(
                      "absolute w-[clamp(190px,21vw,270px)]",
                      !isStatic && "hidden",
                    )}
                    style={{
                      left: `${stackLeft}%`,
                      top: `${stackTop}%`,
                      transform: `translateX(${staticX}%)`,
                      opacity: isStatic ? 1 : 0,
                    }}
                    aria-label={
                      alert.title
                        ? `${alert.title}: ${alert.message}`
                        : alert.message
                    }
                  >
                    <CardSurface
                      alert={alert}
                      alertIndex={alertIndex}
                      stackIndex={stackIndex}
                      floatDuration={floatDuration}
                      reducedMotion
                    />
                  </article>
                )
              }

              return (
                <article
                  key={`${alertIndex}-${stackIndex}`}
                  data-stream-card
                  className={cn(
                    "absolute w-[clamp(190px,21vw,270px)] opacity-0 will-change-[transform,opacity]",
                    // Hide cards beyond the 5th on mobile
                    animIndex >= 5 && "max-md:hidden",
                  )}
                  style={{
                    left: `calc(${stackLeft}% + 0px)`,
                    top: `calc(${stackTop}% + 0px)`,
                  }}
                  aria-label={
                    alert.title
                      ? `${alert.title}: ${alert.message}`
                      : alert.message
                  }
                >
                  <CardSurface
                    alert={alert}
                    alertIndex={alertIndex}
                    stackIndex={stackIndex}
                    floatDuration={floatDuration}
                  />
                </article>
              )
            })}
          </div>

          {/* Layer z-4: Edge fade */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[4] pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, #0C0E13 0%, transparent 12%, transparent 84%, #0C0E13 100%)",
            }}
          />

          {/* Layer z-6: Status label (top-left) */}
          <div
            aria-hidden="true"
            className="absolute top-[22px] left-[24px] z-[6] font-mono text-[10px] tracking-[0.08em] uppercase flex items-center gap-2 text-[#9FA7B2]"
          >
            <span
              className="w-[6px] h-[6px] rounded-full bg-[#1DC379]"
              style={{ boxShadow: "0 0 12px #1DC379" }}
            />
            Configuration activity
          </div>

          {/* Layer z-6: Caption label (bottom-right) */}
          <div
            aria-hidden="true"
            className="absolute bottom-[20px] right-[24px] z-[6] font-mono text-[10px] tracking-[0.08em] uppercase flex gap-[14px] text-[#9FA7B2] leading-relaxed text-right"
          >
            <span className="text-[#1DC379]">02</span>
            <p className="m-0">
              Versioned changes
              <br />
              moving dev &rarr; production
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Card surface (inner element owns the float animation)                      */
/* -------------------------------------------------------------------------- */

function CardSurface({
  alert,
  alertIndex,
  stackIndex,
  floatDuration,
  reducedMotion,
}: {
  alert: AlertItem
  alertIndex: number
  stackIndex: number
  floatDuration: number
  reducedMotion?: boolean
}) {
  return (
    <div
      className={cn(
        "flex gap-3 items-start min-h-[58px] p-3 rounded-lg",
        "border border-dashed border-[hsl(0_0%_100%/0.18)]",
        "bg-[rgba(16,20,26,0.9)] backdrop-blur-md",
        "shadow-[0_16px_50px_rgba(0,0,0,0.34)]",
        !reducedMotion && "card-float will-change-transform",
      )}
      style={
        {
          "--float": `${alert.floatPixels}px`,
          "--float-duration": `${floatDuration}s`,
        } as React.CSSProperties
      }
    >
      {/* Icon */}
      <span
        className={cn(
          "w-6 h-6 shrink-0 border border-current rounded-full",
          "font-mono text-xs grid place-items-center",
          toneColors[alert.tone],
        )}
        aria-hidden="true"
      >
        {alert.icon}
      </span>

      {/* Copy */}
      <div className="font-mono text-[10px] leading-[1.45] flex flex-col gap-[3px] min-w-0">
        {alert.label && (
          <span
            className={cn(
              "w-max mb-[2px] px-[5px] py-px border border-current rounded-full text-[8px]",
              toneColors[alert.tone],
            )}
          >
            {alert.label}
          </span>
        )}
        {alert.title && (
          <strong className="text-[11px] font-medium text-[#F3F5F7]">
            {alert.title}
          </strong>
        )}
        <span className="text-[#9FA7B2]">{alert.message}</span>
      </div>
    </div>
  )
}

export { ActivityStream }
