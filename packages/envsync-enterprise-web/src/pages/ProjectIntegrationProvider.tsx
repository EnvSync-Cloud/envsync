import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";

import { sdk } from "@shell/api";
import {
  type EnterpriseProvider,
  useCreateEnvTypeMapping,
  useCreateIntegrationBinding,
  useCreateManualSyncRun,
  useEnvTypeMappings,
  useIntegrationBindings,
  useOrgSecrets,
  useProviderConnections,
  useSyncAuditEvents,
  useSyncRuns,
  useUpdateEnvTypeMapping,
  useUpdateIntegrationBinding,
} from "../api/hooks";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shell/components/ui/tabs";
import { Textarea } from "@shell/components/ui/textarea";
import { appIntegrationsPath, orgIntegrationsPath } from "@shell/lib/app-routes";
import {
  emptyFieldValues,
  enterpriseProviderUi,
  extractKnownFieldValues,
  mergeFieldValuesIntoRecord,
  omitKnownFields,
  type ProviderFieldConfig,
} from "../lib/enterprise-provider-ui";

type FieldState = Record<string, string>;

type BindingDraft = {
  is_enabled: boolean;
  metadataFields: FieldState;
  metadataRaw: string;
};

type MappingDraft = {
  target_identifier: string;
  branch_ref: string;
  path_prefix: string;
  metadataFields: FieldState;
  metadataRaw: string;
};

