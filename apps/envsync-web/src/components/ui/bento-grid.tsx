import { cn } from "@/lib/utils";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 gap-4 md:auto-rows-[11rem] md:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  title,
  icon,
  children,
}: {
  className?: string;
  title?: string | React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between space-y-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/50",
        className
      )}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 group-hover/bento:translate-x-1 transition duration-200">
          {icon}
          {title && (
            <div className="font-sans font-medium text-sm text-foreground">
              {title}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
};
