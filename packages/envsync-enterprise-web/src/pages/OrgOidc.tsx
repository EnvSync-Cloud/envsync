import { useMemo, useState } from "react";
import type { OidcProviderResponse } from "@envsync-cloud/envsync-ts-sdk";
import { CreateOidcProviderRequest } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Fingerprint, Plus, RefreshCw, Trash2 } from "lucide-react";

import { isEnterpriseUiEnabled } from "../api/client";
import {
  useCreateOidcProvider,
  useDeleteOidcProvider,
  useOidcProviders,
  useUpdateOidcProvider,
} from "../api/ee-workloads";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

const PROVIDER_TYPES = [
  { value: CreateOidcProviderRequest.provider_type.GITHUB_ACTIONS, label: "GitHub Actions", issuer: "https://token.actions.githubusercontent.com" },
  { value: CreateOidcProviderRequest.provider_type.GITLAB_CI, label: "GitLab CI", issuer: "https://gitlab.com" },
  { value: CreateOidcProviderRequest.provider_type.KUBERNETES, label: "Kubernetes", issuer: "" },
  { value: CreateOidcProviderRequest.provider_type.GENERIC, label: "Generic", issuer: "" },
] as const;

type OidcProviderType = CreateOidcProviderRequest.provider_type;

function providerLabel(type: string) {
  return PROVIDER_TYPES.find((item) => item.value === type)?.label ?? type;
}

/**
 * Workload OIDC providers for CI/CD machine login. Not human SAML SSO.
 * Route: /organisation/oidc
 */
export default function OrgOidc() {
  const enabled = isEnterpriseUiEnabled();
  const { data: providers = [], isLoading, isError, error, refetch, isFetching } = useOidcProviders();
  const createProvider = useCreateOidcProvider();
  const updateProvider = useUpdateOidcProvider();
  const deleteProvider = useDeleteOidcProvider();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OidcProviderResponse | null>(null);
  const [providerType, setProviderType] = useState<OidcProviderType>(
    CreateOidcProviderRequest.provider_type.GITHUB_ACTIONS,
  );
  const [issuerUrl, setIssuerUrl] = useState<string>(PROVIDER_TYPES[0].issuer);
  const [audience, setAudience] = useState("");
  const [subjects, setSubjects] = useState("");

  const enabledCount = useMemo(
    () => providers.filter((provider) => provider.enabled).length,
    [providers],
  );

  const onTypeChange = (next: OidcProviderType) => {
    setProviderType(next);
    const preset = PROVIDER_TYPES.find((item) => item.value === next);
    if (preset?.issuer) setIssuerUrl(preset.issuer);
  };

  const onCreate = async () => {
    if (!issuerUrl.trim() || !audience.trim()) {
      toast.error("Issuer URL and audience are required.");
      return;
    }
    try {
      await createProvider.mutateAsync({
        provider_type: providerType,
        issuer_url: issuerUrl.trim(),
        audience: audience.trim(),
        allowed_subjects: subjects
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      toast.success("Workload OIDC provider created.");
      setSheetOpen(false);
      setAudience("");
      setSubjects("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create provider.");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Workload OIDC</h1>
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
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-foreground">
            <Fingerprint className="size-7" />
            Workload OIDC
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Trust CI and cluster identities (GitHub Actions, GitLab, Kubernetes) without long-lived
            service tokens. Human SAML login stays on SSO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setSheetOpen(true)} data-testid="create-oidc-provider">
            <Plus className="size-4" />
            Add provider
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load OIDC providers"}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-card/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">Providers</p>
          <p className="text-2xl font-semibold">{isLoading ? "…" : providers.length}</p>
          <p className="text-xs text-muted-foreground">{enabledCount} enabled</p>
        </article>
      </div>

      <div className="space-y-3">
        {providers.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No workload OIDC providers yet.</p>
        ) : (
          providers.map((provider) => (
            <article
              key={provider.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 md:flex-row md:items-center md:justify-between"
              data-testid={`oidc-provider-${provider.id}`}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{providerLabel(provider.provider_type)}</h2>
                  <Badge variant="outline">{provider.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{provider.issuer_url}</p>
                <p className="truncate text-xs text-muted-foreground">Audience {provider.audience}</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(next) =>
                    updateProvider.mutate(
                      { id: provider.id, enabled: next },
                      {
                        onSuccess: () => toast.success(next ? "Provider enabled." : "Provider disabled."),
                        onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
                      },
                    )
                  }
                />
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(provider)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add workload OIDC provider</SheetTitle>
            <SheetDescription>
              Machines present a JWT from this issuer. Empty subject list allows every subject.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oidc-type">Platform</Label>
              <select
                id="oidc-type"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={providerType}
                onChange={(event) => onTypeChange(event.target.value as OidcProviderType)}
              >
                {PROVIDER_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-issuer">Issuer URL</Label>
              <Input id="oidc-issuer" value={issuerUrl} onChange={(event) => setIssuerUrl(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-audience">Audience</Label>
              <Input id="oidc-audience" value={audience} onChange={(event) => setAudience(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oidc-subjects">Allowed subjects (one glob per line)</Label>
              <textarea
                id="oidc-subjects"
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={subjects}
                onChange={(event) => setSubjects(event.target.value)}
                placeholder="repo:myorg/myrepo:*"
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={() => void onCreate()} disabled={createProvider.isPending}>
              Create provider
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this OIDC provider?</AlertDialogTitle>
            <AlertDialogDescription>
              Machines using {deleteTarget ? providerLabel(deleteTarget.provider_type) : "this provider"} will
              no longer authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteProvider.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Provider deleted.");
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
