import * as React from "react"
import { cn } from "@/lib/utils"

export type LogoCellProps = React.HTMLAttributes<HTMLDivElement>

const LogoCell = React.forwardRef<HTMLDivElement, LogoCellProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "aspect-[3/2] flex items-center justify-center",
          "border border-border -ml-px -mt-px",
          "text-tertiary hover:text-foreground transition-colors duration-200",
          "[&_svg]:max-h-12 [&_svg]:max-w-[120px]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
LogoCell.displayName = "LogoCell"

export { LogoCell }
