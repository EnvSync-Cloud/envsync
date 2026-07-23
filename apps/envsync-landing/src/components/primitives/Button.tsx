import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium text-base rounded-full " +
    "transition-[scale,translate,opacity,background-color,color,border-color] " +
    "duration-[0.16s] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] " +
    "active:translate-y-[1px] " +
    "focus-visible:ring-[3px] focus-visible:ring-accent-outline/35 " +
    "focus-visible:outline focus-visible:outline-[0.5px] focus-visible:outline-primary focus-visible:outline-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:opacity-95",
        hero:
          "bg-white text-[#1F1F1F] border border-transparent " +
          "hover:bg-transparent hover:text-hero-text hover:border-hero-text",
        outline:
          "bg-transparent border border-border text-foreground hover:opacity-95",
        "nav-cta":
          "bg-primary text-primary-foreground scale-[0.92] origin-center hover:opacity-95",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-10 px-4",
        lg: "h-[46px] px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
