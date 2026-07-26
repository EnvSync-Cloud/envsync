import { useState } from "react";
import {
	AlertTriangle,
	Clock3,
	Eye,
	EyeOff,
	GitBranch,
	History,
	Loader2,
	RotateCcw,
	User,
} from "lucide-react";

import { useVariableTimeline, useVariableRollback } from "@/api/pointInTime.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { EnvironmentVariable } from "@/constants";
import { maskPitValue, type PitDataKind } from "@/pages/PointInTimeVariables/pit.utils";

interface VariableHistoryDrawerProps {
	variable: EnvironmentVariable | null;
	kind: PitDataKind;
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export const VariableHistoryDrawer = ({
	variable,
	kind,
	isOpen,
	onOpenChange,
}: VariableHistoryDrawerProps) => {
	const [showSensitive, setShowSensitive] = useState<Record<number, boolean>>({});
	const [rollbackTargetIndex, setRollbackTargetIndex] = useState<number | null>(null);
	const [rollbackMessage, setRollbackMessage] = useState("");
	const [confirmPitId, setConfirmPitId] = useState("");

	const { data: timeline = [], isLoading, error } = useVariableTimeline(
		kind,
		{
			app_id: variable?.app_id || "",
			env_type_id: variable?.env_type_id || "",
			key: variable?.key || "",
		},
		{
			enabled: isOpen && Boolean(variable?.key && variable?.app_id && variable?.env_type_id),
		}
	);

	const { rollbackVariableToPit } = useVariableRollback();

	const isSecrets = kind === "secrets";
	const isRollbackPending = rollbackVariableToPit.isPending;

	function toggleSensitiveVisibility(index: number) {
		setShowSensitive((prev) => ({
			...prev,
			[index]: !prev[index],
		}));
	}

	function formatDateTime(value: string) {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: "medium",
			timeStyle: "short",
		});
	}

	function getOperationBadge(operation: string) {
		switch (operation) {
			case "CREATE":
				return (
					<Badge className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
						Created
					</Badge>
				);
			case "UPDATE":
				return (
					<Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
						Updated
					</Badge>
				);
			case "DELETE":
				return (
					<Badge className="border border-red-500/20 bg-red-500/10 text-red-300">
						Deleted
					</Badge>
				);
			default:
				return (
					<Badge className="border border-zinc-500/20 bg-zinc-500/10 text-muted-foreground">
						Recorded
					</Badge>
				);
		}
	}

	function handleOpenRollback(index: number) {
		const entry = timeline[index];
		if (!entry) return;
		setRollbackTargetIndex(index);
		setConfirmPitId("");
		setRollbackMessage(`Rollback ${variable?.key} to snapshot ${entry.pit_id}`);
	}

	function handleCancelRollback() {
		setRollbackTargetIndex(null);
		setConfirmPitId("");
		setRollbackMessage("");
	}

	function handleConfirmRollback() {
		if (!variable || rollbackTargetIndex === null) return;
		const entry = timeline[rollbackTargetIndex];
		if (!entry) return;

		rollbackVariableToPit.mutate(
			{
				key: variable.key,
				app_id: variable.app_id,
				env_type_id: variable.env_type_id,
				pit_id: entry.pit_id,
				rollback_message: rollbackMessage.trim(),
			},
			{
				onSuccess: () => {
					handleCancelRollback();
				},
			}
		);
	}

	const canSubmitRollback =
		rollbackTargetIndex !== null &&
		confirmPitId.trim() === timeline[rollbackTargetIndex]?.pit_id &&
		rollbackMessage.trim().length > 0;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[90vh] max-w-3xl flex-col border-border bg-card text-foreground">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<History className="size-5 text-emerald-400" />
						Version History
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{variable ? (
							<span>
								Viewing timeline for <code className="font-mono text-emerald-400">{variable.key}</code>
							</span>
						) : (
							"Select a variable to view its history"
						)}
					</DialogDescription>
				</DialogHeader>

				{!variable ? (
					<div className="flex items-center justify-center py-16 text-sm text-tertiary">
						No variable selected
					</div>
				) : isLoading ? (
					<div className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Loading version history...
					</div>
				) : error ? (
					<div className="flex items-center justify-center gap-3 py-16 text-sm text-red-400">
						<AlertTriangle className="size-4" />
						Failed to load version history: {error.message}
					</div>
				) : timeline.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-tertiary">
						<History className="size-8 text-zinc-600" />
						No version history available for this variable
					</div>
				) : (
					<ScrollArea className="flex-1 pr-4">
						<div className="space-y-4 pb-4">
							{timeline.map((entry, index) => {
								const isRollbackTarget = rollbackTargetIndex === index;
								const displayValue = isSecrets
									? showSensitive[index]
										? entry.value
										: "••••••••"
									: entry.value;

								return (
									<div key={`${entry.pit_id}-${index}`} className="space-y-3">
										<div className="rounded-lg border border-border bg-card p-4">
											<div className="mb-3 flex items-center justify-between">
												<div className="flex items-center gap-3">
													{getOperationBadge(entry.operation)}
													<div className="flex items-center gap-2 text-xs text-tertiary">
														<Clock3 className="size-3.5" />
														{formatDateTime(entry.created_at)}
													</div>
												</div>
												{entry.operation !== "DELETE" && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
														onClick={() => handleOpenRollback(index)}
														disabled={isRollbackTarget}
													>
														<RotateCcw className="mr-2 size-3.5" />
														Rollback
													</Button>
												)}
											</div>

											<div className="grid gap-3 md:grid-cols-3">
												<div className="space-y-1">
													<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
														<GitBranch className="size-3" />
														PIT ID
													</p>
													<p className="font-mono text-xs text-muted-foreground">{entry.pit_id}</p>
												</div>
												<div className="space-y-1">
													<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
														<User className="size-3" />
														Changed by
													</p>
													<p className="text-sm text-foreground">{entry.user_id}</p>
												</div>
												<div className="space-y-1">
													<p className="text-xs uppercase tracking-wide text-tertiary">Message</p>
													<p className="text-sm text-foreground">{entry.change_request_message}</p>
												</div>
											</div>

											{entry.operation !== "DELETE" && (
												<>
													<Separator className="my-3 bg-muted" />
													<div className="space-y-2">
														<div className="flex items-center justify-between">
															<p className="text-xs uppercase tracking-wide text-tertiary">Value</p>
															{isSecrets && (
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
																	onClick={() => toggleSensitiveVisibility(index)}
																>
																	{showSensitive[index] ? (
																		<>
																			<EyeOff className="mr-1 size-3" />
																			Hide
																		</>
																	) : (
																		<>
																			<Eye className="mr-1 size-3" />
																			Reveal
																		</>
																	)}
																</Button>
															)}
														</div>
														<code className="block rounded bg-card px-3 py-2 font-mono text-sm text-foreground break-all">
															{displayValue}
														</code>
													</div>
												</>
											)}
										</div>

										{isRollbackTarget && (
											<div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
												<div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-200">
													<AlertTriangle className="size-4" />
													Confirm rollback to this snapshot
												</div>
												<div className="space-y-3">
													<div className="space-y-1">
														<Label htmlFor="rollback-confirm-pit" className="text-foreground">
															Type the PIT ID to confirm
														</Label>
														<Input
															id="rollback-confirm-pit"
															value={confirmPitId}
															onChange={(e) => setConfirmPitId(e.target.value)}
															placeholder={entry.pit_id}
															autoComplete="off"
															className="border-border bg-card text-foreground"
														/>
													</div>
													<div className="space-y-1">
														<Label htmlFor="rollback-message" className="text-foreground">
															Rollback message
														</Label>
														<Textarea
															id="rollback-message"
															value={rollbackMessage}
															onChange={(e) => setRollbackMessage(e.target.value)}
															placeholder={`Rollback ${variable.key} to snapshot ${entry.pit_id}`}
															className="min-h-20 border-border bg-card text-foreground"
														/>
													</div>
													<div className="flex items-center gap-2">
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={handleCancelRollback}
															className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
														>
															Cancel
														</Button>
														<Button
															type="button"
															size="sm"
															onClick={handleConfirmRollback}
															disabled={!canSubmitRollback || isRollbackPending}
															className="bg-amber-600 text-foreground hover:bg-amber-500"
														>
															{isRollbackPending ? "Rolling back..." : "Confirm Rollback"}
														</Button>
													</div>
												</div>
											</div>
										)}

										{index < timeline.length - 1 && (
											<div className="flex justify-center">
												<div className="h-4 w-px bg-muted" />
											</div>
										)}
									</div>
								);
							})}
						</div>
					</ScrollArea>
				)}
			</DialogContent>
		</Dialog>
	);
};
