import * as React from "react"
import { cn } from "@/lib/utils"

export interface BeamCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true the animated beam border is always visible; otherwise it appears on hover */
  active?: boolean
}

const BeamCard = React.forwardRef<HTMLDivElement, BeamCardProps>(
  ({ className, active = false, children, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const showBeam = active || isHovered

    return (
      <div
        ref={ref}
        className={cn("rounded-lg bg-card p-6", showBeam && "beam-border", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
BeamCard.displayName = "BeamCard"

export { BeamCard }
