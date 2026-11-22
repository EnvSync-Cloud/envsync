import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { ApiRequestError, sdk } from "@/api/base";
import type { ServiceToken } from "@/api/service-tokens.api";
import { PageShell } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PageError } from "@/components/ui/page-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Active"
      ? "border-border font-normal text-accent-ink"
      : status === "Rotating"
        ? "border-border font-normal text-amber-200"
        : "border-border font-normal text-muted-foreground";
  return (
    <Badge variant="outline" className={className}>
      {status}
    </Badge>
  );
}

function isForbiddenError(error: unknown) {
  return error instanceof ApiRequestError && error.status === 403;
}

export const ServiceTokens = () => {
  const { appId } = useParams();
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const authEnabled = !isAuthLoading && isAuthenticated && Boolean(appId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingRotate, setPendingRotate] = useState<ServiceToken | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ServiceToken | null>(null);
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
      return (app.env_types ?? []).map((envType) => ({ id: envType.id, name: envType.name }));
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
      setPendingRotate(token);
    },
    [actionLoading, canManage, rotateToken],
  );

  const handleRevoke = useCallback(
    (token: ServiceToken) => {
      if (!canManage || actionLoading[token.id] || deleteToken.isPending) return;
      setPendingRevoke(token);
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
      <PageShell
        title="Service tokens"
        description="Project tokens for CI and other machines. Each token is limited to the environments and paths you set."
        secondaryNav={appId ? <ProjectSettingsTabs appId={appId} active="tokens" /> : null}
        stats={
          !isForbidden && tokens.length > 0
            ? [{ label: tokens.length === 1 ? "token" : "tokens", value: tokens.length }]
            : undefined
        }
        actions={
          canManage ? (
            <Button
              onClick={() => setIsCreateOpen(true)}
              disabled={createToken.isPending}
              data-testid="create-service-token"
            >
              <Plus className="size-4" />
              Create token
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

        {isPageLoading ? (
          <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />
        ) : isForbidden ? (
          <p className="text-sm text-muted-foreground" data-testid="service-tokens-forbidden">
            Service tokens require the manage API keys permission.
          </p>
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground">
            No service tokens. Create one so CI can read or write this project&apos;s secrets.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const status = tokenStatus(token);
                  const busy = Boolean(actionLoading[token.id]);
                  return (
                    <TableRow
                      key={token.id}
                      className="border-border"
                      data-testid={`service-token-row-${token.id}`}
                    >
                      <TableCell>
                        <span className="block font-medium text-foreground">{token.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{token.id}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(token.scopes ?? []).map((scope, index) => (
                            <Badge
                              key={`${token.id}-scope-${index}`}
                              variant="outline"
                              className="border-border font-normal"
                            >
                              {scope.env_type_id
                                ? environmentNameById.get(scope.env_type_id) ?? "Environment"
                                : "All environments"}
                              {` ${scope.path || "/"}`}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {accessLabel(token)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(token.expires_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatLastUsed(token.last_used_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRotate(token)}
                            disabled={busy || Boolean(token.grace_until)}
                            title="Rotate service token"
                            data-testid={`rotate-service-token-${token.id}`}
                          >
                            <RefreshCw className="size-3" />
                            Rotate
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevoke(token)}
                            disabled={busy}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Revoke service token"
                            data-testid={`revoke-service-token-${token.id}`}
                          >
                            <Trash2 className="size-3" />
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={Boolean(pendingRotate)} onOpenChange={(open) => !open && setPendingRotate(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rotate service token?</AlertDialogTitle>
              <AlertDialogDescription>
                The previous value stays valid for 24 hours. You will see the new token once.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-rotate-service-token"
                onClick={() => {
                  if (pendingRotate) rotateToken.mutate({ id: pendingRotate.id, grace_hours: 24 });
                  setPendingRotate(null);
                }}
              >
                Rotate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(open) => !open && setPendingRevoke(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke service token?</AlertDialogTitle>
              <AlertDialogDescription>
                Clients using this token lose access immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                data-testid="confirm-revoke-service-token"
                onClick={() => {
                  if (pendingRevoke) deleteToken.mutate(pendingRevoke.id);
                  setPendingRevoke(null);
                }}
              >
                Revoke
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
  );
};

export default ServiceTokens;
