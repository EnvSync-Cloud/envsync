import { GitCompareArrows, History } from "lucide-react";

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
import type {
	PitDataKind,
	PitHistoryItem,
} from "@/pages/PointInTimeVariables/pit.utils";
import {
	getPitKindLabel,
	truncateMessage,
	truncatePitId,
} from "@/pages/PointInTimeVariables/pit.utils";

interface PitSnapshotComparePanelProps {
	kind: PitDataKind;
	history: PitHistoryItem[];
	compareFromPitId: string | null;
	compareToPitId: string | null;
	onCompareFromChange: (pitId: string) => void;
	onCompareToChange: (pitId: string) => void;
	onPreview: () => void;
	isPreviewPending: boolean;
	getUserLabel: (userId: string) => string;
	formatDateTime: (value: string) => string;
}

export const PitSnapshotComparePanel = ({
	kind,
	history,
	compareFromPitId,
	compareToPitId,
	onCompareFromChange,
	onCompareToChange,
	onPreview,
	isPreviewPending,
	getUserLabel,
	formatDateTime,
}: PitSnapshotComparePanelProps) => {
	const canCompare = history.length >= 2 && compareFromPitId && compareToPitId && compareFromPitId !== compareToPitId;
	const compareFromPit = history.find((pit) => pit.id === compareFromPitId) ?? null;
	const compareToPit = history.find((pit) => pit.id === compareToPitId) ?? null;
	const kindLabel = getPitKindLabel(kind);

	const renderSelectedSnapshot = (pit: PitHistoryItem | null, placeholder: string) => {
		if (!pit) {
			return <SelectValue placeholder={placeholder} />;
		}

		return (
			<span
				className="block min-w-0 truncate text-left"
				title={`${formatDateTime(pit.created_at)} · ${getUserLabel(pit.user_id)} · ${pit.change_request_message}`}
			>
				{formatDateTime(pit.created_at)}
			</span>
		);
	};

	return (
		<Card className="border-border bg-card">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-base text-foreground">
					<History className="size-4 text-emerald-400" />
					{kindLabel} snapshot compare
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]">
					<div className="min-w-0 space-y-2">
						<Label className="text-muted-foreground">Compare from</Label>
						<Select
							value={compareFromPitId ?? undefined}
							onValueChange={onCompareFromChange}
							disabled={history.length < 2}
						>
							<SelectTrigger className="overflow-hidden border-border bg-card text-foreground">
								{renderSelectedSnapshot(compareFromPit, "Choose an earlier snapshot")}
							</SelectTrigger>
							<SelectContent className="border-border bg-card text-foreground">
								{history.map((pit) => (
									<SelectItem key={pit.id} value={pit.id}>
										<div className="flex max-w-[320px] flex-col gap-0.5 py-1">
											<span className="text-sm text-foreground">{formatDateTime(pit.created_at)}</span>
											<span className="text-xs text-muted-foreground">
												{getUserLabel(pit.user_id)} · {truncateMessage(pit.change_request_message, 40)}
											</span>
											<span className="font-mono text-[11px] text-tertiary">
												{truncatePitId(pit.id)}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="min-w-0 space-y-2">
						<Label className="text-muted-foreground">Compare to</Label>
						<Select
							value={compareToPitId ?? undefined}
							onValueChange={onCompareToChange}
							disabled={history.length < 2}
						>
							<SelectTrigger className="overflow-hidden border-border bg-card text-foreground">
								{renderSelectedSnapshot(compareToPit, "Choose a target snapshot")}
							</SelectTrigger>
							<SelectContent className="border-border bg-card text-foreground">
								{history.map((pit) => (
									<SelectItem key={pit.id} value={pit.id}>
										<div className="flex max-w-[320px] flex-col gap-0.5 py-1">
											<span className="text-sm text-foreground">{formatDateTime(pit.created_at)}</span>
											<span className="text-xs text-muted-foreground">
												{getUserLabel(pit.user_id)} · {truncateMessage(pit.change_request_message, 40)}
											</span>
											<span className="font-mono text-[11px] text-tertiary">
												{truncatePitId(pit.id)}
											</span>
										</div>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="min-w-0 space-y-2">
						<Label className="sr-only">Preview</Label>
						<Button
							onClick={onPreview}
							disabled={!canCompare || isPreviewPending}
							className="bg-emerald-600 text-foreground hover:bg-emerald-500"
						>
							<GitCompareArrows className="mr-2 size-4" />
							{isPreviewPending ? "Loading..." : "Preview comparison"}
						</Button>
						{history.length < 2 ? (
							<p className="text-xs text-muted-foreground">Need two snapshots.</p>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
