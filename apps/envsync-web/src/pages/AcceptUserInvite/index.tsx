import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle, Eye, EyeOff, Loader2, Users } from "lucide-react";

import { getSDK } from "@/api/base";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runtimeConfig } from "@/utils/runtime-config";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "body" in error) {
    const body = (error as { body?: { error?: string; message?: string } }).body;
    if (body?.error) return body.error;
    if (body?.message) return body.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function copyToClipboard(value: string) {
  void navigator.clipboard.writeText(value);
}

function downloadText(filename: string, value: string) {
  const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Public user-invite accept flow (standalone layout).
 * Self-host emails point here; Hosted may still use landing with the same path.
 */
const AcceptUserInvitePage = () => {
  const { invite_code } = useParams();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const sdk = useMemo(() => getSDK(), []);

  const inviteQuery = useQuery({
    queryKey: ["accept-user-invite", invite_code],
    queryFn: () => sdk.onboarding.getUserInviteByCode(invite_code!),
    enabled: Boolean(invite_code),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      return sdk.onboarding.acceptUserInvite(invite_code!, {
        full_name: fullName,
        password,
      });
    },
  });

  const generatedBundle = (
    acceptMutation.data as {
      generated_certificate_bundle?: {
        root_ca_pem: string;
        member_cert_pem: string;
        member_key_pem: string;
      };
    } | undefined
  )?.generated_certificate_bundle;

  if (!invite_code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-destructive">Invalid invite code</p>
      </div>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data?.invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <p className="text-destructive">Invalid or expired invite code</p>
      </div>
    );
  }

  if (inviteQuery.data.invite.is_accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border">
          <CardHeader>
            <CardTitle>Invite already used</CardTitle>
            <CardDescription>This invite has already been accepted. Sign in to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        {!acceptMutation.isSuccess ? (
          <Card className="border-border shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Join the team</CardTitle>
              <CardDescription>
                Complete your account setup to join{" "}
                <span className="font-medium text-foreground">
                  {inviteQuery.data.invite.email}
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!fullName || !password || acceptMutation.isPending) return;
                  acceptMutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={acceptMutation.isPending}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={acceptMutation.isPending}
                      placeholder="Create a strong password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {acceptMutation.isError && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{getErrorMessage(acceptMutation.error)}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={acceptMutation.isPending || !fullName || !password}
                >
                  {acceptMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Joining…
                    </>
                  ) : (
                    <>
                      Join organization
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-lg">
            <CardContent className="space-y-6 pt-8">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle className="size-7" />
                </div>
                <h2 className="text-2xl font-semibold text-foreground">Welcome to the team</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your account is ready. Sign in to start working.
                </p>
              </div>

              {generatedBundle && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    System-generated certificates (also available later under Account → Certificates).
                  </p>
                  {(
                    [
                      ["Root CA PEM", generatedBundle.root_ca_pem, "envsync-root-ca.pem"],
                      ["Member Certificate PEM", generatedBundle.member_cert_pem, "envsync-member-cert.pem"],
                      ["Private Key PEM", generatedBundle.member_key_pem, "envsync-member-key.pem"],
                    ] as const
                  ).map(([label, value, filename]) => (
                    <div key={label} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{label}</p>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => copyToClipboard(value)}>
                            Copy
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => downloadText(filename, value)}>
                            Download
                          </Button>
                        </div>
                      </div>
                      <textarea
                        readOnly
                        value={value}
                        className="min-h-[100px] w-full rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => {
                  window.location.href = runtimeConfig.appBaseUrl || "/";
                }}
              >
                Go to dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AcceptUserInvitePage;