function parseRecord(text: string) {
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function stringifyRecord(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

function buildMetadata(
  fields: ProviderFieldConfig[],
  values: FieldState,
  raw: string,
) {
  return mergeFieldValuesIntoRecord(fields, values, parseRecord(raw));
}

function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-tertiary">{text}</p>;
}

function ProviderFieldEditor({
  field,
  value,
  onChange,
  secretOptions = [],
}: {
  field: ProviderFieldConfig;
  value: string;
  onChange: (value: string) => void;
  secretOptions?: string[];
}) {
  const commonClassName = "flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground";
  const listId = `${field.key}-secret-options`;

  return (
    <label className="space-y-2">
      <span className="text-sm text-muted-foreground">{field.label}</span>
      {field.kind === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={commonClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            list={field.kind === "secret-ref" ? listId : undefined}
          />
          {field.kind === "secret-ref" && secretOptions.length > 0 && (
            <datalist id={listId}>
              {secretOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </>
      )}
      <FieldHint text={field.helper} />
    </label>
  );
}

export default function ProjectIntegrationProvider() {
  const { appId = "" } = useParams();
  const location = useLocation();
  const providerId = (location.pathname.split("/").filter(Boolean).at(-1) ?? "github") as EnterpriseProvider;
  const copy = enterpriseProviderUi[providerId];

  const { data: project } = useQuery({
    queryKey: ["app", appId],
    queryFn: () => sdk.applications.getApp(appId),
    enabled: Boolean(appId),
  });

  const envTypes = project?.env_types ?? [];
  const { data: providerConnections = [] } = useProviderConnections();
  const { data: orgSecrets = [] } = useOrgSecrets();
  const { data: bindings = [] } = useIntegrationBindings(appId);
  const { data: mappings = [] } = useEnvTypeMappings(appId);
  const { data: syncRuns = [] } = useSyncRuns(appId);

  const createBinding = useCreateIntegrationBinding(appId);
  const updateBinding = useUpdateIntegrationBinding(appId);
  const createMapping = useCreateEnvTypeMapping(appId);
  const updateMapping = useUpdateEnvTypeMapping(appId);
  const createManualSyncRun = useCreateManualSyncRun();

  const eligibleConnections = providerConnections.filter((entry) => entry.provider_type === providerId);
  const providerBindings = bindings.filter((entry) => entry.provider_type === providerId);
  const providerConnectionById = useMemo(
    () => Object.fromEntries(providerConnections.map((entry) => [entry.id, entry])),
    [providerConnections],
  );
  const providerMappings = useMemo(
    () => mappings.filter((mapping) => providerBindings.some((binding) => binding.id === mapping.integration_binding_id)),
    [mappings, providerBindings],
  );
  const providerSyncRuns = syncRuns.filter((run) => run.provider_type === providerId);
  const [selectedSyncRunId, setSelectedSyncRunId] = useState<string | null>(null);
  const orgSecretKeys = useMemo(() => orgSecrets.map((secret) => secret.key), [orgSecrets]);

  const [bindingForm, setBindingForm] = useState({
    provider_connection_id: "",
    metadataFields: emptyFieldValues(copy.bindingFields),
    metadataRaw: "{}",
  });
  const [mappingForm, setMappingForm] = useState({
    env_type_id: "",
    integration_binding_id: "",
    target_identifier: "",
    branch_ref: "",
    path_prefix: "",
    metadataFields: emptyFieldValues(copy.mappingFields),
    metadataRaw: "{}",
  });
  const [bindingDrafts, setBindingDrafts] = useState<Record<string, BindingDraft>>({});
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, MappingDraft>>({});

  useEffect(() => {
    if (providerSyncRuns.length === 0) {
      setSelectedSyncRunId(null);
      return;
    }

    if (!selectedSyncRunId || !providerSyncRuns.some((run) => run.id === selectedSyncRunId)) {
      setSelectedSyncRunId(providerSyncRuns[0]?.id ?? null);
    }
  }, [providerSyncRuns, selectedSyncRunId]);

  const selectedSyncRun = useMemo(
    () => providerSyncRuns.find((run) => run.id === selectedSyncRunId) ?? null,
    [providerSyncRuns, selectedSyncRunId],
  );
  const { data: selectedSyncAuditEvents = [] } = useSyncAuditEvents(selectedSyncRunId ?? undefined);

  useEffect(() => {
    setBindingForm((prev) => ({
      ...prev,
      metadataFields: emptyFieldValues(copy.bindingFields),
      metadataRaw: "{}",
    }));
    setMappingForm((prev) => ({
      ...prev,
      metadataFields: emptyFieldValues(copy.mappingFields),
      metadataRaw: "{}",
    }));
  }, [copy.bindingFields, copy.mappingFields]);

  useEffect(() => {
    if (!bindingForm.provider_connection_id && eligibleConnections.length > 0) {
      setBindingForm((prev) => ({ ...prev, provider_connection_id: eligibleConnections[0]?.id ?? "" }));
    }
  }, [bindingForm.provider_connection_id, eligibleConnections]);

  useEffect(() => {
    if (!mappingForm.integration_binding_id && providerBindings.length > 0) {
      setMappingForm((prev) => ({ ...prev, integration_binding_id: providerBindings[0]?.id ?? "" }));
    }
  }, [mappingForm.integration_binding_id, providerBindings]);

  useEffect(() => {
    if (!mappingForm.env_type_id && envTypes.length > 0) {
      setMappingForm((prev) => ({ ...prev, env_type_id: envTypes[0]?.id ?? "" }));
    }
  }, [envTypes, mappingForm.env_type_id]);

  useEffect(() => {
    setBindingDrafts(
      Object.fromEntries(
        providerBindings.map((binding) => [
          binding.id,
          {
            is_enabled: binding.is_enabled,
            metadataFields: extractKnownFieldValues(binding.metadata, copy.bindingFields),
            metadataRaw: stringifyRecord(omitKnownFields(binding.metadata, copy.bindingFields)),
          },
        ]),
      ),
    );
  }, [copy.bindingFields, providerBindings]);

  useEffect(() => {
    setMappingDrafts(
      Object.fromEntries(
        providerMappings.map((mapping) => [
          mapping.id,
          {
            target_identifier: mapping.target_identifier,
            branch_ref: mapping.branch_ref ?? "",
            path_prefix: mapping.path_prefix ?? "",
            metadataFields: extractKnownFieldValues(mapping.metadata, copy.mappingFields),
            metadataRaw: stringifyRecord(omitKnownFields(mapping.metadata, copy.mappingFields)),
          },
        ]),
      ),
    );
  }, [copy.mappingFields, providerMappings]);

  const onCreateBinding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!bindingForm.provider_connection_id) {
      toast.error("Select a provider connection first.");
      return;
    }

    try {
      await createBinding.mutateAsync({
        provider_connection_id: bindingForm.provider_connection_id,
        provider_type: providerId,
        metadata: buildMetadata(copy.bindingFields, bindingForm.metadataFields, bindingForm.metadataRaw),
      });
      setBindingForm((prev) => ({
        ...prev,
        metadataFields: emptyFieldValues(copy.bindingFields),
        metadataRaw: "{}",
      }));
      toast.success("Integration binding created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create integration binding.");
    }
  };

  const onCreateMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mappingForm.env_type_id || !mappingForm.integration_binding_id || !mappingForm.target_identifier) {
      toast.error("Choose an environment type, binding, and target identifier.");
      return;
    }

    try {
      await createMapping.mutateAsync({
        env_type_id: mappingForm.env_type_id,
        integration_binding_id: mappingForm.integration_binding_id,
        target_identifier: mappingForm.target_identifier,
        branch_ref: copy.usesBranch ? mappingForm.branch_ref || null : null,
        path_prefix: copy.usesPath ? mappingForm.path_prefix || null : null,
        metadata: buildMetadata(copy.mappingFields, mappingForm.metadataFields, mappingForm.metadataRaw),
      });
      setMappingForm((prev) => ({
        ...prev,
        target_identifier: "",
        branch_ref: "",
        path_prefix: "",
        metadataFields: emptyFieldValues(copy.mappingFields),
        metadataRaw: "{}",
      }));
      toast.success("Environment mapping created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create environment mapping.");
    }
  };

  const onRequestSync = async () => {
    try {
      await createManualSyncRun.mutateAsync({
        app_id: appId,
        provider_type: providerId,
        metadata: { source: "dashboard" },
      });
      toast.success("Manual sync requested.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to request manual sync.");
    }
  };

  const onSaveBinding = async (bindingId: string) => {
    const draft = bindingDrafts[bindingId];
    if (!draft) return;

    try {
      await updateBinding.mutateAsync({
        id: bindingId,
        is_enabled: draft.is_enabled,
        metadata: buildMetadata(copy.bindingFields, draft.metadataFields, draft.metadataRaw),
      });
      toast.success("Binding updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update binding.");
    }
  };

  const onSaveMapping = async (mappingId: string) => {
    const draft = mappingDrafts[mappingId];
    if (!draft) return;

    try {
      await updateMapping.mutateAsync({
        id: mappingId,
        target_identifier: draft.target_identifier,
        branch_ref: copy.usesBranch ? draft.branch_ref || null : null,
        path_prefix: copy.usesPath ? draft.path_prefix || null : null,
        metadata: buildMetadata(copy.mappingFields, draft.metadataFields, draft.metadataRaw),
      });
      toast.success("Mapping updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update mapping.");
    }
  };

  const handleBack = () => {
    window.location.href = appIntegrationsPath(appId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={handleBack} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Integrations
          </Button>
          <span className="text-zinc-600">/</span>
          <h1 className="text-lg font-medium text-foreground">
            {copy.name} {project?.name ? `— ${project.name}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onRequestSync} size="sm" className="bg-emerald-600 text-foreground hover:bg-emerald-700">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Trigger Sync
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 @768px:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Connections</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{eligibleConnections.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Bindings</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{providerBindings.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Mappings</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{providerMappings.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4">
          <p className="text-xs text-muted-foreground">Sync Runs</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{providerSyncRuns.length}</p>
        </div>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="bindings" className="space-y-4">
        <TabsList className="h-auto rounded-none border-b border-border bg-transparent p-0 w-full justify-start gap-0">
          <TabsTrigger
            value="bindings"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Bindings
          </TabsTrigger>
          <TabsTrigger
            value="mappings"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Mappings
          </TabsTrigger>
          <TabsTrigger
            value="syncs"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-tertiary transition-colors hover:text-muted-foreground data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            Sync Runs
          </TabsTrigger>
        </TabsList>

        {/* Bindings tab */}
        <TabsContent value="bindings" className="mt-0 space-y-4">
          {/* Create binding form */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/50">
              <h3 className="text-sm font-medium text-foreground">Create Binding</h3>
            </div>
            <form onSubmit={onCreateBinding} className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider-connection">Provider Connection</Label>
                <select
                  id="provider-connection"
                  value={bindingForm.provider_connection_id}
                  onChange={(event) => setBindingForm((prev) => ({ ...prev, provider_connection_id: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  <option value="">Select connection</option>
                  {eligibleConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} ({connection.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {copy.bindingFields.map((field) => (
                  <ProviderFieldEditor
                    key={field.key}
                    field={field}
                    value={bindingForm.metadataFields[field.key] ?? ""}
                    onChange={(value) =>
                      setBindingForm((prev) => ({
                        ...prev,
                        metadataFields: { ...prev.metadataFields, [field.key]: value },
                      }))
                    }
                    secretOptions={field.kind === "secret-ref" ? orgSecretKeys : undefined}
                  />
                ))}
              </div>

              <Button type="submit" disabled={createBinding.isPending || eligibleConnections.length === 0}>
                {createBinding.isPending ? "Creating..." : "Create Binding"}
              </Button>
            </form>
          </div>

          {/* Existing bindings */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/50">
              <h3 className="text-sm font-medium text-foreground">Existing Bindings</h3>
            </div>
            {providerBindings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-tertiary">No bindings yet</p>
              </div>
            ) : (
              <div>
                {providerBindings.map((binding) => {
                  const draft = bindingDrafts[binding.id] ?? {
                    is_enabled: binding.is_enabled,
                    metadataFields: extractKnownFieldValues(binding.metadata, copy.bindingFields),
                    metadataRaw: stringifyRecord(omitKnownFields(binding.metadata, copy.bindingFields)),
                  };
                  const connection = providerConnectionById[binding.provider_connection_id];

                  return (
                    <div key={binding.id} className="px-4 py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {connection?.name ?? binding.provider_connection_id}
                            </p>
                            <p className="text-xs text-tertiary">
                              {binding.provider_type} · {draft.is_enabled ? "enabled" : "disabled"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateBinding.isPending}
                          onClick={() => void onSaveBinding(binding.id)}
                          className="text-tertiary hover:text-foreground"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Mappings tab */}
        <TabsContent value="mappings" className="mt-0 space-y-4">
          {/* Create mapping form */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/50">
              <h3 className="text-sm font-medium text-foreground">Create Mapping</h3>
            </div>
            <form onSubmit={onCreateMapping} className="p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mapping-binding">Binding</Label>
                  <select
                    id="mapping-binding"
                    value={mappingForm.integration_binding_id}
                    onChange={(event) => setMappingForm((prev) => ({ ...prev, integration_binding_id: event.target.value }))}
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select binding</option>
                    {providerBindings.map((binding) => {
                      const connection = providerConnectionById[binding.provider_connection_id];
                      return (
                        <option key={binding.id} value={binding.id}>
                          {connection?.name ?? `${binding.id.slice(0, 8)}...`}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mapping-env-type">Environment Type</Label>
                  <select
                    id="mapping-env-type"
                    value={mappingForm.env_type_id}
                    onChange={(event) => setMappingForm((prev) => ({ ...prev, env_type_id: event.target.value }))}
                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Select environment type</option>
                    {envTypes.map((envType) => (
                      <option key={envType.id} value={envType.id}>
                        {envType.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-identifier">{copy.targetLabel}</Label>
                <Input
                  id="target-identifier"
                  value={mappingForm.target_identifier}
                  onChange={(event) => setMappingForm((prev) => ({ ...prev, target_identifier: event.target.value }))}
                  placeholder={copy.targetPlaceholder}
                />
              </div>

              {(copy.usesBranch || copy.usesPath) && (
                <div className={`grid gap-4 ${copy.usesBranch && copy.usesPath ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                  {copy.usesBranch && (
                    <div className="space-y-2">
                      <Label htmlFor="branch-ref">{copy.branchLabel}</Label>
                      <Input
                        id="branch-ref"
                        value={mappingForm.branch_ref}
                        onChange={(event) => setMappingForm((prev) => ({ ...prev, branch_ref: event.target.value }))}
                        placeholder={copy.branchPlaceholder}
                      />
                    </div>
                  )}
                  {copy.usesPath && (
                    <div className="space-y-2">
                      <Label htmlFor="path-prefix">{copy.pathLabel}</Label>
                      <Input
                        id="path-prefix"
                        value={mappingForm.path_prefix}
                        onChange={(event) => setMappingForm((prev) => ({ ...prev, path_prefix: event.target.value }))}
                        placeholder={copy.pathPlaceholder}
                      />
                    </div>
                  )}
                </div>
              )}

              <Button type="submit" disabled={createMapping.isPending || providerBindings.length === 0 || envTypes.length === 0}>
                {createMapping.isPending ? "Creating..." : "Create Mapping"}
              </Button>
            </form>
          </div>

          {/* Existing mappings */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/50">
              <h3 className="text-sm font-medium text-foreground">Existing Mappings</h3>
            </div>
            {providerMappings.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-tertiary">No mappings yet</p>
              </div>
            ) : (
              <div>
                {providerMappings.map((mapping) => {
                  const envType = envTypes.find((entry) => entry.id === mapping.env_type_id);
                  const binding = providerBindings.find((entry) => entry.id === mapping.integration_binding_id);
                  const connection = binding ? providerConnectionById[binding.provider_connection_id] : null;
                  const draft = mappingDrafts[mapping.id] ?? {
                    target_identifier: mapping.target_identifier,
                    branch_ref: mapping.branch_ref ?? "",
                    path_prefix: mapping.path_prefix ?? "",
                    metadataFields: extractKnownFieldValues(mapping.metadata, copy.mappingFields),
                    metadataRaw: stringifyRecord(omitKnownFields(mapping.metadata, copy.mappingFields)),
                  };

                  return (
                    <div key={mapping.id} className="px-4 py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {envType?.name ?? mapping.env_type_id}
                            </p>
                            <p className="text-xs text-tertiary">
                              {connection?.name ?? binding?.provider_connection_id ?? mapping.integration_binding_id}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateMapping.isPending}
                          onClick={() => void onSaveMapping(mapping.id)}
                          className="text-tertiary hover:text-foreground"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sync Runs tab */}
        <TabsContent value="syncs" className="mt-0 space-y-4">
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-card/50">
              <h3 className="text-sm font-medium text-foreground">Sync Runs</h3>
            </div>
            {providerSyncRuns.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <RefreshCw className="mx-auto h-8 w-8 text-zinc-700 mb-3" />
                <p className="text-sm text-tertiary">No sync runs yet</p>
              </div>
            ) : (
              <div>
                {providerSyncRuns.slice(0, 10).map((run) => (
                  <div
                    key={run.id}
                    className={`px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                      selectedSyncRunId === run.id ? "bg-emerald-500/5" : ""
                    }`}
                    onClick={() => setSelectedSyncRunId(run.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {run.id.slice(0, 8)}...
                          </p>
                          <p className="text-xs text-tertiary">
                            {new Date(run.started_at).toLocaleString()}
                            {run.completed_at ? ` · ${new Date(run.completed_at).toLocaleString()}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          run.status === "succeeded"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : run.status === "failed"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {run.status}
                      </Badge>
                    </div>
                    {run.error_message && (
                      <p className="mt-2 text-xs text-red-400 truncate">{run.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected sync run details */}
          {selectedSyncRun && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground">Sync Run Details</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={createManualSyncRun.isPending}
                    onClick={() => {
                      createManualSyncRun.mutateAsync({
                        app_id: appId,
                        provider_type: providerId,
                        metadata: { source: "dashboard-retry", retry_of: selectedSyncRun.id },
                      });
                    }}
                    className="text-muted-foreground border-border hover:bg-muted"
                  >
                    Retry
                  </Button>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {selectedSyncAuditEvents.length > 0 ? (
                  selectedSyncAuditEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          event.result === "success"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : event.result === "error"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
                        }`}
                      >
                        {event.result}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{event.action}</p>
                        <p className="text-xs text-tertiary">{new Date(event.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-tertiary text-center py-4">No audit events recorded for this run.</p>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
