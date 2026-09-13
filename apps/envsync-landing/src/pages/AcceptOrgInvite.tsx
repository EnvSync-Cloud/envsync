import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { runtimeConfig } from "@/utils/runtime-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, ArrowRight, Shield, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
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

const AcceptOrgInvite = () => {
  const { invite_code } = useParams();
  const [orgName, setOrgName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [website, setWebsite] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullNameError, setFullNameError] = useState("");

  // Ensure invite_code is defined
  if (!invite_code || typeof invite_code !== "string") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Invalid or missing invite code.</div>
      </div>
    );
  }

  // check if the invite code is valid
  const { data: inviteData, isLoading: isInviteLoading, isError: isInviteError } = useQuery({
    queryKey: ["checkInviteCode", invite_code],
    queryFn: async () => {
      return api.onboarding.getOrgInviteByCode(invite_code);
    },
    retry: false,
    enabled: !!invite_code
  });

  const acceptOrgInviteMutation = useMutation({
    mutationFn: async (data: {
      invite_code: string;
      org_data: {
        name: string;
        size: string;
        website: string;
      };
      user_data: {
        full_name: string;
        password: string;
      };
    }) => {
      // Call the API with the invite_code as the main parameter and other data as body
      return api.onboarding.acceptOrgInvite(data.invite_code, {
        org_data: data.org_data,
        user_data: data.user_data
      });
    },
    onSuccess: (data) => {
      console.log("Organization invite accepted successfully:", data);
      trackAction("org_signup_completed", {
        "envsync.event_name": "org_signup_completed",
        "envsync.event_category": "onboarding",
        "envsync.surface": "landing",
        "envsync.success": true,
        org_name: orgName,
        company_size: companySize,
        has_website: Boolean(website),
      });
      trackAction("org_onboarding_completed", {
        "envsync.event_name": "org_onboarding_completed",
        "envsync.event_category": "onboarding",
        "envsync.surface": "landing",
        "envsync.success": true,
        org_name: orgName,
        user_email_domain: inviteData?.invite?.email?.split("@")[1] || undefined,
      });
    },
    onError: (error) => {
      console.error("Failed to accept organization invite:", error);
    }
  });
  const generatedBundle = (acceptOrgInviteMutation.data as {
    generated_certificate_bundle?: {
      root_ca_pem: string;
      member_cert_pem: string;
      member_key_pem: string;
    };
  } | undefined)?.generated_certificate_bundle;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate full name
    const nameWords = fullName.trim().split(/\s+/);
    if (nameWords.length < 2) {
      setFullNameError("Please enter both first and last name");
      return;
    }
    setFullNameError("");
    
    if (invite_code && orgName && companySize && website && fullName && password && !acceptOrgInviteMutation.isPending) {
      trackAction("org_signup_started", {
        "envsync.event_name": "org_signup_started",
        "envsync.event_category": "onboarding",
        "envsync.surface": "landing",
        "envsync.success": true,
        invite_code_present: Boolean(invite_code),
        company_size: companySize,
        has_website: Boolean(website),
      });
      acceptOrgInviteMutation.mutate({
        invite_code,
        org_data: {
          name: orgName,
          size: companySize,
          website,
        },
        user_data: {
          full_name: fullName,
          password
        }
      });
    }
  };

  const companySizes = [
    "1-10 employees",
    "11-50 employees",
    "51-200 employees",
    "201-500 employees",
    "501-1000 employees",
    "1000+ employees"
  ];

  if (isInviteLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (isInviteError || !inviteData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">Invalid or expired invite code.</div>
      </div>
    );
  }

  if (inviteData.invite.is_accepted) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-lg">This invite code has already been used or is invalid.</div>
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
            {!acceptOrgInviteMutation.isSuccess ? (
              <Card className="bg-slate-800 border-slate-700 shadow-xl shadow-black/20">
                <CardHeader className="text-center">
                  <div className="w-12 h-12 bg-emerald-600/20 p-3 rounded-lg mx-auto mb-4">
                    <Shield className="h-6 w-6 text-emerald-400" />
                  </div>
                  <CardTitle className="text-white text-2xl">Complete Organization Setup</CardTitle>
                  <CardDescription className="text-slate-300">
                    Set up your organization and create your account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="orgName" className="text-slate-300">Organization Name *</Label>
                      <Input
                        id="orgName"
                        type="text"
                        placeholder="Your Company Name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        required
                        disabled={acceptOrgInviteMutation.isPending}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <Label htmlFor="companySize" className="text-slate-300">Company Size *</Label>
                      <Select value={companySize} onValueChange={setCompanySize} disabled={acceptOrgInviteMutation.isPending}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white focus:border-emerald-500">
                          <SelectValue placeholder="Select company size" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {companySizes.map((size) => (
                            <SelectItem key={size} value={size} className="text-white hover:bg-slate-600">
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="website" className="text-slate-300">Website *</Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://yourcompany.com"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        required
                        disabled={acceptOrgInviteMutation.isPending}
                        className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <Label htmlFor="fullName" className="text-slate-300">Full Name *</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (fullNameError) setFullNameError("");
                        }}
                        required
                        disabled={acceptOrgInviteMutation.isPending}
                        className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-emerald-500 ${
                          fullNameError ? 'border-red-500 focus:border-red-500' : ''
                        }`}
                      />
                      {fullNameError && (
                        <p className="text-red-400 text-sm mt-1">{fullNameError}</p>
                      )}
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
                          disabled={acceptOrgInviteMutation.isPending}
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
                    
                    {acceptOrgInviteMutation.isError && (
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <span>{getErrorMessage(acceptOrgInviteMutation.error)}</span>
                      </div>
                    )}
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      size="lg"
                      disabled={acceptOrgInviteMutation.isPending || !orgName || !companySize || !website || !fullName || !password}
                    >
                      {acceptOrgInviteMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Setting up...
                        </>
                      ) : (
                        <>
                          Complete Setup
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-800 border-slate-700">
                <CardContent className="pt-8 space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Organization Setup Complete!</h3>
                    <p className="text-slate-300 mb-6">
                      Your organization <span className="text-emerald-400">{orgName}</span> has been successfully created.
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
                    Get Started
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

export default AcceptOrgInvite;
