import { LayoutDashboard, Plus, UserPlus, Key, Activity, ArrowRight, Database, Variable, Users, Shield, Clock, ChevronRight, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { PageError } from "@/components/ui/page-error";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "@/hooks/useDashboard";
import { formatLastUsed } from "@/lib/utils";
import { appDetailPath } from "@/lib/app-routes";

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

  return (
    <PageShell
      title="Dashboard"
      description="Overview of your workspace"
      icon={LayoutDashboard}
      isLoading={isLoading}
    >
      <OnboardingBanner
        hasProjects={stats.projectsCount > 0}
        hasTeamMembers={stats.teamMembersCount > 1}
        hasApiKeys={stats.apiKeysCount > 0}
      />

      {/* Quick actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Link to="/applications/create">
            <Plus className="size-4 mr-1.5" />
            Create Project
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          <Link to="/users">
            <UserPlus className="size-4 mr-1.5" />
            Invite Member
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
          <Link to="/apikeys">
            <Key className="size-4 mr-1.5" />
            API Keys
          </Link>
        </Button>
      </div>

      {/* 3-column quick access grid — Cloudflare style */}
      <div className="grid grid-cols-1 gap-0 @768px:grid-cols-3 border border-zinc-800 rounded-xl overflow-hidden">
        {/* Column 1: Projects */}
        <div className="border-b @768px:border-b-0 @768px:border-r border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-zinc-200">Projects</h3>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0">
                {stats.projectsCount}
              </Badge>
            </div>
            <Link to="/applications" className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              View all
            </Link>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {recentProjects.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-500">No projects yet</p>
                <Link to="/applications/create" className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 inline-block">
                  Create your first project →
                </Link>
              </div>
            ) : (
              recentProjects.map((project) => (
                <Link
                  key={project.id}
                  to={appDetailPath(project.id)}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30 last:border-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-7 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-emerald-400">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-zinc-200 truncate">{project.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-zinc-500">
                      {(project.env_count ?? 0) + (project.secret_count ?? 0)}
                    </span>
                    <ChevronRight className="size-3 text-zinc-600" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Security */}
        <div className="border-b @768px:border-b-0 @768px:border-r border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-amber-400" />
              <h3 className="text-sm font-medium text-zinc-200">Security</h3>
            </div>
          </div>
          <div>
            <Link
              to="/apikeys"
              className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded bg-zinc-800 flex items-center justify-center">
                  <Key className="size-3.5 text-amber-400" />
                </div>
                <span className="text-sm text-zinc-200">API Keys</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-100">{stats.apiKeysCount}</span>
                <ChevronRight className="size-3 text-zinc-600" />
              </div>
            </Link>
            <Link
              to="/gpgkeys"
              className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/30"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded bg-zinc-800 flex items-center justify-center">
                  <KeyRound className="size-3.5 text-blue-400" />
                </div>
                <span className="text-sm text-zinc-200">GPG Keys</span>
              </div>
              <ChevronRight className="size-3 text-zinc-600" />
            </Link>
            <Link
              to="/certificates"
              className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded bg-zinc-800 flex items-center justify-center">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                </div>
                <span className="text-sm text-zinc-200">Certificates</span>
              </div>
              <ChevronRight className="size-3 text-zinc-600" />
            </Link>
          </div>
        </div>

        {/* Column 3: Recents */}
        <div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-purple-400" />
              <h3 className="text-sm font-medium text-zinc-200">Recent Activity</h3>
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
                    <div className="size-7 rounded bg-zinc-800" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-zinc-800 rounded w-3/4" />
                      <div className="h-2 bg-zinc-800 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-500">No recent activity</p>
              </div>
            ) : (
              auditLogs.slice(0, 6).map((log, idx) => (
                <div
                  key={log.id ?? idx}
                  className="flex items-start gap-2.5 px-4 py-2.5 border-b border-zinc-800/30 last:border-0"
                >
                  <div className="size-7 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Activity className="size-3 text-zinc-400" />
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
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      {log.message || log.details || "No details"}
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

      {/* Stats overview */}
      <div className="grid grid-cols-2 @768px:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Projects</p>
            <Database className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.projectsCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Config Items</p>
            <Variable className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.variablesCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Team Members</p>
            <Users className="size-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.teamMembersCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">API Keys</p>
            <Shield className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{stats.apiKeysCount}</p>
        </div>
      </div>
    </PageShell>
  );
}
