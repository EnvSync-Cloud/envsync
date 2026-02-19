import { LayoutDashboard } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { useDashboard } from "@/hooks/useDashboard";
import { StatsCards } from "./StatsCards";
import { QuickActions } from "./QuickActions";
import { RecentActivity } from "./RecentActivity";
import { ProjectsOverview } from "./ProjectsOverview";

export default function Dashboard() {
  const { stats, recentProjects, auditLogs, isLoading, auditLoading } =
    useDashboard();

  return (
    <PageShell
      title="Dashboard"
      description="Overview of your workspace"
      icon={LayoutDashboard}
      isLoading={isLoading}
    >
      {/* Onboarding banner */}
      <OnboardingBanner
        hasProjects={stats.projectsCount > 0}
        hasTeamMembers={stats.teamMembersCount > 1}
        hasApiKeys={stats.apiKeysCount > 0}
      />

      {/* Stats cards */}
      <StatsCards stats={stats} />

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-medium text-gray-400 mb-3">
          Quick Actions
        </h2>
        <QuickActions />
      </div>

      {/* Two-column layout: Projects + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProjectsOverview projects={recentProjects} />
        </div>
        <div>
          <RecentActivity auditLogs={auditLogs} isLoading={auditLoading} />
        </div>
      </div>
    </PageShell>
  );
}
