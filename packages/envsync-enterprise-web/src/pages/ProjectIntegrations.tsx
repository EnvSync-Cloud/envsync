import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Layers3, Link2, PlugZap, Plus } from "lucide-react";

import { sdk } from "@shell/api";
import { useCreateManualSyncRun, useEnvTypeMappings, useIntegrationBindings, useOrgSecrets, useProviderConnections, useSyncRuns, type EnterpriseProvider } from "../api/hooks";
import { CreateOrgSecretModal } from "../components/CreateOrgSecretModal";
import { CreateProviderConnectionModal } from "../components/CreateProviderConnectionModal";
import { SyncRunsList } from "../components/SyncRunsList";
import { PageShell } from "@shell/components/PageShell";
import { Button } from "@shell/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shell/components/ui/tabs";
import { appDetailPath, appIntegrationProviderPath, orgIntegrationsPath } from "@shell/lib/app-routes";
import { enterpriseProviderUi, providerLogo } from "../lib/enterprise-provider-ui";

const providers = Object.values(enterpriseProviderUi) as Array<{
  id: EnterpriseProvider;
  name: string;
  description: string;
}>;

export default function ProjectIntegrations() {
  const { appId = "" } = useParams();
  const [showCreateConnection, setShowCreateConnection] = useState(false);
  const [showCreateSecret, setShowCreateSecret] = useState(false);

  const { data: project } = useQuery({
    queryKey: ["app", appId],
    queryFn: () => sdk.applications.getApp(appId),
    enabled: Boolean(appId),
  });
  const { data: providerConnections = [] } = useProviderConnections();
  const { data: bindings = [] } = useIntegrationBindings(appId);
  const { data: mappings = [] } = useEnvTypeMappings(appId);
  const { data: syncRuns = [] } = useSyncRuns(appId);
  const { data: orgSecrets = [] } = useOrgSecrets();
  const createManualSyncRun = useCreateManualSyncRun();

  const providerSummary = useMemo(() => {
    return providers.map((provider) => {
      const connectionCount = providerConnections.filter((entry) => entry.provider_type === provider.id).length;
      const bindingCount = bindings.filter((entry) => entry.provider_type === provider.id).length;
      const mappingCount = bindings
        .filter((entry) => entry.provider_type === provider.id)
        .reduce((count, binding) => count + mappings.filter((mapping) => mapping.integration_binding_id === binding.id).length, 0);
      const latestSync = syncRuns.find((run) => run.provider_type === provider.id);

      return {
        ...provider,
        connectionCount,
        bindingCount,
        mappingCount,
        latestSync,
      };
    });
  }, [bindings, mappings, providerConnections, syncRuns]);

  return (
    <PageShell
      title="Integrations"
      icon={PlugZap}
      description="Providers this project can sync environments to."
      actions={
        <>
          <Button
            onClick={() => setShowCreateConnection(true)}
            size="sm"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connection
          </Button>
          <Button
            onClick={() => setShowCreateSecret(true)}
            size="sm"
            variant="outline"
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Secret
          </Button>
          <Link to={orgIntegrationsPath()}>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Org Integrations
            </Button>
          </Link>
        </>
      }
    >
      {/* Stats row */}
      <p className="text-sm text-muted-foreground">
        {providerConnections.length} connections · {bindings.length} bindings · {syncRuns.length} syncs
      </p>

      {/* Tabbed content */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="h-auto rounded-none border-b border-border bg-transparent p-0 w-full justify-start gap-0">
          <TabsTrigger
            value="connections"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Connections
          </TabsTrigger>
          <TabsTrigger
            value="syncs"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Syncs
          </TabsTrigger>
          <TabsTrigger
            value="org-secrets"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Org Secrets
          </TabsTrigger>
        </TabsList>

        {/* Connections tab */}
        <TabsContent value="connections" className="mt-0">
          <div className="border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[minmax(0,1fr)_160px_24px] gap-4 border-b border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Provider</span>
              <span className="text-xs text-muted-foreground">Status</span>
              <span />
            </div>

            {providerSummary.map((provider) => (
              <Link
                key={provider.id}
                to={appIntegrationProviderPath(appId, provider.id)}
                className="grid grid-cols-[minmax(0,1fr)_160px_24px] items-center gap-4 border-b border-border/50 px-4 py-3 last:border-0 hover:bg-muted/30"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {providerLogo(provider.id) ? (
                    <img
                      src={providerLogo(provider.id)}
                      alt=""
                      className="size-8 shrink-0 rounded-md object-contain"
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                      {provider.name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {provider.connectionCount > 0
                    ? `${provider.connectionCount} connected`
                    : "Not connected"}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}

            {providerSummary.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Link2 className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                <p className="text-sm text-tertiary">No integrations available</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Syncs tab */}
        <TabsContent value="syncs" className="mt-0">
          <SyncRunsList
            syncRuns={syncRuns}
            onTriggerSync={() => {
              if (providers.length > 0) {
                createManualSyncRun.mutate({
                  app_id: appId || undefined,
                  provider_type: providers[0].id,
                });
              }
            }}
            isTriggering={createManualSyncRun.isPending}
            basePath={`/apps/${appId}/integrations/sync-runs`}
          />
        </TabsContent>

        {/* Org Secrets tab */}
        <TabsContent value="org-secrets" className="mt-0">
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_200px_120px] gap-4 px-4 py-3 border-b border-border bg-card/50">
              <span className="text-xs font-medium text-tertiary ">Key</span>
              <span className="text-xs font-medium text-tertiary ">Description</span>
              <span className="text-xs font-medium text-tertiary  text-right">Created</span>
            </div>

            {orgSecrets.map((secret) => (
              <div
                key={secret.id}
                className="grid grid-cols-[1fr_200px_120px] gap-4 px-4 py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex items-center min-w-0">
                  <span className="text-sm font-mono text-foreground truncate">{secret.key}</span>
                </div>
                <div className="flex items-center min-w-0">
                  <span className="text-xs text-tertiary truncate">{secret.description || "—"}</span>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-xs text-tertiary">
                    {secret.created_at ? new Date(secret.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            ))}

            {orgSecrets.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Layers3 className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                <p className="text-sm text-tertiary">No organization secrets configured</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateProviderConnectionModal
        open={showCreateConnection}
        onOpenChange={setShowCreateConnection}
      />
      <CreateOrgSecretModal
        open={showCreateSecret}
        onOpenChange={setShowCreateSecret}
      />
    </PageShell>
  );
}
