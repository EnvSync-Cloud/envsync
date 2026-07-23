import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CropMarkFrame } from "./CropMarkFrame"

const cardVariants = cva("rounded-lg p-6", {
  variants: {
    variant: {
      hairline: "bg-card border border-border",
      tint: "bg-accent-tint/8 border border-accent-outline/35",
      blueprint: "bg-card border border-border",
    },
  },
  defaultVariants: {
    variant: "hairline",
  },
})

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Blueprint variant only: wraps children in a dashed-border sub-region */
  dashed?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, dashed, children, onClick, ...props }, ref) => {
    const isInteractive = !!onClick
    const interactiveClasses = isInteractive
      ? "cursor-pointer hover:border-input transition-[border-color] duration-200"
      : ""

    if (variant === "blueprint") {
      return (
        <CropMarkFrame ref={ref} className={className} {...props}>
          <div
            className={cn(
              "bg-card border border-border rounded-lg p-6",
              interactiveClasses
            )}
            onClick={onClick}
          >
            {dashed ? (
              <div className="border border-dashed border-border rounded-sm p-4">
                {children}
              </div>
            ) : (
              children
            )}
          </div>
        </CropMarkFrame>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant }), interactiveClasses, className)}
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = "Card"

export { Card, cardVariants }
