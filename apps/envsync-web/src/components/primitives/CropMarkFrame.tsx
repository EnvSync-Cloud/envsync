import * as React from "react"
import { cn } from "@/lib/utils"

export interface CropMarkFrameProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Override the default border-input color of the corner ticks */
  color?: string
}

const CropMarkFrame = React.forwardRef<HTMLDivElement, CropMarkFrameProps>(
  ({ className, color, children, ...props }, ref) => {
    const tickStyle = color ? { borderColor: color } : undefined
    const tickClass = color ? "" : "border-input"

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        {/* Top-left */}
        <span
          className={cn(
            "absolute -top-1 -left-1 w-2 h-2 border-t border-l pointer-events-none",
            tickClass
          )}
          style={tickStyle}
          aria-hidden="true"
        />
        {/* Top-right */}
        <span
          className={cn(
            "absolute -top-1 -right-1 w-2 h-2 border-t border-r pointer-events-none",
            tickClass
          )}
          style={tickStyle}
          aria-hidden="true"
        />
        {/* Bottom-left */}
        <span
          className={cn(
            "absolute -bottom-1 -left-1 w-2 h-2 border-b border-l pointer-events-none",
            tickClass
          )}
          style={tickStyle}
          aria-hidden="true"
        />
        {/* Bottom-right */}
        <span
          className={cn(
            "absolute -bottom-1 -right-1 w-2 h-2 border-b border-r pointer-events-none",
            tickClass
          )}
          style={tickStyle}
          aria-hidden="true"
        />
        {children}
      </div>
    )
  }
)
CropMarkFrame.displayName = "CropMarkFrame"

export { CropMarkFrame }
