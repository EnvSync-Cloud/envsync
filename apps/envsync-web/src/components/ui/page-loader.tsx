import { cn } from "@/lib/utils";

interface PageLoaderProps {
  color?: string;
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export const PageLoader = ({
  color = "border-t-primary",
  message = "Loading...",
  fullScreen = false,
  className,
}: PageLoaderProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "h-screen bg-background" : "min-h-[60vh]",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        <div
          className={cn(
            "size-12 border-4 border-muted rounded-full animate-spin",
            color
          )}
        />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};
