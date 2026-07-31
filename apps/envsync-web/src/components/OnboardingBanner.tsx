import { useState } from "react";
import { X, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";

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
    { label: "Create a project", done: hasProjects, href: "/applications/create" },
    { label: "Add variables", done: hasProjects, href: "/applications" },
    { label: "Invite your team", done: hasTeamMembers, href: "/users" },
    { label: "Generate API key", done: hasApiKeys, href: "/apikeys" },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const progress = (completedCount / steps.length) * 100;

  if (completedCount === steps.length) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  return (
    <div className="relative rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-emerald-500/5 to-emerald-500/5 p-5">
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
              className="flex items-center space-x-2 p-2.5 rounded-lg bg-card hover:bg-emerald-500/5 border border-border hover:border-emerald-500/20 transition-all"
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done
                    ? "bg-green-500/20 text-green-400"
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
