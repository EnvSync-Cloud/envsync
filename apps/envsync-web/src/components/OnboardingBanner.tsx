import { useState } from "react";
import { X, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

import { apiKeysPath, orgAccessPath, projectCreatePath, projectsPath } from "@/lib/app-routes";

interface OnboardingBannerProps {
  hasProjects: boolean;
  hasTeamMembers: boolean;
  hasApiKeys: boolean;
}

const STORAGE_KEY = "envsync-onboarding-dismissed";

export function OnboardingBanner({
  hasProjects,
  hasTeamMembers,
  hasApiKeys,
}: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "true"
  );

  if (dismissed) return null;

  const steps = [
    { label: "Create a project", done: hasProjects, href: projectCreatePath() },
    { label: "Add variables", done: hasProjects, href: projectsPath() },
    { label: "Invite your team", done: hasTeamMembers, href: orgAccessPath("users") },
    { label: "Generate API key", done: hasApiKeys, href: apiKeysPath() },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  if (completedCount === steps.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-5">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-4" />
      </button>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Get started with EnvSync
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Complete these steps to set up your organization
          </p>
        </div>

        <Progress value={progress} className="h-1.5" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((step, idx) => (
            <Link
              key={idx}
              to={step.href}
              className="flex items-center space-x-2 rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done
                    ? "bg-accent text-accent-ink"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.done ? (
                  <Check className="size-3" />
                ) : (
                  <span className="text-[10px] font-medium">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-xs ${
                  step.done ? "text-muted-foreground line-through" : "text-foreground"
                }`}
              >
                {step.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
