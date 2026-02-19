import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  canEdit: boolean;
  onCreateProject: () => void;
}

export const EmptyState = ({ canEdit, onCreateProject }: EmptyStateProps) => {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center max-w-lg">
        {/* Geometric vault illustration */}
        <div className="mx-auto mb-8 w-24 h-24 relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rotate-6" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 -rotate-6" />
          <div className="relative w-24 h-24 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          No projects yet
        </h3>
        <p className="text-sm text-gray-400 mb-8 max-w-sm mx-auto">
          Create your first project to start managing environment variables and secrets.
        </p>

        {canEdit && (
          <div className="space-y-6">
            <Button
              onClick={onCreateProject}
              className="bg-violet-500 hover:bg-violet-600 text-white px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left max-w-md mx-auto">
              {[
                "Create a project",
                "Add env types",
                "Set variables",
                "Connect via CLI",
              ].map((step, i) => (
                <div
                  key={step}
                  className="flex items-center space-x-2 text-xs text-gray-500"
                >
                  <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-400 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                  {i < 3 && <ArrowRight className="w-3 h-3 text-gray-600 hidden md:block" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
