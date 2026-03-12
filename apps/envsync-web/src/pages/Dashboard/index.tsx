import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { useDashboard } from "@/hooks/useDashboard";
import { BentoStatCard, statCardConfigs } from "./StatsCards";
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

      {/* Bento grid dashboard */}
      <BentoGrid>
        {/* Row 1: 4 stat cards across 3 columns (first 3 stats) */}
        {statCardConfigs.slice(0, 3).map((card) => (
          <BentoGridItem key={card.key}>
            <BentoStatCard
              label={card.label}
              value={stats[card.key]}
              icon={card.icon}
              gradient={card.gradient}
              iconColor={card.iconColor}
            />
          </BentoGridItem>
        ))}

        {/* Row 2: API Keys stat + Quick Actions (wide) */}
        <BentoGridItem>
          <BentoStatCard
            label={statCardConfigs[3].label}
            value={stats[statCardConfigs[3].key]}
            icon={statCardConfigs[3].icon}
            gradient={statCardConfigs[3].gradient}
            iconColor={statCardConfigs[3].iconColor}
          />
        </BentoGridItem>

        <BentoGridItem
          className="md:col-span-2"
          title="Quick Actions"
        >
          <QuickActions />
        </BentoGridItem>

        {/* Row 3-4: Recent Projects (wide+tall) + Recent Activity (tall) */}
        <BentoGridItem
          className="md:col-span-2 md:row-span-2"
          title={
            <div className="flex items-center justify-between w-full">
              <span>Recent Projects</span>
              <Link
                to="/applications"
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors font-normal"
              >
                View All
              </Link>
            </div>
          }
        >
          <ProjectsOverview projects={recentProjects} />
        </BentoGridItem>

        <BentoGridItem
          className="md:row-span-2"
          title="Recent Activity"
        >
          <RecentActivity auditLogs={auditLogs} isLoading={auditLoading} />
        </BentoGridItem>
      </BentoGrid>
    </PageShell>
  );
}
