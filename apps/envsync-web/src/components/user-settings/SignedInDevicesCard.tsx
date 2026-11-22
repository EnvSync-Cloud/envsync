import { useEffect, useState } from "react";
import { MonitorSmartphone } from "lucide-react";

import { apiRequest, isReloginError, redirectToLogin } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthContext } from "@/contexts/auth";
import { deleteDeviceKey } from "@/lib/dpop-session";

type SessionDevice = {
  id: string;
  label: string;
  client_id: string;
  created_at: string;
  last_used_at: string;
  current: boolean;
};

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function SignedInDevicesCard() {
  const { user } = useAuthContext();
  const [devices, setDevices] = useState<SessionDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.auth_type !== "jwt") return;
    let cancelled = false;
    void apiRequest<{ devices: SessionDevice[] }>("/api/auth/sessions")
      .then((body) => {
        if (!cancelled) setDevices(body.devices);
      })
      .catch(async (cause: unknown) => {
        if (cancelled) return;
        if (isReloginError(cause)) {
          await redirectToLogin(cause);
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load signed-in devices.",
        );
        setDevices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const revoke = async (device: SessionDevice) => {
    setPendingId(device.id);
    setError(null);
    try {
      const result = await apiRequest<{ id: string; current: boolean }>(
        `/api/auth/sessions/${device.id}`,
        {
          method: "DELETE",
        },
      );
      if (result.current || device.current) {
        await deleteDeviceKey();
        window.location.assign("/login");
        return;
      }
      setDevices(
        (current) => current?.filter((item) => item.id !== device.id) ?? [],
      );
    } catch (cause) {
      if (isReloginError(cause)) {
        await redirectToLogin(cause);
        return;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not sign out that device.",
      );
    } finally {
      setPendingId(null);
    }
  };

  if (user && user.auth_type !== "jwt") return null;

  return (
    <Card
      className="border-border bg-card text-card-foreground rounded-xl"
      data-testid="signed-in-devices"
    >
      <CardHeader>
        <div className="flex items-center space-x-2">
          <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <CardTitle className="text-foreground">Signed-in devices</CardTitle>
            <CardDescription>
              Each browser and CLI session has its own key. Signing out rejects
              that key.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {devices === null && (
          <p className="text-sm text-muted-foreground">Loading devices…</p>
        )}
        {devices?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No signed-in devices yet.
          </p>
        )}
        {devices?.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-medium text-foreground">
                  {device.label}
                </h4>
                {device.current && (
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-accent-ink">
                    This device
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Last used {formatWhen(device.last_used_at)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              data-testid="revoke-device"
              disabled={pendingId === device.id}
              onClick={() => void revoke(device)}
            >
              {pendingId === device.id ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
