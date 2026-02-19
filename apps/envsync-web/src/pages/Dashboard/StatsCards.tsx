import { Database, Variable, Users, Key } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  stats: {
    projectsCount: number;
    variablesCount: number;
    teamMembersCount: number;
    apiKeysCount: number;
  };
}

const cards = [
  {
    label: "Projects",
    key: "projectsCount" as const,
    icon: Database,
    gradient: "from-violet-500/20 to-violet-600/20",
    iconColor: "text-violet-400",
  },
  {
    label: "Variables",
    key: "variablesCount" as const,
    icon: Variable,
    gradient: "from-indigo-500/20 to-indigo-600/20",
    iconColor: "text-indigo-400",
  },
  {
    label: "Team Members",
    key: "teamMembersCount" as const,
    icon: Users,
    gradient: "from-blue-500/20 to-blue-600/20",
    iconColor: "text-blue-400",
  },
  {
    label: "API Keys",
    key: "apiKeysCount" as const,
    icon: Key,
    gradient: "from-emerald-500/20 to-emerald-600/20",
    iconColor: "text-emerald-400",
  },
];

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.key}
            className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl hover:border-gray-700 transition-colors"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{card.label}</p>
                  <p className="text-2xl font-semibold text-gray-100 mt-1">
                    {stats[card.key]}
                  </p>
                </div>
                <div
                  className={`p-2.5 rounded-lg bg-gradient-to-br ${card.gradient}`}
                >
                  <Icon className={`size-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
