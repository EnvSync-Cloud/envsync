import { ExternalLink, Eye, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
	PitMode,
} from "@/pages/PointInTimeVariables/pit.utils";
import {
	getPitItemLabel,
	truncateMessage,
	truncatePitId,
} from "@/pages/PointInTimeVariables/pit.utils";
import { cn } from "@/lib/utils";

interface PitHistoryTableProps {
	kind: PitDataKind;
	mode: PitMode;
	title: string;
	description: string;
	history: PitHistoryItem[];
	selectedPitId: string | null;
	totalPages: number;
	currentPage: number;
	isRefetching: boolean;
	isRollbackPending: boolean;
	onPageChange: (page: number) => void;
	onSelectRow: (pitId: string) => void;
	onUseForCompare: (pitId: string) => void;
	onViewChanges: (pitId: string) => void;
	onRollback: (pitId: string) => void;
	getUserLabel: (userId: string) => string;
	formatDateTime: (value: string) => string;
}

export const PitHistoryTable = ({
	kind,
	mode,
	title,
	description,
	history,
	selectedPitId,
	totalPages,
	currentPage,
	isRefetching,
	isRollbackPending,
	onPageChange,
	onSelectRow,
	onUseForCompare,
	onViewChanges,
	onRollback,
	getUserLabel,
	formatDateTime,
}: PitHistoryTableProps) => {
	const itemLabel = getPitItemLabel(kind);

	return (
		<Card className="border-border bg-card">
			<CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
				<div>
					<CardTitle className="text-base text-foreground">{title}</CardTitle>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{totalPages > 1 && (
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage - 1)}
							disabled={currentPage <= 1 || isRefetching}
							className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							Previous
						</Button>
						<span className="text-sm text-tertiary">
							Page {currentPage} of {totalPages}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage + 1)}
							disabled={currentPage >= totalPages || isRefetching}
							className="border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							Next
						</Button>
					</div>
				)}
			</CardHeader>
			<CardContent className="px-0 pb-0">
				<Table>
					<TableHeader>
						<TableRow className="border-border hover:bg-transparent">
							<TableHead className="text-tertiary">Snapshot</TableHead>
							<TableHead className="text-tertiary">Created at</TableHead>
							<TableHead className="text-tertiary">Changed by</TableHead>
							<TableHead className="text-tertiary">Changes</TableHead>
							<TableHead className="text-tertiary">Message</TableHead>
							<TableHead className="text-right text-tertiary">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{history.length === 0 && (
							<TableRow className="border-border hover:bg-transparent">
								<TableCell colSpan={6} className="py-10 text-center text-sm text-tertiary">
									{mode === "snapshots"
										? `No point-in-time snapshots exist for this environment's ${itemLabel}s yet.`
										: "No snapshots were found in the selected time range."}
								</TableCell>
							</TableRow>
						)}
						{history.map((pit) => {
							const isSelected = selectedPitId === pit.id;
							const rollbackEnabled = mode === "snapshots" || isSelected;

							return (
								<TableRow
									key={pit.id}
									onClick={() => onSelectRow(pit.id)}
									className={cn(
										"cursor-pointer border-border hover:bg-muted/60",
										isSelected && "bg-muted"
									)}
								>
									<TableCell>
										<div className="flex flex-col gap-1">
											<span className="font-mono text-sm text-foreground">
												{truncatePitId(pit.id)}
											</span>
											{isSelected && (
												<Badge className="w-fit border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
													Selected
												</Badge>
											)}
										</div>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatDateTime(pit.created_at)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{getUserLabel(pit.user_id)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{pit.changes_count}
									</TableCell>
									<TableCell className="max-w-[320px] text-muted-foreground">
										{truncateMessage(pit.change_request_message, 72)}
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap items-center justify-end gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={(event) => {
													event.stopPropagation();
													onUseForCompare(pit.id);
												}}
												className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
											>
												<ExternalLink className="mr-2 size-4" />
												Use for compare
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={(event) => {
													event.stopPropagation();
													onViewChanges(pit.id);
												}}
												className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
											>
												<Eye className="mr-2 size-4" />
												View changes
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={!rollbackEnabled || isRollbackPending}
												onClick={(event) => {
													event.stopPropagation();
													onRollback(pit.id);
												}}
												className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-amber-100 disabled:opacity-40"
											>
												<RotateCcw className="mr-2 size-4" />
												Rollback
											</Button>
										</div>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
};
