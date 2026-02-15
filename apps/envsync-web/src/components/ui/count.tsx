import { cn } from "@/lib/utils";

/**
 * Format number to compact representation (1.2k, 45k, etc.)
 */
const formatCompactNumber = (num: number): string => {
  if (num < 1000) {
    return num.toString();
  }

  const formatter = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    compactDisplay: "short",
  });

  return formatter.format(num);
};

const variantStyles = {
  default: "bg-electric_indigo-500 text-white",
  subtle:
    "bg-electric_indigo-500/10 text-electric_indigo-400 border border-electric_indigo-500/20",
  ghost:
    "bg-transparent text-electric_indigo-400 hover:bg-electric_indigo-500/10 hover:text-electric_indigo-500",
  destructive: "bg-red-500 text-white hover:bg-red-600",
  outline:
    "bg-transparent border border-electric_indigo-500/50 text-electric_indigo-400",
};

const sizeStyles = {
  sm: "h-4 min-w-[1rem] px-1 text-[0.65rem]",
  md: "h-5 min-w-[1.25rem] px-1.5 text-xs",
  lg: "h-6 min-w-[1.5rem] px-2 text-sm",
  xl: "h-7 min-w-[1.75rem] px-2.5 text-base",
};

interface CountProps {
  count: number;
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
  compact?: boolean;
  hideIfZero?: boolean;
}

export const Count = ({
  compact = true,
  count,
  variant = "default",
  size = "md",
  className,
  hideIfZero = true,
}: CountProps) => {
  if (hideIfZero && !count) {
    return null;
  }

  const displayCount = compact ? formatCompactNumber(count) : count.toString();

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-xs font-medium rounded-md",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {displayCount}
    </span>
  );
};
