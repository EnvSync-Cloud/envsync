import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Layers3, Link2, Plus, RefreshCw, Workflow } from "lucide-react";

import { sdk } from "@/api";
import { useCreateManualSyncRun, useEnvTypeMappings, useIntegrationBindings, useOrgSecrets, useProviderConnections, useSyncRuns, type EnterpriseProvider } from "@/api/enterprise/hooks";
import { CreateOrgSecretModal } from "@/components/enterprise/CreateOrgSecretModal";
import { CreateProviderConnectionModal } from "@/components/enterprise/CreateProviderConnectionModal";
import { SyncRunsList } from "@/components/enterprise/SyncRunsList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { appDetailPath, appIntegrationProviderPath, orgIntegrationsPath } from "@/lib/app-routes";
import { enterpriseProviderUi } from "@/lib/enterprise-provider-ui";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Integrations</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateConnection(true)}
            size="sm"
            className="bg-emerald-600 text-foreground hover:bg-emerald-700"
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
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 @768px:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Connections</p>
            <Link2 className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{providerConnections.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Bindings</p>
            <Layers3 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{bindings.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Mappings</p>
            <Workflow className="size-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{mappings.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Sync Runs</p>
            <RefreshCw className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{syncRuns.length}</p>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="h-auto rounded-none border-b border-border bg-transparent p-0 w-full justify-start gap-0">
          <TabsTrigger
            value="connections"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Connections
          </TabsTrigger>
          <TabsTrigger
            value="syncs"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Syncs
          </TabsTrigger>
          <TabsTrigger
            value="org-secrets"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Org Secrets
          </TabsTrigger>
        </TabsList>

        {/* Connections tab */}
        <TabsContent value="connections" className="mt-0">
          <div className="border border-border rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_120px_40px] gap-4 px-4 py-3 border-b border-border bg-card/50">
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Provider</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Connections</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Bindings</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Mappings</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Last Sync</span>
              <span />
            </div>

            {/* Rows */}
            {providerSummary.map((provider) => (
              <Link
                key={provider.id}
                to={appIntegrationProviderPath(appId, provider.id)}
                className="grid grid-cols-[1fr_100px_100px_100px_120px_40px] gap-4 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-muted border border-border/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      {provider.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{provider.name}</p>
                    <p className="text-xs text-tertiary truncate">{provider.description}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{provider.connectionCount}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{provider.bindingCount}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground">{provider.mappingCount}</span>
                </div>

                <div className="flex items-center">
                  {provider.latestSync ? (
                    <span className="text-xs text-muted-foreground">{provider.latestSync.status}</span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <ChevronRight className="size-4 text-zinc-600 group-hover:text-muted-foreground transition-colors" />
                </div>
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
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Key</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider">Description</span>
              <span className="text-xs font-medium text-tertiary uppercase tracking-wider text-right">Created</span>
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
    </div>
  );
}
