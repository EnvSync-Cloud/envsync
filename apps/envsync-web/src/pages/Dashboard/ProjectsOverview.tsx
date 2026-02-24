import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLastUsed } from "@/lib/utils";
import type { App } from "@/constants";

interface ProjectsOverviewProps {
  projects: App[];
}

export function ProjectsOverview({ projects }: ProjectsOverviewProps) {
  if (projects.length === 0) {
    return (
      <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
        <CardContent className="py-8 text-center">
          <p className="text-gray-500 text-sm">No projects yet</p>
          <Link
            to="/applications/create"
            className="text-sm text-violet-400 hover:text-violet-300 mt-2 inline-block transition-colors"
          >
            Create your first project →
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-300">
            Recent Projects
          </CardTitle>
          <Link
            to="/applications"
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            View All
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/applications/${project.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
                  <span className="text-sm font-semibold text-violet-400">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                    {project.name}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {project.env_count ?? 0} vars · {project.secret_count ?? 0}{" "}
                    secrets
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-gray-500">
                {formatLastUsed(project.updated_at.toString())}
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
