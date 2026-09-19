import { useState } from "react";
import type { LogForwardingResponse } from "@envsync-cloud/envsync-ts-sdk";
import { CreateLogForwardingRequest } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Plus, RefreshCw, ScrollText, Trash2 } from "lucide-react";

import { isEnterpriseUiEnabled } from "../api/client";
import {
  useCreateLogForwardingConfig,
  useDeleteLogForwardingConfig,
  useLogForwardingConfigs,
} from "../api/ee-workloads";
import { EnterpriseDeleteDialog } from "../components/EnterpriseDeleteDialog";
import { EnterprisePageFrame } from "../components/EnterprisePageFrame";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

type ProviderType = CreateLogForwardingRequest.provider_type;

/**
 * Audit log forwarding destinations.
 * Route: /organisation/log-forwarding
 */
export default function OrgLogForwarding() {
  const enabled = isEnterpriseUiEnabled();
  const { data: configs = [], isLoading, isError, error, refetch, isFetching } = useLogForwardingConfigs();
  const createConfig = useCreateLogForwardingConfig();
  const deleteConfig = useDeleteLogForwardingConfig();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LogForwardingResponse | null>(null);
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>(
    CreateLogForwardingRequest.provider_type.DATADOG,
  );
  const [apiKey, setApiKey] = useState("");
  const [site, setSite] = useState("datadoghq.com");
  const [token, setToken] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [sumoUrl, setSumoUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fluentTag, setFluentTag] = useState("envsync.audit");
  const [authorization, setAuthorization] = useState("");

  const resetForm = () => {
    setName("");
    setProviderType(CreateLogForwardingRequest.provider_type.DATADOG);
    setApiKey("");
    setSite("datadoghq.com");
    setToken("");
    setEndpoint("");
    setSumoUrl("");
    setUsername("");
    setPassword("");
    setFluentTag("envsync.audit");
    setAuthorization("");
  };

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    const config =
      providerType === CreateLogForwardingRequest.provider_type.DATADOG
        ? { api_key: apiKey, site }
        : providerType === CreateLogForwardingRequest.provider_type.SPLUNK
          ? { token, endpoint }
          : providerType === CreateLogForwardingRequest.provider_type.SUMO_LOGIC
            ? { url: sumoUrl }
            : providerType === CreateLogForwardingRequest.provider_type.LOGSTASH
              ? { endpoint, ...(username ? { username } : {}), ...(password ? { password } : {}) }
              : providerType === CreateLogForwardingRequest.provider_type.FLUENTD
                ? { endpoint, tag: fluentTag }
                : { endpoint, ...(authorization ? { authorization } : {}) };
    try {
      await createConfig.mutateAsync({
        name: name.trim(),
        provider_type: providerType,
        config,
        enabled: true,
      });
      toast.success("Log forwarding destination created.");
      setSheetOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create destination.");
    }
  };

  return (
    <EnterprisePageFrame
      title="Log forwarding"
      description="Send audit events to Datadog, Splunk, Sumo Logic, Logstash, Fluentd, or OTLP. Credentials are write-only after create."
      icon={<ScrollText className="size-7" />}
      enabled={enabled}
      isError={isError}
      error={error}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setSheetOpen(true)} data-testid="create-log-forwarding">
            <Plus className="size-4" />
            Add destination
          </Button>
        </div>
      }
    >

      <div className="space-y-3">
        {configs.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No forwarding destinations yet.</p>
        ) : (
          configs.map((item) => (
            <article
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card/60 p-4"
              data-testid={`log-forwarding-${item.id}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-foreground">{item.name}</h2>
                  <Badge variant="outline">{item.provider_type}</Badge>
                  <Badge variant="outline">{item.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}>
                <Trash2 className="size-4" />
              </Button>
            </article>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add log destination</SheetTitle>
            <SheetDescription>Credentials are write-only after save.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lf-name">Name</Label>
              <Input id="lf-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lf-provider">Provider</Label>
              <select
                id="lf-provider"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={providerType}
                onChange={(event) => setProviderType(event.target.value as ProviderType)}
              >
                <option value="datadog">Datadog</option>
                <option value="splunk">Splunk</option>
                <option value="sumo-logic">Sumo Logic</option>
                <option value="logstash">Logstash</option>
                <option value="fluentd">Fluentd</option>
                <option value="otlp">OTLP</option>
              </select>
            </div>
            {providerType === CreateLogForwardingRequest.provider_type.DATADOG && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-apikey">API key</Label>
                  <Input id="lf-apikey" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-site">Site</Label>
                  <Input id="lf-site" value={site} onChange={(event) => setSite(event.target.value)} />
                </div>
              </>
            )}
            {providerType === CreateLogForwardingRequest.provider_type.SPLUNK && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-token">HEC token</Label>
                  <Input id="lf-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-endpoint">Endpoint</Label>
                  <Input id="lf-endpoint" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
                </div>
              </>
            )}
            {providerType === CreateLogForwardingRequest.provider_type.SUMO_LOGIC && (
              <div className="space-y-2">
                <Label htmlFor="lf-url">Collector URL</Label>
                <Input id="lf-url" value={sumoUrl} onChange={(event) => setSumoUrl(event.target.value)} />
              </div>
            )}
            {providerType === CreateLogForwardingRequest.provider_type.LOGSTASH && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-logstash-endpoint">HTTP input URL</Label>
                  <Input
                    id="lf-logstash-endpoint"
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder="https://logstash.example.com:8080"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-logstash-user">Username (optional)</Label>
                  <Input id="lf-logstash-user" value={username} onChange={(event) => setUsername(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-logstash-pass">Password (optional)</Label>
                  <Input
                    id="lf-logstash-pass"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </>
            )}
            {providerType === CreateLogForwardingRequest.provider_type.FLUENTD && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-fluentd-endpoint">HTTP input URL</Label>
                  <Input
                    id="lf-fluentd-endpoint"
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder="https://fluentd.example.com:8888"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-fluentd-tag">Tag</Label>
                  <Input id="lf-fluentd-tag" value={fluentTag} onChange={(event) => setFluentTag(event.target.value)} />
                </div>
              </>
            )}
            {providerType === CreateLogForwardingRequest.provider_type.OTLP && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lf-otlp-endpoint">OTLP HTTP endpoint</Label>
                  <Input
                    id="lf-otlp-endpoint"
                    value={endpoint}
                    onChange={(event) => setEndpoint(event.target.value)}
                    placeholder="https://collector.example.com:4318"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lf-otlp-auth">Authorization (optional)</Label>
                  <Input
                    id="lf-otlp-auth"
                    type="password"
                    value={authorization}
                    onChange={(event) => setAuthorization(event.target.value)}
                    placeholder="Bearer …"
                  />
                </div>
              </>
            )}
          </div>
          <SheetFooter>
            <Button onClick={() => void onCreate()} disabled={createConfig.isPending}>
              Create destination
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <EnterpriseDeleteDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name}?`}
        description="Audit events will stop going to this destination."
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteConfig.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Destination deleted.");
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
          });
        }}
      />
    </EnterprisePageFrame>
  );
}
