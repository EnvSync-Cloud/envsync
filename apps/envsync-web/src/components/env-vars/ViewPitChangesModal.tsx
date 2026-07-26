import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	AlertCircle,
	Clock3,
	GitBranch,
	History,
	KeyRound,
	Loader2,
	MessageSquare,
	User,
} from "lucide-react";

import { sdk } from "@/api";
import { useEnvsAtPit } from "@/api/pointInTime.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	PitDataKind,
	PitHistoryItem,
} from "@/pages/PointInTimeVariables/pit.utils";
import {
	getPitItemLabel,
	getPitKindLabel,
	maskPitValue,
} from "@/pages/PointInTimeVariables/pit.utils";

interface ViewPitChangesModalProps {
	kind: PitDataKind;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	pitData: PitHistoryItem | null;
	projectId: string;
	environmentId: string;
}

export const ViewPitChangesModal = ({
	kind,
	isOpen,
	onOpenChange,
	pitData,
	projectId,
	environmentId,
}: ViewPitChangesModalProps) => {
	const { data: users = [] } = useQuery({
		queryKey: ["pit-users"],
		queryFn: async () => sdk.users.getUsers(),
		staleTime: 5 * 60 * 1000,
	});

	const usersMap = useMemo(
		() => new Map(users.map((entry) => [entry.id, entry])),
		[users]
	);

	const {
		data: pitStateData = [],
		isLoading,
		error,
	} = useEnvsAtPit(
		kind,
		{
			app_id: projectId,
			env_type_id: environmentId,
			pit_id: pitData?.id || "",
		},
		{
			enabled: isOpen && Boolean(pitData?.id && projectId && environmentId),
		}
	);

	if (!pitData) {
		return null;
	}

	const kindLabel = getPitKindLabel(kind);
	const itemLabel = getPitItemLabel(kind);
	const createdCount = pitStateData.filter((item) => item.operation === "CREATE").length;
	const updatedCount = pitStateData.filter((item) => item.operation === "UPDATE").length;
	const operationCount = createdCount + updatedCount;

	function getUserDisplayName(userId: string) {
		const user = usersMap.get(userId);
		if (user?.full_name?.trim()) return user.full_name;
		if (user?.email?.trim()) return user.email;
		if (userId.includes("@")) return userId.split("@")[0];
		return userId;
	}

	function formatDateTime(value: string) {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
	}

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-5xl flex-col border-border bg-card text-foreground">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<History className="size-5 text-emerald-400" />
						{kindLabel} Snapshot Details
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						Review the recorded snapshot metadata and the {itemLabel} state stored at this point in
						time.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Card className="border-border bg-card">
						<CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
							<div className="space-y-1">
								<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
									<GitBranch className="size-3.5" />
									PIT ID
								</p>
								<p className="font-mono text-sm text-foreground">{pitData.id}</p>
							</div>
							<div className="space-y-1">
								<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
									<Clock3 className="size-3.5" />
									Created at
								</p>
								<p className="text-sm text-foreground">{formatDateTime(pitData.created_at)}</p>
							</div>
							<div className="space-y-1">
								<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
									<User className="size-3.5" />
									Created by
								</p>
								<p className="text-sm text-foreground">{getUserDisplayName(pitData.user_id)}</p>
							</div>
							<div className="space-y-1">
								<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
									<KeyRound className="size-3.5" />
									Items in snapshot
								</p>
								<p className="text-sm text-foreground">{pitStateData.length}</p>
							</div>
							<div className="space-y-1">
								<p className="text-xs uppercase tracking-wide text-tertiary">Recorded changes</p>
								<p className="text-sm text-foreground">{pitData.changes_count}</p>
							</div>
						</CardContent>
					</Card>

					<Card className="border-border bg-card">
						<CardContent className="space-y-4 p-4">
							<div className="space-y-2">
								<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
									<MessageSquare className="size-3.5" />
									Message
								</p>
								<p className="text-sm text-foreground">{pitData.change_request_message}</p>
							</div>
							<Separator className="bg-muted" />
							<div className="flex flex-wrap items-center gap-2">
								<Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
									Current items: {pitStateData.length}
								</Badge>
								<Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
									Recorded ops: {operationCount || pitData.changes_count}
								</Badge>
								{kind === "secrets" && (
									<Badge className="border border-amber-500/20 bg-amber-500/10 text-amber-300">
										Values masked
									</Badge>
								)}
							</div>
						</CardContent>
					</Card>

					{error && (
						<Alert className="border-red-500/20 bg-red-500/10 text-red-200">
							<AlertCircle className="size-4" />
							<AlertDescription>
								Failed to load snapshot state: {error.message}
							</AlertDescription>
						</Alert>
					)}

					<Card className="flex-1 border-border bg-card">
						<CardHeader className="pb-3">
							<CardTitle className="text-base text-foreground">
								Snapshot state
							</CardTitle>
						</CardHeader>
						<CardContent className="px-0 pt-0">
							<ScrollArea className="max-h-[42vh]">
								{isLoading ? (
									<div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-muted-foreground">
										<Loader2 className="size-4 animate-spin" />
										Loading snapshot state...
									</div>
								) : pitStateData.length === 0 ? (
									<div className="px-6 py-16 text-center text-sm text-tertiary">
										No {itemLabel}s were present in this snapshot.
									</div>
								) : (
									<Table>
										<TableHeader>
											<TableRow className="border-border hover:bg-transparent">
												<TableHead className="text-tertiary">Key</TableHead>
												<TableHead className="text-tertiary">Value</TableHead>
												<TableHead className="text-tertiary">Operation</TableHead>
												<TableHead className="text-tertiary">Last updated</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{pitStateData.map((change) => (
												<TableRow
													key={`${pitData.id}-${change.key}`}
													className="border-border hover:bg-muted/60"
												>
													<TableCell className="font-mono text-sm text-foreground">
														{change.key}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{maskPitValue(change.value, kind)}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{change.operation ?? "Recorded"}
													</TableCell>
													<TableCell className="text-muted-foreground">
														{formatDateTime(change.last_updated)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</DialogContent>
		</Dialog>
	);
};
