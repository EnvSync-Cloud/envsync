import { startTransition, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Clock3, GitBranch, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";

import { sdk } from "@/api";
import {
	usePointInTimeDiff,
	usePointInTimeHistory,
	usePointInTimeRollback,
	usePointInTimeTimestampRangeDiff,
} from "@/api/pointInTime.api";
import { PitDiffResults } from "@/components/env-vars/PitDiffResults";
import { PitHistoryTable } from "@/components/env-vars/PitHistoryTable";
import { PitModeSwitch } from "@/components/env-vars/PitModeSwitch";
import { PitRollbackDialog } from "@/components/env-vars/PitRollbackDialog";
import { PitSnapshotComparePanel } from "@/components/env-vars/PitSnapshotComparePanel";
import { PitTimeRangePanel } from "@/components/env-vars/PitTimeRangePanel";
import { PointInTimeHeader } from "@/components/env-vars/PointInTimeHeader";
import { ViewPitChangesModal } from "@/components/env-vars/ViewPitChangesModal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectEnvironments } from "@/hooks/useProjectEnvironments";
import {
	createDefaultTimeRange,
	createPresetRange,
	getDefaultSnapshotCompareIds,
	getPitItemLabel,
	getPitKindFromPathname,
	getPitKindLabel,
	getPitRangeSummary,
	type PitDataKind,
	type PitHistoryItem,
	type PitMode,
	type PitRangePreset,
	type PitRangeState,
} from "./pit.utils";
import { PointInTimeErrorPage } from "./error";
import { PointInTimeLoadingPage } from "./loading";

const SNAPSHOT_PAGE_SIZE = 20;
const RANGE_PAGE_SIZE = 100;

const PointInTime = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { appId, environmentNameId } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const selectedEnvSlug = searchParams.get("env") || environmentNameId;
	const kind = getPitKindFromPathname(location.pathname);
	const kindLabel = getPitKindLabel(kind);
	const itemLabel = getPitItemLabel(kind);

	const [activeMode, setActiveMode] = useState<PitMode>("snapshots");
	const [snapshotPage, setSnapshotPage] = useState(1);
	const [rangePage, setRangePage] = useState(1);
	const [selectedSnapshotPitId, setSelectedSnapshotPitId] = useState<string | null>(null);
	const [selectedRangePitId, setSelectedRangePitId] = useState<string | null>(null);
	const [compareFromPitId, setCompareFromPitId] = useState<string | null>(null);
	const [compareToPitId, setCompareToPitId] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState<PitRangeState>(() => createDefaultTimeRange());
	const [selectedPitForModal, setSelectedPitForModal] = useState<PitHistoryItem | null>(null);
	const [isViewPitChangesModalOpen, setIsViewPitChangesModalOpen] = useState(false);
	const [hasPreviewedSnapshotDiff, setHasPreviewedSnapshotDiff] = useState(false);
	const [hasPreviewedTimeRangeDiff, setHasPreviewedTimeRangeDiff] = useState(false);
	const [selectedRollbackPit, setSelectedRollbackPit] = useState<PitHistoryItem | null>(null);
	const [isRollbackDialogOpen, setIsRollbackDialogOpen] = useState(false);
	const [rollbackConfirmPitId, setRollbackConfirmPitId] = useState("");
	const [rollbackMessage, setRollbackMessage] = useState("");

	const {
		project,
		environmentTypes,
		enableSecrets,
		isLoading: isProjectLoading,
		error: projectError,
		refetch: refetchProject,
	} = useProjectEnvironments(appId);

	const selectedEnvironment = useMemo(() => {
		if (!environmentTypes?.length) return null;
		if (!selectedEnvSlug) return environmentTypes[0];
		return (
			environmentTypes.find(
				(environment) =>
					environment.id === selectedEnvSlug ||
					environment.name.toLowerCase() === selectedEnvSlug.toLowerCase()
			) ?? environmentTypes[0]
		);
	}, [environmentTypes, selectedEnvSlug]);

	const { data: users = [] } = useQuery({
		queryKey: ["pit-users"],
		queryFn: async () => sdk.users.getUsers(),
		staleTime: 5 * 60 * 1000,
	});

	const usersMap = useMemo(
		() => new Map(users.map((user) => [user.id, user])),
		[users]
	);

	const snapshotHistoryQuery = usePointInTimeHistory(
		kind,
		{
			app_id: appId || "",
			env_type_id: selectedEnvironment?.id || "",
			page: snapshotPage,
			per_page: SNAPSHOT_PAGE_SIZE,
		},
		{
			enabled: Boolean(appId && selectedEnvironment?.id),
			staleTime: 30000,
		}
	);

	const rangeHistoryQuery = usePointInTimeHistory(
		kind,
		{
			app_id: appId || "",
			env_type_id: selectedEnvironment?.id || "",
			page: rangePage,
			per_page: RANGE_PAGE_SIZE,
			from_created_at: timeRange.start,
			to_created_at: timeRange.end,
		},
		{
			enabled: Boolean(appId && selectedEnvironment?.id && activeMode === "time-range"),
			staleTime: 30000,
		}
	);

	const snapshotDiff = usePointInTimeDiff(kind);
	const timeRangeDiff = usePointInTimeTimestampRangeDiff(kind);
	const { rollbackToPit } = usePointInTimeRollback(kind);

	const snapshotHistory = snapshotHistoryQuery.data?.pits ?? [];
	const rangeHistory = rangeHistoryQuery.data?.pits ?? [];

	const allKnownPits = useMemo(() => {
		const unique = new Map<string, PitHistoryItem>();
		for (const pit of [...snapshotHistory, ...rangeHistory]) {
			unique.set(pit.id, pit);
		}
		return unique;
	}, [rangeHistory, snapshotHistory]);

	const selectedSnapshotPit =
		(selectedSnapshotPitId ? allKnownPits.get(selectedSnapshotPitId) : null) ??
		snapshotHistory[0] ??
		null;
	const selectedRangePit =
		(selectedRangePitId ? allKnownPits.get(selectedRangePitId) : null) ?? null;
	const rangeSummary = getPitRangeSummary(rangeHistory);
	const timezoneLabel =
		Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";

	useEffect(() => {
		if (snapshotHistory.length === 0) {
			setSelectedSnapshotPitId(null);
			setCompareFromPitId(null);
			setCompareToPitId(null);
			return;
		}

		if (!selectedSnapshotPitId || !snapshotHistory.some((pit) => pit.id === selectedSnapshotPitId)) {
			setSelectedSnapshotPitId(snapshotHistory[0].id);
		}

		const preferredToId =
			compareToPitId && snapshotHistory.some((pit) => pit.id === compareToPitId)
				? compareToPitId
				: selectedSnapshotPitId && snapshotHistory.some((pit) => pit.id === selectedSnapshotPitId)
					? selectedSnapshotPitId
					: snapshotHistory[0].id;

		const defaults = getDefaultSnapshotCompareIds(snapshotHistory, preferredToId);

		if (compareToPitId !== defaults.toPitId) {
			setCompareToPitId(defaults.toPitId);
		}
		if (compareFromPitId !== defaults.fromPitId) {
			setCompareFromPitId(defaults.fromPitId);
		}
	}, [compareFromPitId, compareToPitId, selectedSnapshotPitId, snapshotHistory]);

	useEffect(() => {
		if (!selectedRangePitId) return;
		if (!rangeHistory.some((pit) => pit.id === selectedRangePitId)) {
			setSelectedRangePitId(null);
		}
	}, [rangeHistory, selectedRangePitId]);

	useEffect(() => {
		snapshotDiff.reset();
		setHasPreviewedSnapshotDiff(false);
	}, [activeMode, compareFromPitId, compareToPitId, kind, selectedEnvironment?.id]);

	useEffect(() => {
		timeRangeDiff.reset();
		setHasPreviewedTimeRangeDiff(false);
	}, [activeMode, kind, selectedEnvironment?.id, timeRange.end, timeRange.start]);

	function getUserLabel(userId: string) {
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

	function handleRetry() {
		refetchProject();
		snapshotHistoryQuery.refetch();
		if (activeMode === "time-range") {
			rangeHistoryQuery.refetch();
		}
	}

	function handleEnvironmentChange(environmentId: string) {
		const environment = environmentTypes?.find((item) => item.id === environmentId);
		setSearchParams((previous) => {
			const next = new URLSearchParams(previous);
			next.set("env", environment?.name?.toLowerCase() || environmentId);
			return next;
		});
		setSnapshotPage(1);
		setRangePage(1);
		setSelectedSnapshotPitId(null);
		setSelectedRangePitId(null);
	}

	function handlePreviewSnapshotDiff() {
		if (!appId || !selectedEnvironment?.id || !compareFromPitId || !compareToPitId) return;

		if (compareFromPitId === compareToPitId) {
			toast.error("Choose two different snapshots to compare.");
			return;
		}

		setHasPreviewedSnapshotDiff(true);
		snapshotDiff.mutate({
			app_id: appId,
			env_type_id: selectedEnvironment.id,
			from_pit_id: compareFromPitId,
			to_pit_id: compareToPitId,
		});
	}

	function handlePreviewTimeRangeDiff() {
		if (!appId || !selectedEnvironment?.id || !timeRange.start || !timeRange.end) return;

		if (new Date(timeRange.start) > new Date(timeRange.end)) {
			toast.error("Range start must be before range end.");
			return;
		}

		setHasPreviewedTimeRangeDiff(true);
		timeRangeDiff.mutate({
			app_id: appId,
			env_type_id: selectedEnvironment.id,
			from_timestamp: timeRange.start,
			to_timestamp: timeRange.end,
		});
	}

	function resetRollbackState() {
		setSelectedRollbackPit(null);
		setRollbackConfirmPitId("");
		setRollbackMessage("");
	}

	function handleRollbackRequest(pit: PitHistoryItem) {
		setSelectedRollbackPit(pit);
		setRollbackConfirmPitId("");
		setRollbackMessage(`Rollback ${itemLabel}s to snapshot ${pit.id}`);
		setIsRollbackDialogOpen(true);
	}

	function handleRollbackDialogChange(open: boolean) {
		setIsRollbackDialogOpen(open);
		if (!open) {
			resetRollbackState();
		}
	}

	function handleConfirmRollback() {
		if (!appId || !selectedEnvironment?.id || !selectedRollbackPit) return;

		rollbackToPit.mutate(
			{
				app_id: appId,
				env_type_id: selectedEnvironment.id,
				pit_id: selectedRollbackPit.id,
				rollback_message: rollbackMessage.trim(),
			},
			{
				onSuccess: () => {
					handleRollbackDialogChange(false);
				},
			}
		);
	}

	function handleUsePitForCompare(pitId: string) {
		startTransition(() => {
			setSelectedSnapshotPitId(pitId);
			const defaults = getDefaultSnapshotCompareIds(snapshotHistory, pitId);
			setCompareToPitId(defaults.toPitId);
			setCompareFromPitId(defaults.fromPitId);
			setActiveMode("snapshots");
		});
	}

	function handleViewChanges(pitId: string) {
		const pit = allKnownPits.get(pitId);
		if (!pit) return;
		setSelectedPitForModal(pit);
		setIsViewPitChangesModalOpen(true);
	}

	function handleCustomRangeChange(nextRange: Pick<PitRangeState, "start" | "end">) {
		setTimeRange({
			preset: "custom",
			start: nextRange.start,
			end: nextRange.end,
		});
		setRangePage(1);
		setSelectedRangePitId(null);
	}

	if (
		isProjectLoading ||
		snapshotHistoryQuery.isLoading ||
		(activeMode === "time-range" && rangeHistoryQuery.isLoading && !rangeHistoryQuery.data)
	) {
		return <PointInTimeLoadingPage />;
	}

	if (projectError || snapshotHistoryQuery.error || (activeMode === "time-range" && rangeHistoryQuery.error)) {
		return (
			<PointInTimeErrorPage
				error={projectError || snapshotHistoryQuery.error || rangeHistoryQuery.error}
				onRetry={handleRetry}
				onBack={() => navigate(-1)}
			/>
		);
	}

	if (!selectedEnvironment) {
		return (
			<PointInTimeErrorPage
				error={new Error("No environment found")}
				onRetry={handleRetry}
				onBack={() => navigate(-1)}
			/>
		);
	}

	return (
		<div className="min-h-full bg-card p-6">
			<div className="mx-auto flex max-w-7xl flex-col gap-6">
				<PointInTimeHeader
					projectName={project?.name || appId || ""}
					environmentTypes={environmentTypes || []}
					selectedEnvironmentId={selectedEnvironment.id}
					isRefetching={snapshotHistoryQuery.isRefetching || rangeHistoryQuery.isRefetching}
					enableSecrets={enableSecrets}
					onRefresh={() => {
						snapshotHistoryQuery.refetch();
						if (activeMode === "time-range") {
							rangeHistoryQuery.refetch();
						}
					}}
					onEnvironmentChange={handleEnvironmentChange}
				/>

				<div className="space-y-4">
					<PitModeSwitch value={activeMode} onValueChange={setActiveMode} />

					{activeMode === "snapshots" ? (
						<PitSnapshotComparePanel
							kind={kind}
							history={snapshotHistory}
							compareFromPitId={compareFromPitId}
							compareToPitId={compareToPitId}
							onCompareFromChange={setCompareFromPitId}
							onCompareToChange={setCompareToPitId}
							onPreview={handlePreviewSnapshotDiff}
							isPreviewPending={snapshotDiff.isPending}
							getUserLabel={getUserLabel}
							formatDateTime={formatDateTime}
						/>
					) : (
						<PitTimeRangePanel
							kind={kind}
							range={timeRange}
							timezoneLabel={timezoneLabel}
							isPreviewPending={timeRangeDiff.isPending}
							onPresetChange={(preset: PitRangePreset) => {
								setTimeRange(createPresetRange(preset));
								setRangePage(1);
								setSelectedRangePitId(null);
							}}
							onCustomRangeChange={handleCustomRangeChange}
							onPreview={handlePreviewTimeRangeDiff}
						/>
					)}
				</div>

				<Card className="border-border bg-card">
					<CardHeader>
						<CardTitle className="text-base text-foreground">Selected context</CardTitle>
					</CardHeader>
					<CardContent>
						{activeMode === "snapshots" ? selectedSnapshotPit ? (
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<GitBranch className="size-3.5" />
										PIT ID
									</p>
									<p className="font-mono text-sm text-foreground">{selectedSnapshotPit.id}</p>
								</div>
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<Clock3 className="size-3.5" />
										Created at
									</p>
									<p className="text-sm text-foreground">{formatDateTime(selectedSnapshotPit.created_at)}</p>
								</div>
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<User className="size-3.5" />
										Created by
									</p>
									<p className="text-sm text-foreground">{getUserLabel(selectedSnapshotPit.user_id)}</p>
								</div>
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<MessageSquare className="size-3.5" />
										Message
									</p>
									<p className="text-sm text-foreground">{selectedSnapshotPit.change_request_message}</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-tertiary">{kindLabel} changes</p>
									<p className="text-sm text-foreground">{selectedSnapshotPit.changes_count}</p>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								No snapshots are available yet for this environment&apos;s {itemLabel}s.
							</p>
						) : (
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<CalendarRange className="size-3.5" />
										Range start
									</p>
									<p className="text-sm text-foreground">{formatDateTime(timeRange.start)}</p>
								</div>
								<div className="space-y-1">
									<p className="flex items-center gap-2 text-xs uppercase tracking-wide text-tertiary">
										<CalendarRange className="size-3.5" />
										Range end
									</p>
									<p className="text-sm text-foreground">{formatDateTime(timeRange.end)}</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-tertiary">Total PiTs found</p>
									<p className="text-sm text-foreground">{rangeSummary.total}</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-tertiary">Earliest PiT</p>
									<p className="text-sm text-foreground">
										{rangeSummary.earliest ? formatDateTime(rangeSummary.earliest.created_at) : "None"}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-xs uppercase tracking-wide text-tertiary">Latest PiT</p>
									<p className="text-sm text-foreground">
										{rangeSummary.latest ? formatDateTime(rangeSummary.latest.created_at) : "None"}
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{activeMode === "time-range" && rangeHistory.length === 1 && !selectedRangePitId && (
					<Badge className="w-fit border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
						One snapshot found in range. Select it to enable rollback.
					</Badge>
				)}

				<PitHistoryTable
					kind={kind}
					mode={activeMode}
					title={activeMode === "snapshots" ? `${kindLabel} snapshot history` : "Snapshots in selected range"}
					description={
						activeMode === "snapshots"
							? `Browse the full PiT history for ${selectedEnvironment.name} ${itemLabel}s.`
							: "Use the selected time window to narrow rollback candidates and jump back into snapshot compare."
					}
					history={activeMode === "snapshots" ? snapshotHistory : rangeHistory}
					selectedPitId={activeMode === "snapshots" ? selectedSnapshotPitId : selectedRangePitId}
					totalPages={
						activeMode === "snapshots"
							? snapshotHistoryQuery.data?.totalPages || 1
							: rangeHistoryQuery.data?.totalPages || 1
					}
					currentPage={activeMode === "snapshots" ? snapshotPage : rangePage}
					isRefetching={
						activeMode === "snapshots"
							? snapshotHistoryQuery.isRefetching
							: rangeHistoryQuery.isRefetching
					}
					isRollbackPending={rollbackToPit.isPending}
					onPageChange={(page) => {
						if (activeMode === "snapshots") {
							setSnapshotPage(page);
						} else {
							setRangePage(page);
						}
					}}
					onSelectRow={(pitId) => {
						if (activeMode === "snapshots") {
							setSelectedSnapshotPitId(pitId);
						} else {
							setSelectedRangePitId(pitId);
						}
					}}
					onUseForCompare={handleUsePitForCompare}
					onViewChanges={handleViewChanges}
					onRollback={(pitId) => {
						const pit = allKnownPits.get(pitId);
						if (pit) {
							handleRollbackRequest(pit);
						}
					}}
					getUserLabel={getUserLabel}
					formatDateTime={formatDateTime}
				/>

				<PitDiffResults
					kind={kind}
					title={activeMode === "snapshots" ? `${kindLabel} snapshot diff` : `${kindLabel} time-range net diff`}
					description={
						activeMode === "snapshots"
							? "Preview the difference between two concrete PiT snapshots."
							: "Preview the net diff between the selected range start and range end."
					}
					diff={activeMode === "snapshots" ? snapshotDiff.data ?? null : timeRangeDiff.data ?? null}
					isPending={activeMode === "snapshots" ? snapshotDiff.isPending : timeRangeDiff.isPending}
					error={
						activeMode === "snapshots"
							? (snapshotDiff.error as Error | null)
							: (timeRangeDiff.error as Error | null)
					}
					hasPreviewed={activeMode === "snapshots" ? hasPreviewedSnapshotDiff : hasPreviewedTimeRangeDiff}
				/>

				<ViewPitChangesModal
					kind={kind}
					isOpen={isViewPitChangesModalOpen}
					onOpenChange={setIsViewPitChangesModalOpen}
					pitData={selectedPitForModal}
					projectId={appId || ""}
					environmentId={selectedEnvironment.id}
				/>

				<PitRollbackDialog
					kind={kind}
					pit={selectedRollbackPit}
					isOpen={isRollbackDialogOpen}
					typedPitId={rollbackConfirmPitId}
					rollbackMessage={rollbackMessage}
					isSubmitting={rollbackToPit.isPending}
					onOpenChange={handleRollbackDialogChange}
					onTypedPitIdChange={setRollbackConfirmPitId}
					onRollbackMessageChange={setRollbackMessage}
					onConfirm={handleConfirmRollback}
				/>
			</div>
		</div>
	);
};

export default PointInTime;
