import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Layers3, Link2, Plus, RefreshCw, Workflow } from "lucide-react";

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

  const handleBack = () => {
    window.location.href = appDetailPath(appId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleBack}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {project?.name || "Project"}
          </Button>
          <span className="text-zinc-600">/</span>
          <h1 className="text-lg font-medium text-zinc-100">Integrations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowCreateConnection(true)}
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Connection
          </Button>
          <Button
            onClick={() => setShowCreateSecret(true)}
            size="sm"
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add Secret
          </Button>
          <Link to={orgIntegrationsPath()}>
            <Button
              size="sm"
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Org Integrations
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 @768px:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Connections</p>
            <Link2 className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{providerConnections.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Bindings</p>
            <Layers3 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{bindings.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Mappings</p>
            <Workflow className="size-4 text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{mappings.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">Sync Runs</p>
            <RefreshCw className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{syncRuns.length}</p>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="h-auto rounded-none border-b border-zinc-800 bg-transparent p-0 w-full justify-start gap-0">
          <TabsTrigger
            value="connections"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
          >
            Connections
          </TabsTrigger>
          <TabsTrigger
            value="syncs"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
          >
            Syncs
          </TabsTrigger>
          <TabsTrigger
            value="org-secrets"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-300 data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
          >
            Org Secrets
          </TabsTrigger>
        </TabsList>

        {/* Connections tab */}
        <TabsContent value="connections" className="mt-0">
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_120px_40px] gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Provider</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Connections</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Bindings</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Mappings</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Last Sync</span>
              <span />
            </div>

            {/* Rows */}
            {providerSummary.map((provider) => (
              <Link
                key={provider.id}
                to={appIntegrationProviderPath(appId, provider.id)}
                className="grid grid-cols-[1fr_100px_100px_100px_120px_40px] gap-4 px-4 py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-zinc-300">
                      {provider.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{provider.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{provider.description}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-zinc-300">{provider.connectionCount}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-zinc-300">{provider.bindingCount}</span>
                </div>

                <div className="flex items-center">
                  <span className="text-sm text-zinc-300">{provider.mappingCount}</span>
                </div>

                <div className="flex items-center">
                  {provider.latestSync ? (
                    <span className="text-xs text-zinc-400">{provider.latestSync.status}</span>
                  ) : (
                    <span className="text-xs text-zinc-600">—</span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <ChevronRight className="size-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
              </Link>
            ))}

            {providerSummary.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Link2 className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">No integrations available</p>
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
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_200px_120px] gap-4 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Key</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Description</span>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">Created</span>
            </div>

            {orgSecrets.map((secret) => (
              <div
                key={secret.id}
                className="grid grid-cols-[1fr_200px_120px] gap-4 px-4 py-3 border-b border-zinc-800/50 last:border-0"
              >
                <div className="flex items-center min-w-0">
                  <span className="text-sm font-mono text-zinc-200 truncate">{secret.key}</span>
                </div>
                <div className="flex items-center min-w-0">
                  <span className="text-xs text-zinc-500 truncate">{secret.description || "—"}</span>
                </div>
                <div className="flex items-center justify-end">
                  <span className="text-xs text-zinc-500">
                    {secret.created_at ? new Date(secret.created_at).toLocaleDateString() : "—"}
                  </span>
                </div>
              </div>
            ))}

            {orgSecrets.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Layers3 className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500">No organization secrets configured</p>
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
