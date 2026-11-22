import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MfaEnrollment } from "@/api/account.api";

interface TwoFactorCardProps {
  enabled: boolean;
  enrollment: MfaEnrollment | null;
  code: string;
  error?: string;
  isWorking: boolean;
  onCode: (value: string) => void;
  onSetup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  disablePassword: string;
  onDisablePassword: (value: string) => void;
  onDisable: () => void;
}

export const TwoFactorCard = ({
  enabled,
  enrollment,
  code,
  error,
  isWorking,
  onCode,
  onSetup,
  onConfirm,
  onCancel,
  disablePassword,
  onDisablePassword,
  onDisable,
}: TwoFactorCardProps) => {
  return (
    <Card className="rounded-xl border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-foreground">Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Add a code from an authenticator app. Sign-in asks for that code when the server requires
          two-factor authentication.
        </p>
        {enabled ? (
          <div className="max-w-xs space-y-3">
            <div className="space-y-2">
              <Label htmlFor="mfa-disable-password">Current password</Label>
              <Input
                id="mfa-disable-password"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(event) => onDisablePassword(event.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button variant="outline" onClick={onDisable} disabled={isWorking || disablePassword.length === 0}>
              {isWorking ? "Turning off..." : "Turn off authenticator"}
            </Button>
          </div>
        ) : enrollment ? (
          <div className="space-y-4">
            {enrollment.qr_image ? (
              <img
                src={enrollment.qr_image}
                alt="Authenticator QR code"
                className="h-40 w-40 rounded-md border border-border bg-white p-2"
              />
            ) : null}
            <p className="text-sm text-muted-foreground">
              Or enter this secret: <code className="text-foreground">{enrollment.secret}</code>
            </p>
            <div className="max-w-xs space-y-2">
              <Label htmlFor="mfa-code">Code from the app</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => onCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex gap-2">
              <Button onClick={onConfirm} disabled={isWorking || code.length < 6}>
                {isWorking ? "Checking..." : "Confirm"}
              </Button>
              <Button variant="outline" onClick={onCancel} disabled={isWorking}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button variant="outline" onClick={onSetup} disabled={isWorking}>
              {isWorking ? "Starting..." : "Set up two-factor authentication"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
