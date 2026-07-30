import * as React from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ThemeToggleProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className, ...props }, ref) => {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
      setMounted(true)
    }, [])

    if (!mounted) {
      return (
        <button
          ref={ref}
          className={cn(
            "inline-flex items-center justify-center w-10 h-10 rounded-full",
            "border border-border text-foreground",
            "transition-[scale,translate,opacity,background-color,color,border-color]",
            "duration-[0.16s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
            "active:translate-y-[1px]",
            "focus-visible:ring-[3px] focus-visible:ring-accent-outline/35",
            "focus-visible:outline focus-visible:outline-[0.5px] focus-visible:outline-primary focus-visible:outline-offset-2",
            className
          )}
          disabled
          {...props}
        >
          <Sun className="w-4 h-4" />
        </button>
      )
    }

    const isDark = theme === "dark"

    return (
      <button
        ref={ref}
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className={cn(
          "inline-flex items-center justify-center w-10 h-10 rounded-full",
          "border border-border text-foreground hover:opacity-95",
          "transition-[scale,translate,opacity,background-color,color,border-color]",
          "duration-[0.16s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          "active:translate-y-[1px]",
          "focus-visible:ring-[3px] focus-visible:ring-accent-outline/35",
          "focus-visible:outline focus-visible:outline-[0.5px] focus-visible:outline-primary focus-visible:outline-offset-2",
          className
        )}
        aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        {...props}
      >
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    )
  }
)
ThemeToggle.displayName = "ThemeToggle"

export { ThemeToggle }
