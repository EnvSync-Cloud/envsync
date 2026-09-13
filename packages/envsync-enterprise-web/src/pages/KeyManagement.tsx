import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LockKeyhole, Plus, RefreshCw, ShieldCheck } from "lucide-react";

import {
  useAttachOrgKms,
  useDetachOrgKms,
  useManagementSystemStatus,
  useOrgKmsApps,
  useOrgKmsConfig,
  useOrgKmsJob,
  useRotateOrgKmsKek,
  useUpdateOrgKmsConfig,
  useVerifyOrgKms,
} from "../api/hooks";
import { isEnterpriseUiEnabled } from "../api/client";
import { CreateKmsCredentialModal } from "../components/CreateKmsCredentialModal";
import {
  configBlocksMutations,
  isCloudKmsSource,
  isHostedCmkUi,
  jobInFlight,
  jobProgressPercent,
  keyRefPlaceholder,
  kmsSourceLabel,
  KMS_SOURCE_OPTIONS,
  safeJobProgressEntries,
  type KmsSource,
} from "../lib/kms-ui";
import { runtimeConfig } from "@shell/utils/runtime-config";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Progress } from "@shell/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shell/components/ui/alert-dialog";

type ConfirmAction = "attach" | "detach" | "rotate" | null;

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-500/40 text-emerald-700 dark:text-emerald-300";
    case "pending":
      return "border-amber-500/40 text-amber-700 dark:text-amber-300";
    case "rotating":
      return "border-sky-500/40 text-sky-700 dark:text-sky-300";
    case "unavailable":
      return "border-red-500/40 text-red-300";
    default:
      return "";
  }
}

