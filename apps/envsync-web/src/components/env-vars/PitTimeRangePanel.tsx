import { CalendarRange, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
	PitDataKind,
	PitRangePreset,
	PitRangeState,
} from "@/pages/PointInTimeVariables/pit.utils";
import {
	getPitKindLabel,
	getPresetLabel,
	toLocalDateTimeInputValue,
	toIsoFromLocalDateTime,
} from "@/pages/PointInTimeVariables/pit.utils";

interface PitTimeRangePanelProps {
	kind: PitDataKind;
	range: PitRangeState;
	timezoneLabel: string;
	isPreviewPending: boolean;
	onPresetChange: (preset: PitRangePreset) => void;
	onCustomRangeChange: (nextRange: Pick<PitRangeState, "start" | "end">) => void;
	onPreview: () => void;
}

const PRESETS: PitRangePreset[] = ["24h", "7d", "30d", "all"];

export const PitTimeRangePanel = ({
	kind,
	range,
	timezoneLabel,
	isPreviewPending,
	onPresetChange,
	onCustomRangeChange,
	onPreview,
}: PitTimeRangePanelProps) => {
	const kindLabel = getPitKindLabel(kind);

	return (
		<Card className="border-border bg-card">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-base text-foreground">
					<CalendarRange className="size-4 text-cyan-400" />
					{kindLabel} time-range compare
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap items-center gap-2">
					{PRESETS.map((preset) => (
						<Button
							key={preset}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onPresetChange(preset)}
							className={
								range.preset === preset
									? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
									: "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
							}
						>
							{preset === "all" ? "All" : preset}
						</Button>
					))}
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					<div className="space-y-2">
						<Label className="text-muted-foreground">Range start</Label>
						<Input
							type="datetime-local"
							value={toLocalDateTimeInputValue(range.start)}
							onChange={(event) =>
								onCustomRangeChange({
									start: toIsoFromLocalDateTime(event.target.value),
									end: range.end,
								})
							}
							className="border-border bg-card text-foreground"
						/>
					</div>
					<div className="space-y-2">
						<Label className="text-muted-foreground">Range end</Label>
						<Input
							type="datetime-local"
							value={toLocalDateTimeInputValue(range.end)}
							onChange={(event) =>
								onCustomRangeChange({
									start: range.start,
									end: toIsoFromLocalDateTime(event.target.value),
								})
							}
							className="border-border bg-card text-foreground"
						/>
					</div>
				</div>

				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="space-y-1 text-sm text-muted-foreground">
						<p>{getPresetLabel(range.preset)}</p>
						<p className="inline-flex items-center gap-2">
							<Clock3 className="size-4 text-cyan-400" />
							Timezone: {timezoneLabel}
						</p>
					</div>
					<Button
						onClick={onPreview}
						disabled={!range.start || !range.end || isPreviewPending}
						className="bg-cyan-600 text-foreground hover:bg-cyan-500"
					>
						<CalendarRange className="mr-2 size-4" />
						{isPreviewPending ? "Loading..." : "Preview range diff"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
