import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FeatureDocsLinkProps {
  /** Absolute URL on docs.envsync.cloud. */
  href: string;
  /** Feature name, used for the accessible label and tooltip. */
  label: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  /** Override for e2e selectors; defaults to `feature-docs-link`. */
  testId?: string;
}

/**
 * The "i" affordance that opens the hosted documentation for a dashboard
 * feature in a new tab. Rendered only when a docs page exists for the feature
 * (see `src/lib/docs-links.ts`).
 */
export const FeatureDocsLink = ({
  href,
  label,
  className,
  side = "right",
  testId = "feature-docs-link",
}: FeatureDocsLinkProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        aria-label={`Open ${label} documentation in a new tab`}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
      >
        <Info className="size-3.5" />
      </a>
    </TooltipTrigger>
    <TooltipContent side={side}>View {label} docs</TooltipContent>
  </Tooltip>
);
