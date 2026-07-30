import * as React from "react"
import { cn } from "@/lib/utils"

export interface StatCalloutProps
  extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow: string
  numeral: string
  body: string
}

const StatCallout = React.forwardRef<HTMLDivElement, StatCalloutProps>(
  ({ className, eyebrow, numeral, body, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border border-accent-outline/35 rounded-lg p-6",
          className
        )}
        {...props}
      >
        <span className="font-mono text-mono-label text-accent-ink">
          {eyebrow}
        </span>
        <div className="text-h2 font-medium mt-2">{numeral}</div>
        <p className="text-sm text-muted-foreground mt-1">{body}</p>
      </div>
    )
  }
)
StatCallout.displayName = "StatCallout"

export { StatCallout }
