import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { EnvironmentType } from "@/constants";
import type {
	PitHistoryItem,
} from "@/pages/PointInTimeVariables/pit.utils";
import {
	truncateMessage,
	truncatePitId,
} from "@/pages/PointInTimeVariables/pit.utils";

interface PitSnapshotComparePanelProps {
	history: PitHistoryItem[];
	environmentTypes: EnvironmentType[];
	selectedEnvironmentId?: string;
	onEnvironmentChange?: (environmentId: string) => void;
	compareFromPitId: string | null;
	compareToPitId: string | null;
	onCompareFromChange: (pitId: string) => void;
	onCompareToChange: (pitId: string) => void;
	onPreview: () => void;
	onRestore?: () => void;
	isPreviewPending: boolean;
	isRestorePending?: boolean;
	getUserLabel: (userId: string) => string;
	formatDateTime: (value: string) => string;
}

export const PitSnapshotComparePanel = ({
	kind,
	history,
	environmentTypes,
	selectedEnvironmentId,
	onEnvironmentChange,
	compareFromPitId,
	compareToPitId,
	onCompareFromChange,
	onCompareToChange,
	onPreview,
	onRestore,
	isPreviewPending,
	isRestorePending,
	getUserLabel,
	formatDateTime,
}: PitSnapshotComparePanelProps) => {
	const canCompare = history.length >= 2 && compareFromPitId && compareToPitId && compareFromPitId !== compareToPitId;
	const compareFromPit = history.find((pit) => pit.id === compareFromPitId) ?? null;
	const compareToPit = history.find((pit) => pit.id === compareToPitId) ?? null;

	const renderSelectedSnapshot = (pit: PitHistoryItem | null, placeholder: string) => {
		if (!pit) {
			return <SelectValue placeholder={placeholder} />;
		}

		return (
			<span
				className="block min-w-0 truncate text-left"
				title={`${formatDateTime(pit.created_at)} · ${getUserLabel(pit.user_id)} · ${pit.change_request_message} · ${pit.id}`}
			>
				{formatDateTime(pit.created_at)} · {truncateMessage(pit.change_request_message, 42)} · {truncatePitId(pit.id)}
			</span>
		);
	};

	return (
		<Card className="border-border bg-card">
			<CardHeader className="pb-3">
				<CardTitle className="text-base text-foreground">Restore from history</CardTitle>
				<p className="text-sm text-muted-foreground">
					{history.length === 0
						? "No snapshots yet."
						: "Pick a snapshot, preview the change, or restore it."}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] lg:items-end">
					<div className="min-w-0 space-y-2">
						<Label className="text-muted-foreground">Environment</Label>
						<Select
							value={selectedEnvironmentId}
							onValueChange={onEnvironmentChange}
							disabled={!onEnvironmentChange || environmentTypes.length === 0}
						>
							<SelectTrigger className="border-border bg-background text-foreground">
								<SelectValue placeholder="Select environment" />
							</SelectTrigger>
							<SelectContent className="border-border bg-card text-foreground">
								{environmentTypes.map((environment) => (
									<SelectItem key={environment.id} value={environment.id}>
										{environment.name}
										{environment.is_default ? " · Default" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="min-w-0 space-y-2">
						<Label className="text-muted-foreground">Point in time</Label>
						<Select
							value={compareToPitId ?? undefined}
							onValueChange={onCompareToChange}
							disabled={history.length === 0}
						>
							<SelectTrigger className="overflow-hidden border-border bg-background text-foreground">
								{renderSelectedSnapshot(compareToPit, "No snapshots")}
							</SelectTrigger>
							<SelectContent className="border-border bg-card text-foreground">
								{history.map((pit) => (
									<SelectItem key={pit.id} value={pit.id}>
										{formatDateTime(pit.created_at)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							onClick={onPreview}
							disabled={!canCompare || isPreviewPending}
						>
							{isPreviewPending ? "Loading..." : "Preview comparison"}
						</Button>
						<Button
							onClick={onRestore}
							disabled={!compareToPit || isRestorePending}
						>
							Restore
						</Button>
					</div>
				</div>
				{compareToPit ? (
					<p className="text-xs text-muted-foreground">
						{getUserLabel(compareToPit.user_id)} · {truncateMessage(compareToPit.change_request_message, 80)} · {compareToPit.changes_count} change{compareToPit.changes_count === 1 ? "" : "s"}
					</p>
				) : null}
				{history.length >= 2 ? (
					<div className="max-w-md space-y-2">
						<Label className="text-muted-foreground">Compare with</Label>
						<Select
							value={compareFromPitId ?? undefined}
							onValueChange={onCompareFromChange}
						>
							<SelectTrigger className="overflow-hidden border-border bg-background text-foreground">
								{renderSelectedSnapshot(compareFromPit, "Earlier snapshot")}
							</SelectTrigger>
							<SelectContent className="border-border bg-card text-foreground">
								{history.map((pit) => (
									<SelectItem key={pit.id} value={pit.id}>
										{formatDateTime(pit.created_at)} · {truncatePitId(pit.id)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};
