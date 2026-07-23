import * as React from "react"
import { cn } from "@/lib/utils"

export interface SplitPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  leftSlot: React.ReactNode
  rightSlot: React.ReactNode
}

const SplitPanel = React.forwardRef<HTMLDivElement, SplitPanelProps>(
  ({ className, leftSlot, rightSlot, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid md:grid-cols-2 rounded-lg overflow-hidden border border-border",
          className
        )}
        {...props}
      >
        <div className="bg-card p-6 md:p-10">{leftSlot}</div>
        <div className="bg-primary text-hero-text p-10 flex flex-col gap-4">
          {rightSlot}
        </div>
      </div>
    )
  }
)
SplitPanel.displayName = "SplitPanel"

export { SplitPanel }
