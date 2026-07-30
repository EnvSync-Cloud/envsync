import * as React from "react"
import { cn } from "@/lib/utils"

export interface DotTextureProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Alpha for the dot grid radial-gradient. Default 0.22. */
  dotAlpha?: number
  /** Alpha for the bottom glow radial-gradient. Default 0.24. */
  glowAlpha?: number
}

const DotTexture = React.forwardRef<HTMLDivElement, DotTextureProps>(
  ({ dotAlpha = 0.22, glowAlpha = 0.24, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          "absolute inset-0 pointer-events-none",
          className,
        )}
        style={{
          backgroundImage: [
            `radial-gradient(circle, hsl(var(--hero-text) / ${dotAlpha}) 1px, transparent 1px)`,
            `radial-gradient(60% 50% at 50% 100%, hsl(var(--hero-text) / ${glowAlpha}), transparent 70%)`,
          ].join(", "),
          backgroundSize: "10px 10px, 100% 100%",
          ...style,
        }}
        {...props}
      />
    )
  },
)
DotTexture.displayName = "DotTexture"

export { DotTexture }
