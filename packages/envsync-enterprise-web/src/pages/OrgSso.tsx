import { useMemo, useState } from "react";
import type { SamlProviderResponse } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Copy, Download, Fingerprint, Plus, RefreshCw, Trash2 } from "lucide-react";

import {
  useDeleteSamlProvider,
  useDownloadSpMetadata,
  useSamlProviders,
  useSpMetadata,
  useStartSamlTestLogin,
  useUpdateSamlProvider,
} from "../api/hooks";
import { isEnterpriseUiEnabled } from "../api/client";
import { SamlProviderSheet } from "../components/SamlProviderSheet";
import {
  isSafeHttpRedirectUrl,
  parseSpMetadataXml,
  publishedSpUrls,
  samlProviderLabel,
  startUrlFromEntityId,
} from "../lib/saml-sp";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Switch } from "@shell/components/ui/switch";
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
import { useAuthContext } from "@shell/contexts/auth";
import { formatLastUsed } from "@shell/lib/utils";
import { trackAction } from "@shell/telemetry";
import { runtimeConfig } from "@shell/utils/runtime-config";

function copyText(value: string, label: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Could not copy ${label}`),
  );
}

function PublishedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background/60 px-2 py-1 text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          onClick={() => copyText(value, label)}
        >
          <Copy className="size-4" />
          <span className="sr-only">Copy {label}</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * Organisation SAML SSO admin (human login IdPs). Not Workload OIDC.
 * Route: /organisation/sso
 */
export default function OrgSso() {
  const enabled = isEnterpriseUiEnabled();
  const { user } = useAuthContext();
  const orgId = user?.org?.id ?? "";
  const orgSlug = user?.org?.slug ?? "";
  const { data: providers = [], isLoading, isError, error, refetch, isFetching } = useSamlProviders();
  const { data: metadataXml } = useSpMetadata(orgId || undefined);
  const updateProvider = useUpdateSamlProvider();
  const deleteProvider = useDeleteSamlProvider();
  const downloadMetadata = useDownloadSpMetadata();
  const startTestLogin = useStartSamlTestLogin();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<SamlProviderResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SamlProviderResponse | null>(null);
  const [testTarget, setTestTarget] = useState<SamlProviderResponse | null>(null);

  const sp = useMemo(() => {
    if (!orgId || !orgSlug) return null;
    const fallback = publishedSpUrls(runtimeConfig.apiBaseUrl, orgId, orgSlug);
    const parsed = typeof metadataXml === "string" ? parseSpMetadataXml(metadataXml) : null;
    const entityId = parsed?.entityId || fallback.entityId;
    return {
      entityId,
      acsUrl: parsed?.acsUrl || fallback.acsUrl,
      startUrl: startUrlFromEntityId(entityId, orgSlug) ?? fallback.startUrl,
      metadataUrl: entityId,
    };
  }, [metadataXml, orgId, orgSlug]);

  const summary = useMemo(() => {
    const enabledCount = providers.filter((provider) => provider.enabled).length;
    const defaultProvider = providers.find((provider) => provider.is_default) ?? null;
    const loginDefault = defaultProvider?.enabled ? defaultProvider : null;
    const lastSso = providers
      .map((provider) => provider.last_sso_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    return { enabledCount, defaultProvider, loginDefault, lastSso };
  }, [providers]);

  const busyId = updateProvider.isPending || deleteProvider.isPending || startTestLogin.isPending;

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (provider: SamlProviderResponse) => {
    setEditing(provider);
    setSheetOpen(true);
  };

  const onToggleEnabled = async (provider: SamlProviderResponse, next: boolean) => {
    const otherEnabled = providers.filter((item) => item.id !== provider.id && item.enabled).length;
    if (next && otherEnabled >= 1 && !summary.loginDefault && !provider.is_default) {
      toast.error("Set a default IdP before enabling more than one. /login cannot pick among multiple enabled providers.");
      return;
    }
    try {
      await updateProvider.mutateAsync({ id: provider.id, enabled: next });
      toast.success(next ? "Identity provider enabled." : "Identity provider disabled.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update provider.");
    }
  };

  const onSetDefault = async (provider: SamlProviderResponse) => {
    try {
      await updateProvider.mutateAsync({ id: provider.id, is_default: true });
      toast.success(`${provider.name} is now the default IdP.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default.");
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProvider.mutateAsync(deleteTarget.id);
      toast.success("Identity provider deleted.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete provider.");
    }
  };

  const onDownloadMetadata = async () => {
    if (!orgId) return;
    try {
      const xml = typeof metadataXml === "string" && metadataXml.trim()
        ? metadataXml
        : await downloadMetadata.mutateAsync(orgId);
      if (typeof xml !== "string" || xml.trim().length === 0) {
        toast.error("SP metadata was empty.");
        return;
      }
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `envsync-sp-metadata-${orgSlug || orgId}.xml`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("SP metadata downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download SP metadata.");
    }
  };

  const onConfirmTestLogin = async () => {
    if (!testTarget || !orgSlug) return;
    // Open on the click, before await — after await, popup blockers fire and
    // windowFeatures=noopener makes open() return null even when it succeeded.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      trackAction("sso_test_login_started", { provider_id: testTarget.id });
      const result = await startTestLogin.mutateAsync({
        orgSlug,
        providerId: testTarget.id,
      });
      if (!result.redirect_url || !isSafeHttpRedirectUrl(result.redirect_url)) {
        popup?.close();
        toast.error("SSO start did not return a valid redirect URL.");
        return;
      }
      if (popup) {
        popup.location.assign(result.redirect_url);
      } else {
        window.location.assign(result.redirect_url);
      }
      setTestTarget(null);
    } catch (err) {
      popup?.close();
      toast.error(err instanceof Error ? err.message : "Could not start SSO test login.");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">SSO</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
            Enterprise
          </p>
          <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
            <Fingerprint className="size-7" />
            SSO
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Configure SAML identity providers for human login. This is not Workload OIDC.
            Users start SSO from /login with this organization slug.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add IdP
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load identity providers"}
        </div>
      )}

      {summary.enabledCount > 1 && !summary.loginDefault && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
        >
          Several IdPs are enabled and none is default. /login POSTs without a provider id and
          cannot start SSO until you set a default.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Identity providers</p>
          <p className="text-2xl font-semibold">{isLoading ? "…" : providers.length}</p>
          <p className="text-xs text-muted-foreground">{summary.enabledCount} enabled</p>
        </article>
        <article className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Default IdP</p>
          <p className="truncate text-lg font-semibold">{summary.defaultProvider?.name ?? "None"}</p>
          <p className="text-xs text-muted-foreground">
            Required when more than one IdP is enabled. /login does not send a provider id.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Last SSO</p>
          <p className="text-lg font-semibold">
            {summary.lastSso ? formatLastUsed(summary.lastSso) : "Never"}
          </p>
        </article>
      </div>

      {sp && (
        <article className="space-y-4 rounded-xl border border-border bg-card/50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Service provider</h2>
              <p className="text-sm text-muted-foreground">
                Publish these values in your IdP. Entity ID and metadata URL are the same path.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onDownloadMetadata()}
              disabled={downloadMetadata.isPending || !orgId}
            >
              <Download className="size-4" />
              Download SP metadata
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <PublishedRow label="SP entity ID" value={sp.entityId} />
            <PublishedRow label="ACS URL" value={sp.acsUrl} />
            <PublishedRow label="SSO start URL" value={sp.startUrl} />
            <PublishedRow label="SP metadata URL" value={sp.metadataUrl} />
          </div>
        </article>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Identity providers</h2>
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
            Loading identity providers…
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No SAML identity providers yet. Add one with metadata XML or manual fields.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="size-4" />
              Add IdP
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => (
              <article
                key={provider.id}
                className="space-y-4 rounded-xl border border-border bg-card/50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium">{provider.name}</h3>
                      <Badge variant="outline">{samlProviderLabel(provider.provider_type)}</Badge>
                      {provider.is_default && <Badge>Default</Badge>}
                      <Badge variant={provider.enabled ? "outline" : "secondary"}>
                        {provider.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last login {provider.last_sso_at ? formatLastUsed(provider.last_sso_at) : "never"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enabled</span>
                    <Switch
                      checked={provider.enabled}
                      disabled={Boolean(busyId)}
                      onCheckedChange={(next) => void onToggleEnabled(provider, next)}
                    />
                  </div>
                </div>

                <dl className="grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">IdP entity ID</dt>
                    <dd className="break-all font-mono text-xs">{provider.entity_id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">IdP SSO URL</dt>
                    <dd className="break-all font-mono text-xs">{provider.sso_url}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Certificate fingerprint</dt>
                    <dd className="break-all font-mono text-xs">
                      {provider.certificate_fingerprint ?? "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Certificate expires</dt>
                    <dd className="text-xs">
                      {provider.certificate_not_after
                        ? new Date(provider.certificate_not_after).toLocaleString()
                        : "Unknown"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!provider.enabled || !orgSlug || startTestLogin.isPending}
                    onClick={() => setTestTarget(provider)}
                  >
                    Test login
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={provider.is_default || Boolean(busyId)}
                    onClick={() => void onSetDefault(provider)}
                  >
                    Set default
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openEdit(provider)}>
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeleteTarget(provider)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <SamlProviderSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditing(null);
        }}
        provider={editing}
        defaultNewAsDefault={
          providers.length === 0 || (summary.enabledCount > 0 && !summary.loginDefault)
        }
        existingEnabledCount={summary.enabledCount}
        hasDefault={Boolean(summary.loginDefault)}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete identity provider?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This removes ${deleteTarget.name}. Users will no longer be able to start SSO with this IdP.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(testTarget)} onOpenChange={(open) => !open && setTestTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Test SSO login?</AlertDialogTitle>
            <AlertDialogDescription>
              This starts a public SAML login for {testTarget?.name ?? "this IdP"} and will replace
              your current session if you complete sign-in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirmTestLogin()}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
