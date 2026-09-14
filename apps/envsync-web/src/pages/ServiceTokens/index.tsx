import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { ApiRequestError, sdk } from "@/api/base";
import type { ServiceToken } from "@/api/service-tokens.api";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Count } from "@/components/ui/count";
import { PageError } from "@/components/ui/page-error";
import { ProjectSettingsTabs } from "@/components/ProjectSettingsTabs";
import { useAuthContext } from "@/contexts/auth";
import { API_KEYS } from "@/constants";
import { formatDate, formatLastUsed } from "@/lib/utils";

import {
  CreateServiceTokenDialog,
  INITIAL_SERVICE_TOKEN_FORM,
  type ServiceTokenFormState,
} from "./CreateServiceTokenDialog";
import { RevealTokenDialog } from "./RevealTokenDialog";

function tokenStatus(token: ServiceToken) {
  const now = Date.now();
  if (new Date(token.expires_at).getTime() < now) return "Expired";
  if (token.grace_until) {
    return new Date(token.grace_until).getTime() <= now ? "Expired" : "Rotating";
  }
  return "Active";
}

function accessLabel(token: ServiceToken) {
  return token.permissions?.write ? "Read & Write" : "Read";
}

function isForbiddenError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 403;
}

export const ServiceTokens = () => {
  const { appId } = useParams();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const authEnabled = !isAuthLoading && isAuthenticated && Boolean(appId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<ServiceTokenFormState>(INITIAL_SERVICE_TOKEN_FORM);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [revealMode, setRevealMode] = useState<"created" | "rotated">("created");
  const [isRevealOpen, setIsRevealOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const {
    data: permissions,
    isPending: permissionsPending,
  } = api.permissions.getMyPermissions({ enabled: authEnabled });
  const canManage = Boolean(permissions?.can_manage_api_keys);

  const {
    data: tokens = [],
    isPending: tokensPending,
    error,
    refetch,
  } = api.serviceTokens.getServiceTokens(appId, {
    enabled: authEnabled && canManage,
  });

  const { data: environments = [] } = useQuery({
    queryKey: [API_KEYS.ALL_ENVIRONMENT_TYPES, appId],
    queryFn: async () => {
      if (!appId) return [];
      const app = await sdk.applications.getApp(appId);
      return app.env_types.map((envType) => ({ id: envType.id, name: envType.name }));
    },
    enabled: authEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const environmentNameById = useMemo(
    () => new Map(environments.map((environment) => [environment.id, environment.name])),
    [environments],
  );

  const createToken = api.serviceTokens.createServiceToken({
    onSuccess: ({ data }) => {
      setRevealedToken(data.token);
      setRevealMode("created");
      setIsRevealOpen(true);
      setIsCreateOpen(false);
      setForm(INITIAL_SERVICE_TOKEN_FORM);
      toast.success("Service token created");
    },
    onError: ({ error: createError }) => {
      toast.error(createError.message || "Failed to create service token");
    },
  });

  const rotateToken = api.serviceTokens.rotateServiceToken({
    before: ({ id }) => setActionLoading((current) => ({ ...current, [id]: true })),
    onSuccess: ({ data, variables }) => {
      if (variables?.id) {
        setActionLoading((current) => ({ ...current, [variables.id]: false }));
      }
      setRevealedToken(data.token);
      setRevealMode("rotated");
      setIsRevealOpen(true);
      toast.success("Service token rotated");
    },
    onError: ({ error: rotateError, variables }) => {
      if (variables?.id) {
        setActionLoading((current) => ({ ...current, [variables.id]: false }));
      }
      toast.error(rotateError.message || "Failed to rotate service token");
    },
  });

  const deleteToken = api.serviceTokens.deleteServiceToken({
    before: (id) => setActionLoading((current) => ({ ...current, [id]: true })),
    onSuccess: ({ variables }) => {
      if (variables) {
        setActionLoading((current) => ({ ...current, [variables]: false }));
      }
      toast.success("Service token revoked");
    },
    onError: ({ error: deleteError, variables }) => {
      if (variables) {
        setActionLoading((current) => ({ ...current, [variables]: false }));
      }
      toast.error(deleteError.message || "Failed to revoke service token");
    },
  });

  const handleRotate = useCallback(
    (token: ServiceToken) => {
      if (!canManage || actionLoading[token.id] || rotateToken.isPending || token.grace_until) return;
      if (
        !window.confirm(
          "Rotate this service token? The previous value stays valid for 24 hours.",
        )
      ) {
        return;
      }
      rotateToken.mutate({ id: token.id, grace_hours: 24 });
    },
    [actionLoading, canManage, rotateToken],
  );

  const handleRevoke = useCallback(
    (token: ServiceToken) => {
      if (!canManage || actionLoading[token.id] || deleteToken.isPending) return;
      if (
        !window.confirm(
          "Revoke this service token? Clients using it will lose access immediately.",
        )
      ) {
        return;
      }
      deleteToken.mutate(token.id);
    },
    [actionLoading, canManage, deleteToken],
  );

  const handleRevealOpenChange = useCallback(
    (open: boolean) => {
      setIsRevealOpen(open);
      if (!open) {
        setRevealedToken(null);
        createToken.reset();
        rotateToken.reset();
      }
    },
    [createToken, rotateToken],
  );

  const isPageLoading = !authEnabled || permissionsPending || (canManage && tokensPending);
  const isForbidden = isForbiddenError(error) || (!permissionsPending && !canManage && authEnabled);

  if (error && !isForbiddenError(error)) {
    return (
      <PageError
        title="Failed to load service tokens"
        message={error instanceof Error ? error.message : "An unexpected error occurred"}
        onRetry={() => refetch()}
      />
    );
  }

  const isEmpty = !isPageLoading && !isForbidden && tokens.length === 0;

  return (
    <div className="animate-page-enter space-y-6">
      {appId ? <ProjectSettingsTabs appId={appId} active="tokens" /> : null}
      <PageShell
        title="Service Tokens"
        description="Create project-scoped service tokens with environment and secrets-path access."
        icon={KeyRound}
        isLoading={isPageLoading}
        actions={
          canManage ? (
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={createToken.isPending}
              data-testid="create-service-token"
            >
              <Plus className="mr-2 size-4" />
              Create Service Token
            </Button>
          ) : undefined
        }
      >
        <CreateServiceTokenDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          form={form}
          onFormChange={setForm}
          environments={environments}
          isSubmitting={createToken.isPending}
          appId={appId ?? ""}
          onSubmit={(input) => createToken.mutate(input)}
        />
        <RevealTokenDialog
          open={isRevealOpen}
          onOpenChange={handleRevealOpenChange}
          token={revealedToken}
          mode={revealMode}
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <KeyRound className="mr-3 size-8 rounded-md border border-emerald-600 bg-emerald-400 p-2 stroke-[3] text-white" />
              Service Tokens
              <Count count={tokens.length} size="xl" variant="subtle" className="ml-2" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isForbidden ? (
              <div className="py-12 text-center" data-testid="service-tokens-forbidden">
                <KeyRound className="mx-auto mb-4 size-16 text-muted-foreground" />
                <h3 className="mb-2 text-xl font-medium text-foreground">
                  You do not have access
                </h3>
                <p className="mx-auto max-w-md text-muted-foreground">
                  Service tokens require the manage API keys permission.
                </p>
              </div>
            ) : isEmpty ? (
              <div className="py-12 text-center">
                <KeyRound className="mx-auto mb-4 size-16 text-muted-foreground" />
                <h3 className="mb-2 text-xl font-medium text-foreground">No service tokens</h3>
                <p className="mx-auto mb-6 max-w-md text-muted-foreground">
                  Create a service token to let CI and other machines read or write this
                  project&apos;s secrets.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} disabled={createToken.isPending}>
                  <Plus className="mr-2 size-4" />
                  Create Service Token
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Name", "Scopes", "Access", "Expires", "Last used", "Status"].map(
                        (header) => (
                          <th
                            key={header}
                            className="px-4 py-3 text-left font-medium text-muted-foreground"
                          >
                            {header}
                          </th>
                        ),
                      )}
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPageLoading
                      ? Array.from({ length: 4 }, (_, index) => (
                          <tr key={index} className="animate-pulse">
                            {Array.from({ length: 7 }, (__, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-4">
                                <div className="h-4 w-3/4 rounded bg-muted" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : tokens.map((token) => {
                          const status = tokenStatus(token);
                          const busy = Boolean(actionLoading[token.id]);
                          return (
                            <tr
                              key={token.id}
                              className="border-b border-border transition-colors hover:bg-muted/50"
                              data-testid={`service-token-row-${token.id}`}
                            >
                              <td className="px-4 py-4">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{token.name}</span>
                                  <span className="font-mono text-xs text-muted-foreground">
                                    ID: {token.id}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1">
                                  {(token.scopes ?? []).map((scope, index) => (
                                    <Badge key={`${token.id}-scope-${index}`} variant="outline">
                                      {scope.env_type_id
                                        ? environmentNameById.get(scope.env_type_id) ?? "Environment"
                                        : "All Environments"}
                                      {` ${scope.path || "/"}`}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">
                                {accessLabel(token)}
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">
                                {formatDate(token.expires_at)}
                              </td>
                              <td className="px-4 py-4 text-sm text-muted-foreground">
                                {formatLastUsed(token.last_used_at)}
                              </td>
                              <td className="px-4 py-4">
                                <Badge
                                  className={
                                    status === "Active"
                                      ? "border-green-800 bg-green-900 text-green-300"
                                      : status === "Rotating"
                                        ? "border-amber-800 bg-amber-900 text-amber-300"
                                        : "border-border bg-muted text-muted-foreground"
                                  }
                                >
                                  {status}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRotate(token)}
                                    disabled={busy || Boolean(token.grace_until)}
                                    title="Rotate service token"
                                    data-testid={`rotate-service-token-${token.id}`}
                                  >
                                    <RefreshCw className="size-3" />
                                    <span className="ml-2">Rotate</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRevoke(token)}
                                    disabled={busy}
                                    className="border-red-600 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                                    title="Revoke service token"
                                    data-testid={`revoke-service-token-${token.id}`}
                                  >
                                    <Trash2 className="size-3" />
                                    <span className="ml-2">Revoke</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
};

export default ServiceTokens;
