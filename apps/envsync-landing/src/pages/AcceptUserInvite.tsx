import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { runtimeConfig } from "@/utils/runtime-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, ArrowRight, Users, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/helpers/api";
import { trackAction } from "@/telemetry";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "body" in error) {
    const body = (error as { body?: { error?: string } }).body;
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function copyToClipboard(value: string) {
  navigator.clipboard.writeText(value);
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

const AcceptUserInvite = () => {
  const { invite_code } = useParams();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!invite_code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-lg">Invalid invite code</div>
      </div>
    );
  }

  // Check if the invite code is valid
  const { data: inviteData, isLoading: isInviteLoading, isError: isInviteError } = useQuery({
    queryKey: ["checkInviteCode", invite_code],
    queryFn: async () => {
      return api.onboarding.getUserInviteByCode(invite_code);
    },
    enabled: !!invite_code,
    retry: false,
  });

  const acceptUserInviteMutation = useMutation({
    mutationFn: async (data: {
      invite_code: string;
      full_name: string;
      password: string;
    }) => {
      // Call the API with the invite_code as the main parameter and other data as body
      return api.onboarding.acceptUserInvite(data.invite_code, {
        full_name: data.full_name,
        password: data.password
      });
    },
    onSuccess: (data) => {
      console.log("User invite accepted successfully:", data);
      trackAction("user_invite_accept_completed", {
        "envsync.event_name": "user_invite_accept_completed",
        "envsync.event_category": "onboarding",
        "envsync.surface": "landing",
        "envsync.success": true,
        invite_email_domain: inviteData?.invite?.email?.split("@")[1] || undefined,
      });
    },
    onError: (error) => {
      console.error("Failed to accept user invite:", error);
    }
  });
  const generatedBundle = (acceptUserInviteMutation.data as {
    generated_certificate_bundle?: {
      root_ca_pem: string;
      member_cert_pem: string;
      member_key_pem: string;
    };
  } | undefined)?.generated_certificate_bundle;
  const accountExists = Boolean(inviteData?.invite?.account_exists);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invite_code && (accountExists || (fullName && password)) && !acceptUserInviteMutation.isPending) {
      trackAction("user_invite_accept_started", {
        "envsync.event_name": "user_invite_accept_started",
        "envsync.event_category": "onboarding",
        "envsync.surface": "landing",
        "envsync.success": true,
        invite_code_present: Boolean(invite_code),
      });
      acceptUserInviteMutation.mutate({
        invite_code,
        full_name: accountExists ? undefined : fullName,
        password: accountExists ? undefined : password,
      });
    }
  };

  if (isInviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (isInviteError || !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-red-400 text-lg">Invalid or expired invite code</div>
      </div>
    );
  }

  if (inviteData.invite.is_accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-red-400 text-lg">This invite code has already been used.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Header />
      
      <section className="pt-24 pb-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:40px_40px]" />
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            {!acceptUserInviteMutation.isSuccess ? (
              <Card className="bg-slate-800 border-slate-700 shadow-xl shadow-black/20">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-emerald-600/20 p-3 rounded-lg mx-auto mb-4">
                    <Users className="h-6 w-6 text-emerald-400" />
                  </div>
                  <CardTitle className="text-white text-2xl">Join the Team</CardTitle>
                  <CardDescription className="text-slate-300">
                    {accountExists
                      ? "You already have an EnvSync account. Join this organization with the same login."
                      : "Complete your account setup to join your organization"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!accountExists ? (
                      <>
                    <div>
                      <Label htmlFor="fullName" className="text-slate-300">Full Name *</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        disabled={acceptUserInviteMutation.isPending}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <Label htmlFor="password" className="text-slate-300">Password *</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a strong password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={acceptUserInviteMutation.isPending}
                          className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500 pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                      </>
                    ) : null}

                    {acceptUserInviteMutation.isError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{getErrorMessage(acceptUserInviteMutation.error)}</span>
                      </div>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      size="lg"
                      disabled={acceptUserInviteMutation.isPending || (!accountExists && (!fullName || !password))}
                    >
                      {acceptUserInviteMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          Join Organization
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </form>
                  <p className="text-sm text-slate-400 text-center mt-4">
                    {accountExists
                      ? "After joining, sign in with your existing EnvSync credentials."
                      : "You're joining an existing organization"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-8 space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Welcome to the Team!</h3>
                    <p className="text-slate-300 mb-6">
                      Your account has been successfully created. You're now part of the organization.
                    </p>
                  </div>
                  {generatedBundle && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
                        These are system-generated EnvSync certificates. They remain available later under Account Settings → My Certificates.
                      </div>
                      {[
                        ["Root CA PEM", generatedBundle.root_ca_pem, "envsync-root-ca.pem"],
                        ["Member Certificate PEM", generatedBundle.member_cert_pem, "envsync-member-cert.pem"],
                        ["Private Key PEM", generatedBundle.member_key_pem, "envsync-member-key.pem"],
                      ].map(([label, value, filename]) => (
                        <div key={label} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white">{label}</p>
                            <div className="flex gap-2">
                              <Button variant="outline" className="border-slate-600 text-slate-200" onClick={() => copyToClipboard(String(value))}>
                                Copy
                              </Button>
                              <Button variant="outline" className="border-slate-600 text-slate-200" onClick={() => downloadText(String(filename), String(value))}>
                                Download
                              </Button>
                            </div>
                          </div>
                          <textarea
                            readOnly
                            value={String(value)}
                            className="min-h-[120px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <Button 
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.location.href = runtimeConfig.appBaseUrl}
                  >
                    Start Working
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AcceptUserInvite;
