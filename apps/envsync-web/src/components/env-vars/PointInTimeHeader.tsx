import type { ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DatabaseBackup, RefreshCw } from "lucide-react";

import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnvironmentType } from "@/constants";
import {
	buildPitHref,
	getPitKindFromPathname,
} from "@/pages/PointInTimeVariables/pit.utils";

interface PointInTimeHeaderProps {
	projectName: string;
	environmentTypes: EnvironmentType[];
	selectedEnvironmentId?: string;
	isRefetching: boolean;
	enableSecrets?: boolean;
	onRefresh: () => void;
	onEnvironmentChange?: (environmentId: string) => void;
	children: ReactNode;
}

export const PointInTimeHeader = ({
	projectName,
	environmentTypes,
	selectedEnvironmentId,
	isRefetching,
	enableSecrets,
	onRefresh,
	children,
}: PointInTimeHeaderProps) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { appId } = useParams();

	const isSecretsPage = getPitKindFromPathname(location.pathname) === "secrets";
	const currentSection = isSecretsPage ? "Secrets" : "Variables";
	const selectedEnvironment =
		environmentTypes.find((environment) => environment.id === selectedEnvironmentId) ??
		environmentTypes[0];

	function handleSectionChange(section: "variables" | "secrets") {
		if (!appId) return;
		const query = selectedEnvironment?.name?.toLowerCase();
		navigate(buildPitHref(appId, section, query));
	}

	const environmentLabel = selectedEnvironment
		? `${projectName} / ${selectedEnvironment.name}${selectedEnvironment.is_default ? " · Default" : ""}`
		: projectName;

	return (
		<PageShell
			title="Recovery"
			icon={DatabaseBackup}
			description={`${environmentLabel}. Earlier versions of ${currentSection.toLowerCase()} in this environment.`}
			actions={
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					disabled={isRefetching}
				>
					<RefreshCw className={cn("mr-2 size-4", isRefetching && "animate-spin")} />
					Refresh history
				</Button>
			}
			secondaryNav={
				enableSecrets ? (
					<div className="inline-flex items-center rounded-lg border border-border p-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => handleSectionChange("variables")}
							className={cn(
								"h-8 rounded-md px-3 text-sm",
								!isSecretsPage
									? "bg-muted text-foreground hover:bg-muted"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Variables
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => handleSectionChange("secrets")}
							className={cn(
								"h-8 rounded-md px-3 text-sm",
								isSecretsPage
									? "bg-muted text-foreground hover:bg-muted"
									: "text-muted-foreground hover:text-foreground"
							)}
						>
							Secrets
						</Button>
					</div>
				) : null
			}
		>
			{children}
		</PageShell>
	);
};
