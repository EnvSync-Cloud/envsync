import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";

import { sdk } from "@/api";
import {
  listIntegrationBindings,
  useOrgSecrets,
  useProviderConnections,
} from "@/api/enterprise/hooks";
import type { EnterpriseProvider, OrgSecret, ProviderConnection } from "@/api/enterprise/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  emptyFieldValues,
  enterpriseProviderUi,
  extractKnownFieldValues,
  mergeFieldValuesIntoRecord,
  omitKnownFields,
  type ProviderFieldConfig,
} from "@/lib/enterprise-provider-ui";

type FieldState = Record<string, string>;

type ProviderConnectionDraft = {
  name: string;
  status: "active" | "inactive" | "error";
  authFields: FieldState;
  metadataFields: FieldState;
  authRaw: string;
  metadataRaw: string;
};

type OrgSecretDraft = {
  value: string;
  description: string;
  providerRefs: string;
  rotationPolicy: string;
  metadataRaw: string;
};

function stringifyRecord(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

function omitSecretMetadata(metadata: Record<string, unknown> | undefined) {
  const next = { ...(metadata ?? {}) };
  delete next.provider_refs;
  delete next.rotation_policy;
  return next;
}

function secretProviderRefs(secret: OrgSecret) {
  return Array.isArray(secret.metadata?.provider_refs)
    ? secret.metadata.provider_refs.filter((value): value is string => typeof value === "string")
    : [];
}

function isSecretRelevant(secret: OrgSecret, providerFilter?: EnterpriseProvider) {
  if (!providerFilter) return true;
  const refs = secretProviderRefs(secret);
  return refs.length === 0 || refs.includes(providerFilter);
}

export function EnterpriseOrgAssetsPanel({
  providerFilter,
  compact = false,
  showUsage = false,
}: {
  providerFilter?: EnterpriseProvider;
  compact?: boolean;
  showUsage?: boolean;
}) {
  const [connectionDrafts, setConnectionDrafts] = useState<Record<string, ProviderConnectionDraft>>({});
  const [secretDrafts, setSecretDrafts] = useState<Record<string, OrgSecretDraft>>({});

  const { data: providerConnections = [] } = useProviderConnections();
  const { data: orgSecrets = [] } = useOrgSecrets();

  const filteredConnections = useMemo(
    () => providerConnections.filter((connection) => !providerFilter || connection.provider_type === providerFilter),
    [providerConnections, providerFilter],
  );
  const filteredSecrets = useMemo(
    () => orgSecrets.filter((secret) => isSecretRelevant(secret, providerFilter)),
    [orgSecrets, providerFilter],
  );

  useEffect(() => {
    setConnectionDrafts(
      Object.fromEntries(
        filteredConnections.map((connection) => {
          const config = enterpriseProviderUi[connection.provider_type];
          return [
            connection.id,
            {
              name: connection.name,
              status: connection.status,
              authFields: extractKnownFieldValues(connection.auth_config, config.connectionAuthFields),
              metadataFields: extractKnownFieldValues(connection.metadata, config.connectionMetadataFields),
              authRaw: stringifyRecord(omitKnownFields(connection.auth_config, config.connectionAuthFields)),
              metadataRaw: stringifyRecord(omitKnownFields(connection.metadata, config.connectionMetadataFields)),
            },
          ];
        }),
      ),
    );
  }, [filteredConnections]);

  useEffect(() => {
    setSecretDrafts(
      Object.fromEntries(
        filteredSecrets.map((secret) => [
          secret.id,
          {
            value: secret.value,
            description: secret.description ?? "",
            providerRefs: secretProviderRefs(secret).join(", "),
            rotationPolicy: typeof secret.metadata?.rotation_policy === "string" ? secret.metadata.rotation_policy : "manual",
            metadataRaw: stringifyRecord(omitSecretMetadata(secret.metadata)),
          },
        ]),
      ),
    );
  }, [filteredSecrets]);

  const { data: apps = [] } = useQuery({
    queryKey: ["applications", "all"],
    queryFn: () => sdk.applications.getApps(),
    enabled: showUsage,
  });
  const bindingQueries = useQueries({
    queries: showUsage
      ? apps.map((app) => ({
          queryKey: ["enterprise", "bindings", app.id],
          queryFn: () => listIntegrationBindings(app.id),
        }))
      : [],
  });
  const connectionUsage = useMemo(() => {
    const usage = new Map<string, Array<{ id: string; name: string }>>();
    if (!showUsage) return usage;

    for (const [index, app] of apps.entries()) {
      const bindings = bindingQueries[index]?.data ?? [];
      for (const binding of bindings) {
        const existing = usage.get(binding.provider_connection_id) ?? [];
        if (!existing.some((entry) => entry.id === app.id)) {
          existing.push({ id: app.id, name: app.name });
          usage.set(binding.provider_connection_id, existing);
        }
      }
    }

    return usage;
  }, [apps, bindingQueries, showUsage]);

  return (
    <div className={`grid gap-6 ${compact ? "xl:grid-cols-2" : "2xl:grid-cols-2"}`}>
      <section className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Provider Connections</h3>
            <p className="mt-1 text-xs text-tertiary">
              {providerFilter ? `${enterpriseProviderUi[providerFilter].name} connections.` : "Org-level credentials."}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {filteredConnections.slice(0, compact ? 3 : filteredConnections.length).map((connection) => {
            const draft = connectionDrafts[connection.id];
            if (!draft) return null;
            const usage = connectionUsage.get(connection.id) ?? [];

            return (
              <div key={connection.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{connection.name}</p>
                  <p className="text-xs text-tertiary">
                    {connection.provider_type} · {draft.status}
                    {showUsage && usage.length > 0 && ` · Used by ${usage.map((entry) => entry.name).join(", ")}`}
                  </p>
                </div>
                <span className="text-xs text-tertiary">
                  {new Date(connection.updated_at).toLocaleDateString()}
                </span>
              </div>
            );
          })}
          {filteredConnections.length === 0 && (
            <p className="text-xs text-tertiary py-4 text-center">No connections yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Org Secrets</h3>
            <p className="mt-1 text-xs text-tertiary">
              Reusable secret references for sync flows.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {filteredSecrets.slice(0, compact ? 4 : filteredSecrets.length).map((secret) => {
            const draft = secretDrafts[secret.id];
            if (!draft) return null;
            return (
              <div key={secret.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{secret.key}</p>
                  <p className="text-xs text-tertiary">
                    {draft.description || "No description"}
                    {draft.providerRefs && ` · ${draft.providerRefs}`}
                  </p>
                </div>
                <span className="text-xs text-tertiary">{draft.rotationPolicy}</span>
              </div>
            );
          })}
          {filteredSecrets.length === 0 && (
            <p className="text-xs text-tertiary py-4 text-center">No secrets yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