export default function KeyManagement() {
  const enabled = isEnterpriseUiEnabled();
  const { data: systemStatus } = useManagementSystemStatus();
  const { data: config, isLoading, isError, error, refetch, isFetching } = useOrgKmsConfig();
  const {
    data: appsPayload,
    isLoading: appsLoading,
    isError: appsError,
    refetch: refetchApps,
  } = useOrgKmsApps();
  const updateConfig = useUpdateOrgKmsConfig();
  const verify = useVerifyOrgKms();
  const rotateKek = useRotateOrgKmsKek();
  const attach = useAttachOrgKms();
  const detach = useDetachOrgKms();
  const queryClient = useQueryClient();

  const hosted = isHostedCmkUi({
    deploymentMode: systemStatus?.system?.deployment_mode,
    runtimeDeploymentMode: runtimeConfig.deploymentMode,
  });

  const [source, setSource] = useState<KmsSource>("managed");
  const [keyRef, setKeyRef] = useState("");
  const [region, setRegion] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);

  useEffect(() => {
    if (!config) return;
    setSource(config.source);
    setKeyRef(config.key_ref ?? "");
    setRegion(config.region ?? "");
    setCredentialId(config.credential_secret_id ?? "");
  }, [config]);

  const { data: job } = useOrgKmsJob(jobId);

  useEffect(() => {
    if (job?.status !== "succeeded" && job?.status !== "failed") return;
    void queryClient.invalidateQueries({ queryKey: ["enterprise", "kms"] });
  }, [job?.status, queryClient]);
  const busy = updateConfig.isPending || verify.isPending || rotateKek.isPending
    || attach.isPending || detach.isPending;
  const mutatingLocked = configBlocksMutations(config) || jobInFlight(job);
  const cloudSelected = isCloudKmsSource(source);
  const cloudAttached = isCloudKmsSource(config?.source) && config?.source !== "managed";
  const credentials = config?.credentials ?? [];

  const confirmCopy = useMemo(() => {
    switch (confirm) {
      case "attach":
        return {
          title: "Attach customer-managed key?",
          body: "This starts a background rewrap of project data keys under your organization key. Ciphertexts stay in place. Raw key material is never shown.",
          action: "Attach",
        };
      case "detach":
        return {
          title: "Detach to managed wrapping?",
          body: "This rewraps project data keys under the install-managed key. Existing encryption continues. Contact support only if detach cannot complete.",
          action: "Detach",
        };
      case "rotate":
        return {
          title: "Rotate organization KEK?",
          body: "This re-wraps the organization key under the current cloud key reference. It does not rotate project data keys or display key material.",
          action: "Rotate KEK",
        };
      default:
        return null;
    }
  }, [confirm]);

  const onSave = async () => {
    try {
      const next = await updateConfig.mutateAsync(
        cloudSelected
          ? {
              source,
              key_ref: keyRef.trim() || null,
              region: region.trim() || null,
              credential_secret_id: credentialId || null,
            }
          : { source: "managed" },
      );
      toast.success(
        next.source === "managed"
          ? "Organization wrapping set to managed."
          : "Cloud key configuration saved. Verify, then attach to finish.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update key configuration");
    }
  };

  const onVerify = async () => {
    try {
      const result = await verify.mutateAsync();
      toast.success(result.ok ? "Wrapping key verified." : "Verify completed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify failed");
    }
  };

  const runConfirmed = async () => {
    const action = confirm;
    setConfirm(null);
    try {
      if (action === "attach") {
        const next = await attach.mutateAsync();
        setJobId(next.id);
        toast.success("Attach rewrap queued.");
      } else if (action === "detach") {
        const next = await detach.mutateAsync();
        setJobId(next.id);
        toast.success("Detach to managed queued.");
      } else if (action === "rotate") {
        await rotateKek.mutateAsync();
        toast.success("Organization KEK rotated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Key management action failed");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Key management</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
          Enterprise
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
              <LockKeyhole className="size-7" />
              Key management
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Choose who wraps this organization&apos;s tenant key. Project BYOK stays in
              {" "}
              <Link className="text-emerald-600 underline-offset-2 hover:underline" to="/applications">
                project settings
              </Link>
              {" "}
              (per-app RSA). This page is the organization wrapping key — never a place to view
              PEM, KEK, DEK, or credential values.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refetch();
              void refetchApps();
            }}
            disabled={isFetching}
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load key configuration"}
        </div>
      )}

      {isLoading || !config ? (
        <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
          Loading organization key status…
        </div>
      ) : (
        <>
          <article className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Status</h2>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="font-mono">
                  {kmsSourceLabel(config.source)}
                </Badge>
                <Badge variant="outline" className={statusBadgeClass(config.status)}>
                  {config.status}
                </Badge>
              </div>
            </div>
            <dl className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">KEK version</dt>
                <dd className="font-medium">{config.kek_version}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Last verified</dt>
                <dd className="font-medium">
                  {config.last_verified_at
                    ? new Date(config.last_verified_at).toLocaleString()
                    : "never"}
                </dd>
              </div>
              {config.key_ref && (
                <div className="flex justify-between gap-4 md:col-span-2">
                  <dt className="text-muted-foreground">Key reference</dt>
                  <dd className="font-mono text-xs break-all text-right">{config.key_ref}</dd>
                </div>
              )}
              {config.region && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Region</dt>
                  <dd className="font-medium">{config.region}</dd>
                </div>
              )}
              {config.implicit && (
                <div className="md:col-span-2 text-muted-foreground">
                  Implicit default — no organization key row yet. Wrapping is managed by this install.
                </div>
              )}
            </dl>
            {config.last_error && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {config.last_error}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="outline" onClick={() => void onVerify()} disabled={busy || mutatingLocked}>
                <ShieldCheck className="size-4" />
                Verify
              </Button>
            </div>
          </article>

          {!hosted ? (
            <article className="rounded-xl border border-border bg-card/50 p-6 space-y-2">
              <h2 className="text-lg font-medium">Managed by this install (miniKMS)</h2>
              <p className="text-sm text-muted-foreground">
                Self-host v1 uses the install-managed wrapping key only. Cloud customer-managed
                keys (AWS KMS, GCP Cloud KMS, Azure Key Vault) are available on Hosted.
              </p>
            </article>
          ) : (
            <article className="rounded-xl border border-border bg-card/50 p-6 space-y-5">
              <div>
                <h2 className="text-lg font-medium">Wrapping source</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Hosted organizations can attach a customer-managed key. Credentials are created
                  here — not under Integrations.
                </p>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Provider</span>
                <select
                  className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={source}
                  disabled={mutatingLocked}
                  onChange={event => setSource(event.target.value as KmsSource)}
                >
                  {KMS_SOURCE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {cloudSelected && (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1 text-sm md:col-span-2">
                    <span className="text-muted-foreground">Key reference</span>
                    <Input
                      value={keyRef}
                      onChange={event => setKeyRef(event.target.value)}
                      placeholder={keyRefPlaceholder(source)}
                      disabled={mutatingLocked}
                      autoComplete="off"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Region</span>
                    <Input
                      value={region}
                      onChange={event => setRegion(event.target.value)}
                      placeholder="us-east-1"
                      disabled={mutatingLocked}
                      autoComplete="off"
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="text-muted-foreground">Credential</span>
                    <div className="flex gap-2">
                      <select
                        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={credentialId}
                        disabled={mutatingLocked}
                        onChange={event => setCredentialId(event.target.value)}
                      >
                        <option value="">Select a configured credential</option>
                        {credentials.map(credential => (
                          <option key={credential.id} value={credential.id}>
                            {credential.key}
                            {credential.configured ? " · configured" : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateOpen(true)}
                        disabled={mutatingLocked}
                      >
                        <Plus className="size-4" />
                        Add
                      </Button>
                    </div>
                  </label>
                </div>
              )}

              {credentials.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Configured credentials</h3>
                  <ul className="space-y-2">
                    {credentials.map(credential => (
                      <li
                        key={credential.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{credential.key}</p>
                          {credential.description && (
                            <p className="text-xs text-muted-foreground">{credential.description}</p>
                          )}
                        </div>
                        <Badge variant="outline">configured</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void onSave()} disabled={busy || mutatingLocked}>
                  Save configuration
                </Button>
                {cloudAttached && config.status === "pending" && (
                  <Button
                    variant="outline"
                    disabled={busy || mutatingLocked}
                    onClick={() => setConfirm("attach")}
                  >
                    Attach
                  </Button>
                )}
                {cloudAttached && config.status === "active" && (
                  <Button
                    variant="outline"
                    disabled={busy || mutatingLocked}
                    onClick={() => setConfirm("rotate")}
                  >
                    Rotate KEK
                  </Button>
                )}
                {cloudAttached && config.status !== "rotating" && (
                  <Button
                    variant="outline"
                    disabled={busy || mutatingLocked}
                    onClick={() => setConfirm("detach")}
                  >
                    Detach to managed
                  </Button>
                )}
              </div>
            </article>
          )}

          {(job || config.status === "rotating") && (
            <article className="rounded-xl border border-border bg-card/50 p-6 space-y-3">
              <h2 className="text-lg font-medium">Attach / detach progress</h2>
              <p className="text-sm text-muted-foreground">
                {job
                  ? `${job.kind.replaceAll("_", " ")} is ${job.status}.`
                  : "A data-key rewrap is in progress."}
              </p>
              <Progress value={job ? jobProgressPercent(job) : 40} />
              {job?.error_message && (
                <p className="text-xs text-red-300">{job.error_message}</p>
              )}
              {safeJobProgressEntries(job?.progress).length > 0 && (
                <dl className="grid gap-1 text-xs text-muted-foreground">
                  {safeJobProgressEntries(job?.progress).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4">
                      <dt>{key}</dt>
                      <dd className="font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          )}

          <article className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
            <h2 className="text-lg font-medium">Project data-key metadata</h2>
            <p className="text-sm text-muted-foreground">
              Per-project wrapping metadata from the platform key service. Versions and counts
              only — no key material.
            </p>
            {appsLoading ? (
              <p className="text-sm text-muted-foreground">Loading project key info…</p>
            ) : appsError ? (
              <p className="text-sm text-muted-foreground">
                Project key metadata is unavailable right now. Encryption status is still shown above.
              </p>
            ) : !appsPayload?.apps?.length ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Version</th>
                      <th className="py-2 font-medium">Encryptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appsPayload.apps.map(app => (
                      <tr key={app.app_id} className="border-b border-border/60">
                        <td className="py-2 pr-4">
                          <Link
                            className="underline-offset-2 hover:underline"
                            to={`/applications/${app.app_id}`}
                          >
                            {app.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline">{app.status}</Badge>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{app.version ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">
                          {app.encryption_count ?? "—"}
                          {app.max_encryptions != null ? ` / ${app.max_encryptions}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </>
      )}

      <CreateKmsCredentialModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={id => setCredentialId(id)}
      />

      <AlertDialog open={confirm !== null} onOpenChange={open => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void runConfirmed()}>
              {confirmCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
