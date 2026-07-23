import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface Tab {
  id: string
  label: string
  icon?: LucideIcon
}

export interface TabPillsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

const TabPills = React.forwardRef<HTMLDivElement, TabPillsProps>(
  ({ className, tabs, active, onChange, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex gap-2 items-center", className)}
        role="tablist"
        {...props}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-base font-medium",
                "transition-[scale,translate,opacity,background-color,color,border-color]",
                "duration-[0.16s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
                "active:translate-y-[1px]",
                "focus-visible:ring-[3px] focus-visible:ring-accent-outline/35",
                "focus-visible:outline focus-visible:outline-[0.5px] focus-visible:outline-primary focus-visible:outline-offset-2",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:border-input"
              )}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
            </button>
          )
        })}
      </div>
    )
  }
)
TabPills.displayName = "TabPills"

export { TabPills }
