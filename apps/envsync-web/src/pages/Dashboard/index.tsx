import { LayoutDashboard, Plus, UserPlus, Key, Activity, Database, Variable, Users, Shield, Clock, ChevronRight, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { PageError } from "@/components/ui/page-error";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboard, type DashboardStats } from "@/hooks/useDashboard";
import { formatLastUsed, truncateUUIDs } from "@/lib/utils";
import { appDetailPath } from "@/lib/app-routes";

function StatValue({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-400">
        <AlertCircle className="size-4" />
        <span className="text-sm">Error</span>
      </span>
    );
  }
  return <>{value}</>;
}

export default function Dashboard() {
  const { stats, recentProjects, auditLogs, isLoading, auditLoading, error } = useDashboard();

  if (error) {
    return (
      <PageError
        title="Failed to load dashboard"
        message={error instanceof Error ? error.message : "An unexpected error occurred"}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const hasProjects = stats.projectsCount !== null && stats.projectsCount > 0;

  return (
    <PageShell
      title="Dashboard"
      description="Overview of your workspace"
      icon={LayoutDashboard}
      isLoading={isLoading}
      stats={[
        {
          label: "Projects",
          value: <StatValue value={stats.projectsCount} />,
          tone: stats.projectsCount === null ? "warning" : "default",
        },
        {
          label: "Config Items",
          value: <StatValue value={stats.variablesCount} />,
          tone: stats.variablesCount === null ? "warning" : "default",
        },
        {
          label: "Team Members",
          value: <StatValue value={stats.teamMembersCount} />,
          tone: stats.teamMembersCount === null ? "warning" : "default",
        },
        {
          label: "API Keys",
          value: <StatValue value={stats.apiKeysCount} />,
          tone: stats.apiKeysCount === null ? "warning" : "default",
        },
      ]}
    >
      {/* Quick actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link to="/applications/create">
            <Plus className="size-4 mr-1.5" />
            Create Project
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/users">
            <UserPlus className="size-4 mr-1.5" />
            Invite Member
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/apikeys">
            <Key className="size-4 mr-1.5" />
            API Keys
          </Link>
        </Button>
      </div>

      {/* 2-column grid: Projects + Recent Activity */}
      <div className="grid grid-cols-1 gap-0 @768px:grid-cols-2 border border-border rounded-xl overflow-hidden">
        {/* Column 1: Projects */}
        <div className="border-b @768px:border-b-0 @768px:border-r border-border">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-foreground">Projects</h3>
              {stats.projectsCount !== null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {stats.projectsCount}
                </Badge>
              )}
            </div>
            <Link to="/applications" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {recentProjects.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">No projects yet</p>
                {!hasProjects && (
                  <Link to="/applications/create" className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                    Create your first project →
                  </Link>
                )}
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={appDetailPath(project.id)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-emerald-400">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-foreground truncate">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground">
                      {(project.env_count ?? 0) + (project.secret_count ?? 0)}
                    </span>
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Recents */}
        <div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-purple-400" />
              <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
            </div>
            <Link to="/audit" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {auditLoading ? (
              <div className="px-4 py-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="size-7 rounded bg-muted" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              auditLogs.slice(0, 6).map((log, idx) => (
                <div
                  key={log.id ?? idx}
                  className="flex items-start gap-2.5 px-4 py-2.5 border-b border-border last:border-0"
                >
                  <div className="size-7 rounded bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="size-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      >
                        {log.action?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {truncateUUIDs(log.message || log.details || "No details")}
                      {log.created_at && (
                        <span className="ml-1">· {formatLastUsed(log.created_at)}</span>
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Onboarding banner - only shows for new users, dismissible */}
      <OnboardingBanner
        hasProjects={hasProjects}
        hasTeamMembers={(stats.teamMembersCount ?? 0) > 1}
        hasApiKeys={(stats.apiKeysCount ?? 0) > 0}
      />
    </PageShell>
  );
}
