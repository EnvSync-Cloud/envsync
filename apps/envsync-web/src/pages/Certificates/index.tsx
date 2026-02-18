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
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
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

  // Init CA dialog
  const [isInitCAOpen, setIsInitCAOpen] = useState(false);
  const [caOrgName, setCAOrgName] = useState("");
  const [caDescription, setCADescription] = useState("");

  // Issue cert dialog
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issueEmail, setIssueEmail] = useState("");
  const [issueRole, setIssueRole] = useState("");
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

  const handleInitCA = useCallback(() => {
    if (!caOrgName) return;
    initCA.mutate({ org_name: caOrgName, description: caDescription || undefined });
  }, [caOrgName, caDescription, initCA]);

  const handleIssue = useCallback(() => {
    if (!issueEmail || !issueRole) return;
    const metadataObj = issueMetadata.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);
    issueCert.mutate({
      member_email: issueEmail,
      role: issueRole,
      description: issueDescription || undefined,
      metadata: Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
    });
  }, [issueEmail, issueRole, issueDescription, issueMetadata, issueCert]);

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
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "org_ca"
      ? <Badge className="bg-blue-600">CA</Badge>
      : <Badge variant="outline" className="border-gray-600 text-gray-300">Member</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const hasCA = orgCA && !("error" in orgCA);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Certificates</h1>
          <p className="text-gray-400 text-sm mt-1">
            PKI certificate management for your organization
          </p>
        </div>
        <div className="flex gap-2">
          {hasCA && (
            <Dialog open={isIssueOpen} onOpenChange={(open) => { setIsIssueOpen(open); if (!open) setIssuedCert(null); }}>
              <DialogTrigger asChild>
                <Button className="bg-electric_indigo-500 hover:bg-electric_indigo-600">
                  <Plus className="w-4 h-4 mr-2" /> Issue Certificate
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Issue Member Certificate</DialogTitle>
                  <DialogDescription className="text-gray-400">Issue a new certificate signed by the org CA</DialogDescription>
                </DialogHeader>
                {!issuedCert ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Member Email</Label>
                      <Input value={issueEmail} onChange={(e) => setIssueEmail(e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="user@example.com" />
                    </div>
                    <div>
                      <Label className="text-gray-300">Role</Label>
                      <Input value={issueRole} onChange={(e) => setIssueRole(e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="developer" />
                    </div>
                    <div>
                      <Label className="text-gray-300">Description (optional)</Label>
                      <Input value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
                    </div>
                    <div>
                      <Label className="text-gray-300">Metadata (optional)</Label>
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
                              className="bg-gray-700 border-gray-600 text-white flex-1"
                              placeholder="Key"
                            />
                            <Input
                              value={entry.value}
                              onChange={(e) => {
                                const updated = [...issueMetadata];
                                updated[idx].value = e.target.value;
                                setIssueMetadata(updated);
                              }}
                              className="bg-gray-700 border-gray-600 text-white flex-1"
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
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
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
                      <Label className="text-gray-300">Certificate PEM</Label>
                      <Textarea value={issuedCert.cert_pem} readOnly className="bg-gray-900 border-gray-600 text-green-400 min-h-[80px] font-mono text-xs" />
                      <Button variant="ghost" size="sm" className="mt-1 text-gray-400" onClick={() => { navigator.clipboard.writeText(issuedCert.cert_pem); toast.success("Copied!"); }}>
                        <Copy className="w-3 h-3 mr-1" /> Copy Certificate
                      </Button>
                    </div>
                    <div>
                      <Label className="text-gray-300">Private Key PEM</Label>
                      <Textarea value={issuedCert.key_pem} readOnly className="bg-gray-900 border-gray-600 text-yellow-400 min-h-[80px] font-mono text-xs" />
                      <Button variant="ghost" size="sm" className="mt-1 text-gray-400" onClick={() => { navigator.clipboard.writeText(issuedCert.key_pem); toast.success("Copied!"); }}>
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
                    <Button onClick={handleIssue} disabled={issueCert.isPending} className="bg-electric_indigo-500 hover:bg-electric_indigo-600">
                      {issueCert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Issue
                    </Button>
                  ) : (
                    <Button onClick={() => { setIsIssueOpen(false); setIssuedCert(null); setIssueEmail(""); setIssueRole(""); setIssueDescription(""); setIssueMetadata([]); }} variant="outline" className="border-gray-600 text-gray-300">
                      Done
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* CA Status Card */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-electric_indigo-400" />
            Organization CA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasCA ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="text-white font-medium">{orgCA.subject_cn}</span>
                  {getStatusBadge(orgCA.status)}
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  Serial: <code className="text-gray-400">{orgCA.serial_hex}</code>
                  {" | "}
                  Created: {new Date(orgCA.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <ShieldCheck className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-3">Organization CA not initialized</p>
              <Dialog open={isInitCAOpen} onOpenChange={setIsInitCAOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-electric_indigo-500 hover:bg-electric_indigo-600">
                    Initialize CA
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-800 border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Initialize Organization CA</DialogTitle>
                    <DialogDescription className="text-gray-400">Create an intermediate CA for your organization</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-gray-300">Organization Name</Label>
                      <Input value={caOrgName} onChange={(e) => setCAOrgName(e.target.value)} className="bg-gray-700 border-gray-600 text-white" placeholder="My Organization" />
                    </div>
                    <div>
                      <Label className="text-gray-300">Description (optional)</Label>
                      <Input value={caDescription} onChange={(e) => setCADescription(e.target.value)} className="bg-gray-700 border-gray-600 text-white" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleInitCA} disabled={initCA.isPending} className="bg-electric_indigo-500 hover:bg-electric_indigo-600">
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
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            Certificates
            {certificates && certificates.length > 0 && (
              <Badge variant="secondary" className="ml-2">{certificates.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!certificates || certificates.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No certificates issued yet</p>
              <p className="text-gray-500 text-sm mt-1">
                {hasCA ? "Issue a member certificate to get started" : "Initialize the org CA first"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Subject</th>
                    <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Type</th>
                    <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Serial</th>
                    <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Status</th>
                    <th className="text-left text-gray-400 text-sm font-medium py-3 px-4">Issued</th>
                    <th className="text-right text-gray-400 text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr key={cert.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{cert.subject_cn}</div>
                        {cert.subject_email && (
                          <div className="text-gray-500 text-xs">{cert.subject_email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{getTypeBadge(cert.cert_type)}</td>
                      <td className="py-3 px-4">
                        <code className="text-gray-300 text-xs bg-gray-900 px-2 py-1 rounded font-mono">
                          {cert.serial_hex}
                        </code>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(cert.status)}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(cert.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          {cert.status === "active" && cert.cert_type !== "org_ca" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
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
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Revoke Certificate</DialogTitle>
            <DialogDescription className="text-gray-400">
              This action cannot be undone. Serial: <code>{revokeSerial}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Reason Code (RFC 5280)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={revokeReason}
                onChange={(e) => setRevokeReason(parseInt(e.target.value) || 0)}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">0=unspecified, 1=keyCompromise, 3=affiliationChanged, 4=superseded, 5=cessationOfOperation</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRevokeOpen(false)} className="border-gray-600 text-gray-300">Cancel</Button>
            <Button onClick={handleRevoke} disabled={revokeCert.isPending} variant="destructive">
              {revokeCert.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Certificates;
