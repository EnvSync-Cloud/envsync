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
        "group/bento row-span-1 flex flex-col justify-between space-y-3 rounded-xl border border-gray-800/80 bg-gradient-to-br from-gray-900 to-gray-950 p-4 shadow-xl transition-all duration-200 hover:border-violet-500/50 hover:shadow-glow-sm hover:-translate-y-0.5",
        className
      )}
    >
      {(title || icon) && (
        <div className="flex items-center gap-2 group-hover/bento:translate-x-1 transition duration-200">
          {icon}
          {title && (
            <div className="font-sans font-medium text-sm text-gray-300">
              {title}
            </div>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
};
