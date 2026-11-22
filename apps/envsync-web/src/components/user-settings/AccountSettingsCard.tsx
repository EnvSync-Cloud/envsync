import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountSettingsCardProps {
  hasPassword: boolean;
  password: string;
  confirm: string;
  error?: string;
  onPassword: (value: string) => void;
  onConfirm: (value: string) => void;
  onSetPassword: () => void;
  onResetPassword: () => void;
  isSetting: boolean;
  isResetting: boolean;
}

function SecretInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export const AccountSettingsCard = ({
  hasPassword,
  password,
  confirm,
  error,
  onPassword,
  onConfirm,
  onSetPassword,
  onResetPassword,
  isSetting,
  isResetting,
}: AccountSettingsCardProps) => {
  return (
    <Card className="rounded-xl border-border bg-card text-card-foreground">
      <CardHeader>
        <CardTitle className="text-foreground">{hasPassword ? "Password" : "Set password"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPassword ? (
          <>
            <p className="text-sm text-muted-foreground">
              A reset link goes to your email. The current password stays until you open that link.
            </p>
            <Button variant="outline" onClick={onResetPassword} disabled={isResetting}>
              {isResetting ? "Sending..." : "Email reset link"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This account signs in without a password. Set one to use the password field on the sign-in page.
            </p>
            <SecretInput
              id="new-password"
              label="Password"
              value={password}
              onChange={onPassword}
              autoComplete="new-password"
            />
            <SecretInput
              id="confirm-password"
              label="Confirm password"
              value={confirm}
              onChange={onConfirm}
              autoComplete="new-password"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button onClick={onSetPassword} disabled={isSetting || password.length < 8 || password !== confirm}>
              {isSetting ? "Saving..." : "Set password"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
