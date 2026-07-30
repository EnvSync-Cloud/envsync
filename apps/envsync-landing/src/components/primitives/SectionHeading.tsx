import * as React from "react"
import { cn } from "@/lib/utils"

export interface SectionHeadingProps
  extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow: string
  title: string
  description?: string
  align?: "left" | "center"
}

const SectionHeading = React.forwardRef<HTMLDivElement, SectionHeadingProps>(
  ({ className, eyebrow, title, description, align = "center", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 mb-12 md:mb-16",
          align === "center" && "items-center text-center",
          align === "left" && "items-start text-left",
          className
        )}
        {...props}
      >
        <span className="font-mono text-mono-label text-accent-ink">
          {eyebrow}
        </span>
        <h2 className="text-h1 font-medium">{title}</h2>
        {description && (
          <p className="text-lead text-muted-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
    )
  }
)
SectionHeading.displayName = "SectionHeading"

export { SectionHeading }
