import { Link } from "react-router-dom";
import { formatLastUsed } from "@/lib/utils";
import { appDetailPath } from "@/lib/app-routes";
import type { App } from "@/constants";

interface ProjectsOverviewProps {
  projects: App[];
}

export function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8">
        <p className="text-muted-foreground text-sm">No projects yet</p>
        <Link
          to="/applications/create"
          className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-block transition-colors"
        >
          Create your first project →
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="dashboard-recent-projects"
      className="overflow-y-auto h-full space-y-1 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      {projects.map((project) => (
        <Link
          key={project.id}
          to={appDetailPath(project.id)}
          data-testid={`dashboard-project-${project.id}`}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-emerald-500/5 hover:translate-x-0.5 transition-all group"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <span className="text-sm font-semibold text-emerald-400">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground group-hover:text-emerald-400 transition-colors">
                {project.name}
              </p>
              {(() => {
                const configItemCount = (project.env_count ?? 0) + (project.secret_count ?? 0);

                return (
                  <p className="text-[11px] text-muted-foreground">
                    <span data-testid={`dashboard-project-${project.id}-count`}>
                      {configItemCount} vars / secrets
                    </span>
                  </p>
                );
              })()}
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatLastUsed(project.updated_at.toString())}
          </span>
        </Link>
      ))}
    </div>
  );
}
