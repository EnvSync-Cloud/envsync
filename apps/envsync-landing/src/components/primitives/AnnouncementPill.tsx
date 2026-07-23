import * as React from "react"
import { cn } from "@/lib/utils"

export interface AnnouncementPillProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent"
  items: string[]
  href?: string
  linkLabel?: string
}

const AnnouncementPill = React.forwardRef<
  HTMLDivElement,
  AnnouncementPillProps
>(({ className, variant = "default", items, href, linkLabel, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm",
        variant === "accent"
          ? "border border-accent-outline/35"
          : "border border-border",
        className
      )}
      {...props}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
          )}
          <span>{item}</span>
        </React.Fragment>
      ))}
      {href && linkLabel && (
        <a
          href={href}
          className="font-mono text-accent-ink hover:underline underline-offset-2"
        >
          {linkLabel}
        </a>
      )}
    </div>
  )
})
AnnouncementPill.displayName = "AnnouncementPill"

export { AnnouncementPill }
