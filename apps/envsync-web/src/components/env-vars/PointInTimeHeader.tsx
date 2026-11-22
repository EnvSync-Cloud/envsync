import { useLocation, useNavigate, useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

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
}

export const PointInTimeHeader = ({
	projectName,
	environmentTypes,
	selectedEnvironmentId,
	isRefetching,
	enableSecrets,
	onRefresh,
	onEnvironmentChange,
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

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-3">
				<div className="space-y-1">
					<h1 className="text-2xl font-medium text-foreground">Recovery</h1>
					<p className="text-sm text-muted-foreground">
						{projectName}
						{selectedEnvironment ? ` / ${selectedEnvironment.name}` : ""}
						{selectedEnvironment?.is_default ? " · Default" : ""}
					</p>
				</div>

				{enableSecrets ? (
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
				) : (
					<p className="text-sm text-muted-foreground">{currentSection}</p>
				)}
			</div>
			<Button
				variant="outline"
				size="sm"
				onClick={onRefresh}
				disabled={isRefetching}
			>
				<RefreshCw className={cn("mr-2 size-4", isRefetching && "animate-spin")} />
				Refresh history
			</Button>
		</div>
	);
};
