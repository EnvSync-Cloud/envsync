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
import { EnterpriseDeleteDialog } from "../components/EnterpriseDeleteDialog";
import { EnterprisePageFrame } from "../components/EnterprisePageFrame";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import { Switch } from "@shell/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

const PROVIDER_TYPES = [
  {
    value: CreateOidcProviderRequest.provider_type.GITHUB_ACTIONS,
    label: "GitHub Actions",
    issuer: "https://token.actions.githubusercontent.com",
    audience: "https://api.envsync.cloud",
    subject: "repo:ORG/REPO:*",
    hint: "Request this audience from the job. Replace ORG and REPO.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.GITLAB_CI,
    label: "GitLab CI",
    issuer: "https://gitlab.com",
    audience: "https://api.envsync.cloud",
    subject: "project_path:GROUP/PROJECT:ref_type:branch:ref:main",
    hint: "For a self-managed GitLab, replace the issuer with that GitLab origin.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.KUBERNETES,
    label: "Kubernetes",
    issuer: "",
    audience: "https://api.envsync.cloud",
    subject: "system:serviceaccount:NAMESPACE:NAME",
    hint: "Use the cluster issuer. It is not a single public URL.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.VERCEL,
    label: "Vercel",
    issuer: "https://oidc.vercel.com/TEAM",
    audience: "https://vercel.com/TEAM",
    subject: "owner:TEAM:project:PROJECT:environment:production",
    hint: "Team issuer mode. Global mode uses https://oidc.vercel.com. Replace TEAM and PROJECT.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.CIRCLECI,
    label: "CircleCI",
    issuer: "https://oidc.circleci.com/org/ORGANIZATION_ID",
    audience: "ORGANIZATION_ID",
    subject: "org/ORGANIZATION_ID/project/PROJECT_ID/*",
    hint: "The default audience is the organization id. Use a v2 or v3 token when the subject must include the repository.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.BUILDKITE,
    label: "Buildkite",
    issuer: "https://agent.buildkite.com",
    audience: "https://buildkite.com/ORG",
    subject: "organization:ORG:pipeline:PIPELINE:ref:refs/heads/main:commit:*:step:*",
    hint: "Pass the same audience to buildkite-agent oidc request-token.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.BITBUCKET_PIPELINES,
    label: "Bitbucket Pipelines",
    issuer: "https://api.bitbucket.org/2.0/workspaces/WORKSPACE/pipelines-config/identity/oidc",
    audience: "ari:cloud:bitbucket::workspace/WORKSPACE_UUID",
    subject: "{REPOSITORY_UUID}:*",
    hint: "Copy the issuer and audience from repository settings, OpenID Connect. Keep the braces around the repository UUID.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.AZURE_PIPELINES,
    label: "Azure Pipelines",
    issuer: "https://vstoken.dev.azure.com/ORGANIZATION_ID",
    audience: "api://AzureADTokenExchange",
    subject: "sc://ORG/PROJECT/SERVICE_CONNECTION",
    hint: "This matches a service-connection token. A newer connection may use a Microsoft Entra issuer instead.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.TERRAFORM_CLOUD,
    label: "HCP Terraform",
    issuer: "https://app.terraform.io",
    audience: "https://api.envsync.cloud",
    subject: "organization:ORG:project:PROJECT:workspace:WORKSPACE:run_phase:apply",
    hint: "Set the workspace workload identity audience to this same audience.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.SPACELIFT,
    label: "Spacelift",
    issuer: "https://ACCOUNT.app.spacelift.io",
    audience: "ACCOUNT.app.spacelift.io",
    subject: "space:SPACE_ID:stack:STACK_ID:run_type:TRACKED:scope:read",
    hint: "Issuer and audience are your Spacelift account hostname.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.PULUMI,
    label: "Pulumi",
    issuer: "https://api.pulumi.com/oidc",
    audience: "ORG",
    subject: "pulumi:deploy:org:ORG:project:PROJECT:stack:STACK:operation:update:scope:write",
    hint: "The audience is the Pulumi organization name.",
  },
  {
    value: CreateOidcProviderRequest.provider_type.GENERIC,
    label: "Generic",
    issuer: "",
    audience: "https://api.envsync.cloud",
    subject: "",
    hint: "Any issuer that publishes OpenID discovery. Replace the audience with the one the job requests.",
  },
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
  const [audience, setAudience] = useState(PROVIDER_TYPES[0].audience);
  const [subjects, setSubjects] = useState(PROVIDER_TYPES[0].subject);

  const enabledCount = useMemo(
    () => providers.filter((provider) => provider.enabled).length,
    [providers],
  );

  const selectedPreset = PROVIDER_TYPES.find((item) => item.value === providerType);

  const onTypeChange = (next: OidcProviderType) => {
    const previous = PROVIDER_TYPES.find((item) => item.value === providerType);
    const preset = PROVIDER_TYPES.find((item) => item.value === next);
    setProviderType(next);
    if (!preset) return;
    if (!issuerUrl || issuerUrl === previous?.issuer) setIssuerUrl(preset.issuer);
    if (!audience || audience === previous?.audience) setAudience(preset.audience);
    if (!subjects || subjects === previous?.subject) setSubjects(preset.subject);
  };

  const onCreate = async () => {
    const allowedSubjects = subjects
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!issuerUrl.trim() || !audience.trim()) {
      toast.error("Issuer URL and audience are required.");
      return;
    }
    if (allowedSubjects.length === 0) {
      toast.error("At least one allowed subject is required. An empty list rejects every token.");
      return;
    }
    try {
      await createProvider.mutateAsync({
        provider_type: providerType,
        issuer_url: issuerUrl.trim(),
        audience: audience.trim(),
        allowed_subjects: allowedSubjects,
      });
      toast.success("Workload OIDC provider created.");
      setSheetOpen(false);
      setAudience("");
      setSubjects("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create provider.");
    }
  };

  return (
    <EnterprisePageFrame
      title="Workload OIDC"
      description="Trust a CI or cluster identity without a long-lived service token. Pick a platform to fill the issuer, audience, and subject, then replace the placeholders. Human SAML login stays on SSO."
      icon={<Fingerprint className="size-7" />}
      enabled={enabled}
      isError={isError}
      error={error}
      actions={
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
      }
    >

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
              Machines present a JWT from this issuer. At least one subject pattern is required; an empty list rejects every token. Only * is a wildcard.
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
              {selectedPreset?.hint ? (
                <p className="text-xs text-muted-foreground">{selectedPreset.hint}</p>
              ) : null}
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

      <EnterpriseDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete this OIDC provider?"
        description={`Machines using ${deleteTarget ? providerLabel(deleteTarget.provider_type) : "this provider"} will no longer authenticate.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProvider.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Provider deleted.");
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
          });
        }}
      />
    </EnterprisePageFrame>
  );
}
