import * as React from "react"
import { cn } from "@/lib/utils"

export interface TerminalLine {
  type: "cmd" | "success" | "warn" | "info"
  text: string
}

export interface TerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  lines: TerminalLine[]
  title?: string
}

const lineConfig: Record<
  TerminalLine["type"],
  { prefix: string; className: string }
> = {
  cmd: { prefix: "$ ", className: "text-white" },
  success: { prefix: "✓ ", className: "text-[#1DC379]" },
  warn: { prefix: "! ", className: "text-[#F59E0B]" },
  info: { prefix: "", className: "text-[#9FA7B2]" },
}

const Terminal = React.forwardRef<HTMLDivElement, TerminalProps>(
  ({ className, lines, title, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-[#0C0E13] text-[#F3F5F7] border border-[#2E3642] rounded-lg overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2E3642]">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full bg-[#FF5F57]"
              aria-hidden="true"
            />
            <span
              className="w-3 h-3 rounded-full bg-[#FEBC2E]"
              aria-hidden="true"
            />
            <span
              className="w-3 h-3 rounded-full bg-[#28C840]"
              aria-hidden="true"
            />
          </div>
          {title && (
            <span className="font-mono text-[13px] text-[#9FA7B2]">
              {title}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="font-mono text-sm leading-5 p-4">
          {lines.map((line, i) => {
            const cfg = lineConfig[line.type]
            return (
              <div key={i} className={cfg.className}>
                {cfg.prefix}
                {line.text}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
Terminal.displayName = "Terminal"

export { Terminal }
