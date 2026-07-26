import { AlertTriangle, GitBranch, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PitDataKind, PitHistoryItem } from "@/pages/PointInTimeVariables/pit.utils";
import {
	canSubmitPitRollback,
	getPitItemLabel,
	getPitKindLabel,
} from "@/pages/PointInTimeVariables/pit.utils";

interface PitRollbackDialogProps {
	kind: PitDataKind;
	pit: PitHistoryItem | null;
	isOpen: boolean;
	typedPitId: string;
	rollbackMessage: string;
	isSubmitting: boolean;
	onOpenChange: (open: boolean) => void;
	onTypedPitIdChange: (value: string) => void;
	onRollbackMessageChange: (value: string) => void;
	onConfirm: () => void;
}

export const PitRollbackDialog = ({
	kind,
	pit,
	isOpen,
	typedPitId,
	rollbackMessage,
	isSubmitting,
	onOpenChange,
	onTypedPitIdChange,
	onRollbackMessageChange,
	onConfirm,
}: PitRollbackDialogProps) => {
	if (!pit) {
		return null;
	}

	const itemLabel = getPitItemLabel(kind);
	const kindLabel = getPitKindLabel(kind);
	const canSubmit = canSubmitPitRollback({
		expectedPitId: pit.id,
		typedPitId,
		rollbackMessage,
	});

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="border-border bg-card text-foreground sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RotateCcw className="size-5 text-amber-300" />
						Confirm {kindLabel} Snapshot Rollback
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						This restores the selected environment&apos;s {itemLabel}s to the exact state captured by
						the chosen point-in-time snapshot.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
						<div className="mb-2 flex items-center gap-2 font-medium">
							<AlertTriangle className="size-4" />
							Review before continuing
						</div>
						<p>
							This action rewrites the current {itemLabel} set for the selected environment. Type the
							full PIT ID and provide a rollback message to continue.
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<Badge className="border border-border bg-card text-foreground">
							<GitBranch className="mr-2 size-3.5" />
							{pit.id}
						</Badge>
						<Badge className="border border-border bg-card text-muted-foreground">
							{pit.changes_count} changes
						</Badge>
					</div>

					<div className="space-y-2">
						<Label htmlFor="pit-rollback-confirm-id" className="text-foreground">
							Type the exact PIT ID
						</Label>
						<Input
							id="pit-rollback-confirm-id"
							value={typedPitId}
							onChange={(event) => onTypedPitIdChange(event.target.value)}
							placeholder={pit.id}
							autoComplete="off"
							className="border-border bg-card text-foreground"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="pit-rollback-message" className="text-foreground">
							Rollback message
						</Label>
						<Textarea
							id="pit-rollback-message"
							value={rollbackMessage}
							onChange={(event) => onRollbackMessageChange(event.target.value)}
							placeholder={`Rollback ${itemLabel}s to snapshot ${pit.id}`}
							className="min-h-24 border-border bg-card text-foreground"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground"
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={onConfirm}
						disabled={!canSubmit || isSubmitting}
						className="bg-amber-600 text-foreground hover:bg-amber-500"
					>
						{isSubmitting ? "Rolling back..." : `Rollback ${kindLabel}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
