import { useState, useCallback } from "react";
import {
  ShieldCheck,
  Plus,
  Ban,
  Loader2,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const Certificates = () => {
  const { data: certificates, isLoading } = api.certificates.getCertificates();
  const { data: orgCA } = api.certificates.getOrgCA();
  const { data: users = [] } = api.users.getAllUsers();

  // Init CA dialog
  const [isInitCAOpen, setIsInitCAOpen] = useState(false);
  const [caOrgName, setCAOrgName] = useState("");
  const [caDescription, setCADescription] = useState("");

  // Issue cert dialog
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issueEmail, setIssueEmail] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueMetadata, setIssueMetadata] = useState<{key: string, value: string}[]>([]);
  const [issuedCert, setIssuedCert] = useState<{ cert_pem: string; key_pem: string } | null>(null);

  // Revoke dialog
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [revokeSerial, setRevokeSerial] = useState("");
  const [revokeReason, setRevokeReason] = useState(0);

  // Mutations
  const initCA = api.certificates.initOrgCA({
    onSuccess: () => {
      toast.success("Organization CA initialized successfully");
      setIsInitCAOpen(false);
      setCAOrgName("");
      setCADescription("");
    },
    onError: ({ error }) => toast.error(error.message || "Failed to initialize CA"),
  });

  const issueCert = api.certificates.issueMemberCert({
    onSuccess: ({ data }) => {
      toast.success("Member certificate issued successfully");
      setIssuedCert({ cert_pem: data.cert_pem || "", key_pem: data.key_pem || "" });
    },
    onError: ({ error }) => toast.error(error.message || "Failed to issue certificate"),
  });

  const revokeCert = api.certificates.revokeCert({
    onSuccess: () => {
      toast.success("Certificate revoked");
      setIsRevokeOpen(false);
      setRevokeSerial("");
    },
    onError: ({ error }) => toast.error(error.message || "Failed to revoke certificate"),
  });
  const renewCert = api.certificates.renewCert({
    onSuccess: ({ data }) => {
      toast.success("Certificate renewed");
      setIssuedCert({ cert_pem: data.cert_pem || "", key_pem: data.key_pem || "" });
      setIsIssueOpen(true);
    },
    onError: ({ error }) => toast.error(error.message || "Failed to renew certificate"),
  });
  const rotateCert = api.certificates.rotateCert({
    onSuccess: ({ data }) => {
      toast.success("Certificate rotated");
      setIssuedCert({ cert_pem: data.cert_pem || "", key_pem: data.key_pem || "" });
      setIsIssueOpen(true);
    },
    onError: ({ error }) => toast.error(error.message || "Failed to rotate certificate"),
  });

  const handleInitCA = useCallback(() => {
    if (!caOrgName) return;
    initCA.mutate({ org_name: caOrgName, description: caDescription || undefined });
  }, [caOrgName, caDescription, initCA]);

  const handleIssue = useCallback(() => {
    if (!issueEmail) return;
    const metadataObj = issueMetadata.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);
    issueCert.mutate({
      member_email: issueEmail,
      role: "member",
      description: issueDescription || undefined,
      metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
    });
  }, [issueEmail, issueDescription, issueMetadata, issueCert]);

  const handleRevoke = useCallback(() => {
    if (!revokeSerial) return;
    revokeCert.mutate({ serialHex: revokeSerial, reason: revokeReason });
  }, [revokeSerial, revokeReason, revokeCert]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-600">Active</Badge>;
      case "revoked":
        return <Badge variant="destructive">Revoked</Badge>;
      case "expired":
        return <Badge className="bg-yellow-600">Expired</Badge>;
      case "superseded":
        return <Badge className="bg-blue-600">Superseded</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "org_ca"
      ? <Badge className="bg-blue-600">CA</Badge>
      : <Badge variant="outline" className="border-border text-muted-foreground">Member</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCA = orgCA && !("error" in orgCA);
  const certificateRows = certificates || [];
  const activeCertificates = certificateRows.filter((cert) => cert.status === "active").length;
  const revokedCertificates = certificateRows.filter((cert) => cert.status === "revoked").length;
  const memberCertificates = certificateRows.filter((cert) => cert.cert_type !== "org_ca").length;

  return (
    <div className="animate-page-enter space-y-6">
      <PageShell
        title="Certificates"
        description="Operate the organization CA and member certificate lifecycle from a clearer, trust-focused surface."
        icon={ShieldCheck}
        stats={[
          { label: "Active", value: activeCertificates, hint: "Currently valid certificates", tone: activeCertificates > 0 ? "success" : "default" },
          { label: "Revoked", value: revokedCertificates, hint: "Certificates taken out of service", tone: revokedCertificates > 0 ? "warning" : "default" },
          { label: "Member Certs", value: memberCertificates, hint: "User-scoped certificates issued" },
        ]}
        actions={<div className="flex gap-2">
          {hasCA && (
            <Dialog open={isIssueOpen} onOpenChange={(open) => { setIsIssueOpen(open); if (!open) setIssuedCert(null); }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600" data-testid="certificate-issue-button">
                  <Plus className="w-4 h-4 mr-2" /> Issue Certificate
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-muted border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Issue Member Certificate</DialogTitle>
                  <DialogDescription className="text-muted-foreground">Issue a new certificate signed by the org CA</DialogDescription>
                </DialogHeader>
                {!issuedCert ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Member Email</Label>
                      <Input
                        list="certificate-user-emails"
                        value={issueEmail}
                        onChange={(e) => setIssueEmail(e.target.value)}
                        className="bg-muted border-border text-foreground"
                        placeholder="user@example.com"
                      />
                      <datalist id="certificate-user-emails">
                        {users.map((user) => (
                          <option key={user.id} value={user.email}>
                            {user.full_name || user.email}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <p className="text-xs text-tertiary mt-1">
                        Certificates can only be issued to existing organization users. Their current org role is resolved automatically by the backend.
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <Input value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} className="bg-muted border-border text-foreground" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Metadata (optional)</Label>
                      <div className="space-y-2 mt-1">
                        {issueMetadata.map((entry, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={entry.key}
                              onChange={(e) => {
                                const updated = [...issueMetadata];
                                updated[idx].key = e.target.value;
                                setIssueMetadata(updated);
                              }}
                              className="bg-muted border-border text-foreground flex-1"
                              placeholder="Key"
                            />
                            <Input
                              value={entry.value}
                              onChange={(e) => {
                                const updated = [...issueMetadata];
                                updated[idx].value = e.target.value;
                                setIssueMetadata(updated);
                              }}
                              className="bg-muted border-border text-foreground flex-1"
                              placeholder="Value"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 px-2"
                              onClick={() => setIssueMetadata(issueMetadata.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-muted-foreground hover:bg-muted"
                          onClick={() => setIssueMetadata([...issueMetadata, { key: "", value: "" }])}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add metadata
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Certificate issued successfully</span>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Certificate PEM</Label>
                      <Textarea value={issuedCert.cert_pem} readOnly className="bg-card border-border text-green-400 min-h-[80px] font-mono text-xs" />
                      <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => { navigator.clipboard.writeText(issuedCert.cert_pem); toast.success("Copied!"); }}>
                        <Copy className="w-3 h-3 mr-1" /> Copy Certificate
                      </Button>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Private Key PEM</Label>
                      <Textarea value={issuedCert.key_pem} readOnly className="bg-card border-border text-yellow-400 min-h-[80px] font-mono text-xs" />
                      <Button variant="ghost" size="sm" className="mt-1 text-muted-foreground" onClick={() => { navigator.clipboard.writeText(issuedCert.key_pem); toast.success("Copied!"); }}>
                        <Copy className="w-3 h-3 mr-1" /> Copy Key
                      </Button>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-900/30 border border-yellow-700">
                      <div className="flex items-center gap-2 text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Save the private key now. It cannot be retrieved later.
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  {!issuedCert ? (
                    <Button onClick={handleIssue} disabled={issueCert.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                      {issueCert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Issue
                    </Button>
                  ) : (
                    <Button onClick={() => { setIsIssueOpen(false); setIssuedCert(null); setIssueEmail(""); setIssueDescription(""); setIssueMetadata([]); }} variant="outline" className="border-border text-muted-foreground">
                      Done
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>}
      >

      {/* CA Status Card */}
      <Card className="bg-card text-card-foreground bg-gradient-to-br from-card to-card border-border/80 shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-emerald-400" />
            Organization CA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasCA ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-foreground font-medium">{orgCA.subject_cn}</span>
                  {getStatusBadge(orgCA.status)}
                </div>
                <p className="text-tertiary text-sm mt-1">
                  Serial: <code className="text-muted-foreground font-mono">{orgCA.serial_hex}</code>
                  {" | "}
                  Created: {new Date(orgCA.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">Organization CA not initialized</p>
              <Dialog open={isInitCAOpen} onOpenChange={setIsInitCAOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-500 hover:bg-emerald-600">
                    Initialize CA
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-muted border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Initialize Organization CA</DialogTitle>
                    <DialogDescription className="text-muted-foreground">Create an intermediate CA for your organization</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Organization Name</Label>
                      <Input value={caOrgName} onChange={(e) => setCAOrgName(e.target.value)} className="bg-muted border-border text-foreground" placeholder="My Organization" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <Input value={caDescription} onChange={(e) => setCADescription(e.target.value)} className="bg-muted border-border text-foreground" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleInitCA} disabled={initCA.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                      {initCA.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Initialize
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certificates Table */}
      <Card className="bg-card text-card-foreground bg-gradient-to-br from-card to-card border-border/80 shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            Certificates
            {certificates && certificates.length > 0 && (
              <Badge variant="secondary" className="ml-2">{certificates.length}</Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            System-generated EnvSync certificates are not listed here. Use Account Settings → My Certificates to view your managed bundle.
          </p>
        </CardHeader>
        <CardContent>
          {!certificates || certificates.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No certificates issued yet</p>
              <p className="text-tertiary text-sm mt-1">
                {hasCA ? "Issue a member certificate to get started" : "Initialize the org CA first"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Subject</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Type</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Serial</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Status</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Issued</th>
                    <th className="text-right text-muted-foreground text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-foreground font-medium">{cert.subject_cn}</div>
                        {cert.subject_email && (
                          <div className="text-tertiary text-xs">{cert.subject_email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{getTypeBadge(cert.cert_type)}</td>
                      <td className="py-3 px-4">
                        <code className="text-muted-foreground text-xs bg-card px-2 py-1 rounded font-mono">
                          {cert.serial_hex}
                        </code>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(cert.status)}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {new Date(cert.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          {cert.status === "active" && cert.cert_type !== "org_ca" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300"
                              data-testid="certificate-renew-button"
                              onClick={() => renewCert.mutate({ id: cert.id, revoke_previous: true })}
                              title="Renew"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {cert.status === "active" && cert.cert_type !== "org_ca" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cyan-400 hover:text-cyan-300"
                              data-testid="certificate-rotate-button"
                              onClick={() => rotateCert.mutate({ id: cert.id, revoke_previous: true, reason: 4 })}
                              title="Rotate"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                          )}
                          {cert.status === "active" && cert.cert_type !== "org_ca" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              data-testid="certificate-revoke-button"
                              onClick={() => {
                                setRevokeSerial(cert.serial_hex);
                                setIsRevokeOpen(true);
                              }}
                              title="Revoke"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Dialog */}
      <Dialog open={isRevokeOpen} onOpenChange={setIsRevokeOpen}>
        <DialogContent className="bg-muted border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Revoke Certificate</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action cannot be undone. Serial: <code className="font-mono">{revokeSerial}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Reason Code (RFC 5280)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={revokeReason}
                onChange={(e) => setRevokeReason(parseInt(e.target.value) || 0)}
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-tertiary mt-1">0=unspecified, 1=keyCompromise, 3=affiliationChanged, 4=superseded, 5=cessationOfOperation</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeOpen(false)} className="border-border text-muted-foreground">Cancel</Button>
            <Button onClick={handleRevoke} disabled={revokeCert.isPending} variant="destructive">
              {revokeCert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </PageShell>
    </div>
  );
};

export default Certificates;
