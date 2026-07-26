import { useState, useCallback } from "react";
import {
  KeyRound,
  Plus,
  Upload,
  Trash2,
  Ban,
  PenLine,
  CheckCircle,
  XCircle,
  Copy,
  Loader2,
  RefreshCcw,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import type { GpgKey } from "@/api/gpg-keys.api";
import { GenerateGpgKeyRequest, SignDataRequest } from "@envsync-cloud/envsync-ts-sdk";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const GpgKeys = () => {
  const { data: gpgKeys, isLoading } = api.gpgKeys.getGpgKeys();

  // Generate key dialog
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [genForm, setGenForm] = useState<GenerateGpgKeyRequest>({
    name: "",
    email: "",
    algorithm: GenerateGpgKeyRequest.algorithm.ECC_CURVE25519,
    usage_flags: ["sign"],
    expires_in_days: 365,
  });

  // Import key dialog
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importPublicKey, setImportPublicKey] = useState("");
  const [importPrivateKey, setImportPrivateKey] = useState("");
  const [importPassphrase, setImportPassphrase] = useState("");

  // Sign dialog
  const [isSignOpen, setIsSignOpen] = useState(false);
  const [signKeyId, setSignKeyId] = useState("");
  const [signData, setSignData] = useState("");
  const [signMode, setSignMode] = useState<SignDataRequest.mode>(SignDataRequest.mode.TEXT);
  const signDetached = true;
  const [signResult, setSignResult] = useState("");

  // Verify dialog
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyData, setVerifyData] = useState("");
  const [verifySignature, setVerifySignature] = useState("");
  const [verifyKeyId, setVerifyKeyId] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; signer_fingerprint: string | null } | null>(null);

  // Mutations
  const generateKey = api.gpgKeys.generateGpgKey({
    onSuccess: () => {
      toast.success("GPG key generated successfully");
      setIsGenerateOpen(false);
      setGenForm({ name: "", email: "", algorithm: GenerateGpgKeyRequest.algorithm.ECC_CURVE25519, usage_flags: ["sign"], expires_in_days: 365 });
    },
    onError: ({ error }) => toast.error(error.message || "Failed to generate key"),
  });

  const importKey = api.gpgKeys.importGpgKey({
    onSuccess: () => {
      toast.success("GPG key imported successfully");
      setIsImportOpen(false);
      setImportName("");
      setImportPublicKey("");
      setImportPrivateKey("");
      setImportPassphrase("");
    },
    onError: ({ error }) => toast.error(error.message || "Failed to import key"),
  });

  const deleteKey = api.gpgKeys.deleteGpgKey({
    onSuccess: () => toast.success("GPG key deleted"),
    onError: ({ error }) => toast.error(error.message || "Failed to delete key"),
  });

  const revokeKey = api.gpgKeys.revokeGpgKey({
    onSuccess: () => toast.success("GPG key revoked"),
    onError: ({ error }) => toast.error(error.message || "Failed to revoke key"),
  });

  const signMutation = api.gpgKeys.signData({
    onSuccess: ({ data }) => setSignResult(data.signature),
    onError: ({ error }) => toast.error(error.message || "Failed to sign data"),
  });

  const verifyMutation = api.gpgKeys.verifySignature({
    onSuccess: ({ data }) => setVerifyResult(data),
    onError: ({ error }) => toast.error(error.message || "Failed to verify signature"),
  });
  const rotateKey = api.gpgKeys.rotateGpgKey({
    onSuccess: () => {
      toast.success("GPG key rotated");
    },
    onError: ({ error }) => toast.error(error.message || "Failed to rotate key"),
  });
  const extendExpiry = api.gpgKeys.extendExpiry({
    onSuccess: () => {
      toast.success("Expiry extended");
    },
    onError: ({ error }) => toast.error(error.message || "Failed to extend expiry"),
  });

  const handleGenerate = useCallback(() => {
    if (!genForm.name || !genForm.email) return;
    generateKey.mutate(genForm);
  }, [genForm, generateKey]);

  const handleImport = useCallback(() => {
    if (!importName || !importPublicKey) return;
    importKey.mutate({
      name: importName,
      armored_public_key: importPublicKey,
      armored_private_key: importPrivateKey || undefined,
      passphrase: importPassphrase || undefined,
    });
  }, [importName, importPublicKey, importPrivateKey, importPassphrase, importKey]);

  const handleSign = useCallback(() => {
    if (!signKeyId || !signData) return;
    signMutation.mutate({
      gpg_key_id: signKeyId,
      data: btoa(signData),
      mode: signMode,
      detached: signDetached,
    });
  }, [signKeyId, signData, signMode, signDetached, signMutation]);

  const handleVerify = useCallback(() => {
    if (!verifyData || !verifySignature) return;
    verifyMutation.mutate({
      data: btoa(verifyData),
      signature: verifySignature,
      gpg_key_id: verifyKeyId || undefined,
    });
  }, [verifyData, verifySignature, verifyKeyId, verifyMutation]);

  const truncateFingerprint = (fp: string) => {
    if (!fp || fp.length < 16) return fp;
    return `${fp.slice(0, 4)} ... ${fp.slice(-8)}`;
  };

  const getStatusBadge = (key: GpgKey) => {
    const lifecycle = (key as GpgKey & { status?: string }).status;
    if (lifecycle === "superseded") return <Badge className="bg-blue-600">Superseded</Badge>;
    if (key.revoked_at || lifecycle === "revoked") return <Badge variant="destructive">Revoked</Badge>;
    if (key.expires_at && new Date(key.expires_at) < new Date())
      return <Badge className="bg-yellow-600">Expired</Badge>;
    if (key.expires_at && new Date(key.expires_at).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000)
      return <Badge className="bg-amber-600">Expiring</Badge>;
    return <Badge className="bg-emerald-600">Active</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
            <KeyRound className="size-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">GPG Keys</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage GPG keys for signing and verification
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Sign Dialog */}
          <Dialog open={isSignOpen} onOpenChange={setIsSignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted">
                <PenLine className="w-4 h-4 mr-2" /> Sign
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-muted border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Sign Data</DialogTitle>
                <DialogDescription className="text-muted-foreground">Sign data using a GPG key</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Key</Label>
                  <Select value={signKeyId} onValueChange={setSignKeyId}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder="Select a key" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      {gpgKeys?.filter((k) => !k.revoked_at).map((k) => (
                        <SelectItem key={k.id} value={k.id} className="text-foreground">{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <Textarea
                    value={signData}
                    onChange={(e) => setSignData(e.target.value)}
                    className="bg-muted border-border text-foreground min-h-[100px]"
                    placeholder="Enter data to sign..."
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-muted-foreground">Mode</Label>
                    <Select value={signMode} onValueChange={(v) => setSignMode(v as SignDataRequest.mode)}>
                      <SelectTrigger className="bg-muted border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        <SelectItem value="text" className="text-foreground">Text</SelectItem>
                        <SelectItem value="binary" className="text-foreground">Binary</SelectItem>
                        <SelectItem value="clearsign" className="text-foreground">Clearsign</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {signResult && (
                  <div>
                    <Label className="text-muted-foreground">Signature</Label>
                    <Textarea
                      value={signResult}
                      readOnly
                      className="bg-card border-border text-green-400 min-h-[100px] font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-muted-foreground"
                      onClick={() => { navigator.clipboard.writeText(signResult); toast.success("Copied!"); }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSign} disabled={signMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                  {signMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Verify Dialog */}
          <Dialog open={isVerifyOpen} onOpenChange={(open) => { setIsVerifyOpen(open); if (!open) setVerifyResult(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted">
                <CheckCircle className="w-4 h-4 mr-2" /> Verify
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-muted border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Verify Signature</DialogTitle>
                <DialogDescription className="text-muted-foreground">Verify a GPG signature against data</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Data</Label>
                  <Textarea
                    value={verifyData}
                    onChange={(e) => setVerifyData(e.target.value)}
                    className="bg-muted border-border text-foreground min-h-[80px]"
                    placeholder="Original data..."
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Signature</Label>
                  <Textarea
                    value={verifySignature}
                    onChange={(e) => setVerifySignature(e.target.value)}
                    className="bg-muted border-border text-foreground min-h-[80px] font-mono text-xs"
                    placeholder="-----BEGIN PGP SIGNATURE-----..."
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Key (optional)</Label>
                  <Select value={verifyKeyId} onValueChange={setVerifyKeyId}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      {gpgKeys?.map((k) => (
                        <SelectItem key={k.id} value={k.id} className="text-foreground">{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {verifyResult && (
                  <div className={`p-3 rounded-lg ${verifyResult.valid ? "bg-emerald-900/30 border border-emerald-700" : "bg-red-900/30 border border-red-700"}`}>
                    <div className="flex items-center gap-2">
                      {verifyResult.valid ? (
                        <><CheckCircle className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400 font-medium">Valid Signature</span></>
                      ) : (
                        <><XCircle className="w-5 h-5 text-red-400" /><span className="text-red-400 font-medium">Invalid Signature</span></>
                      )}
                    </div>
                    {verifyResult.signer_fingerprint && (
                      <p className="text-xs text-muted-foreground mt-1">Signer: <span className="font-mono">{verifyResult.signer_fingerprint}</span></p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleVerify} disabled={verifyMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                  {verifyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Import Dialog */}
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted">
                <Upload className="w-4 h-4 mr-2" /> Import
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-muted border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Import GPG Key</DialogTitle>
                <DialogDescription className="text-muted-foreground">Import an existing GPG key</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <Input value={importName} onChange={(e) => setImportName(e.target.value)} className="bg-muted border-border text-foreground" placeholder="Key name" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Public Key (armored)</Label>
                  <Textarea value={importPublicKey} onChange={(e) => setImportPublicKey(e.target.value)} className="bg-muted border-border text-foreground min-h-[100px] font-mono text-xs" placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..." />
                </div>
                <div>
                  <Label className="text-muted-foreground">Private Key (optional, armored)</Label>
                  <Textarea value={importPrivateKey} onChange={(e) => setImportPrivateKey(e.target.value)} className="bg-muted border-border text-foreground min-h-[80px] font-mono text-xs" placeholder="-----BEGIN PGP PRIVATE KEY BLOCK-----..." />
                </div>
                {importPrivateKey && (
                  <div>
                    <Label className="text-muted-foreground">Passphrase (if key is encrypted)</Label>
                    <Input type="password" value={importPassphrase} onChange={(e) => setImportPassphrase(e.target.value)} className="bg-muted border-border text-foreground" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleImport} disabled={importKey.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                  {importKey.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Generate Dialog */}
          <Dialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600">
                <Plus className="w-4 h-4 mr-2" /> Generate Key
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-muted border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Generate GPG Key</DialogTitle>
                <DialogDescription className="text-muted-foreground">Generate a new GPG key pair</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Name</Label>
                  <Input value={genForm.name} onChange={(e) => setGenForm((f) => ({ ...f, name: e.target.value }))} className="bg-muted border-border text-foreground" placeholder="My Signing Key" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <Input value={genForm.email} onChange={(e) => setGenForm((f) => ({ ...f, email: e.target.value }))} className="bg-muted border-border text-foreground" placeholder="dev@example.com" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Algorithm</Label>
                  <Select value={genForm.algorithm} onValueChange={(v) => setGenForm((f) => ({ ...f, algorithm: v as GenerateGpgKeyRequest.algorithm }))}>
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted border-border">
                      <SelectItem value="ecc-curve25519" className="text-foreground">ECC Curve25519</SelectItem>
                      <SelectItem value="ecc-p256" className="text-foreground">ECC P-256</SelectItem>
                      <SelectItem value="ecc-p384" className="text-foreground">ECC P-384</SelectItem>
                      <SelectItem value="rsa" className="text-foreground">RSA 4096</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expires in (days)</Label>
                  <Input type="number" value={genForm.expires_in_days || ""} onChange={(e) => setGenForm((f) => ({ ...f, expires_in_days: parseInt(e.target.value) || undefined }))} className="bg-muted border-border text-foreground" placeholder="365" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleGenerate} disabled={generateKey.isPending} className="bg-emerald-500 hover:bg-emerald-600">
                  {generateKey.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Keys Table */}
      <Card className="bg-card text-card-foreground bg-gradient-to-br from-card to-card border-border/80 shadow-xl rounded-xl">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center">
            <KeyRound className="w-5 h-5 mr-2 text-emerald-400" />
            Keys
            {gpgKeys && gpgKeys.length > 0 && (
              <Badge variant="secondary" className="ml-2">{gpgKeys.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!gpgKeys || gpgKeys.length === 0 ? (
            <div className="text-center py-12">
              <KeyRound className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No GPG keys yet</p>
              <p className="text-tertiary text-sm mt-1">Generate or import a key to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Name</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Fingerprint</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Algorithm</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Usage</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Status</th>
                    <th className="text-left text-muted-foreground text-sm font-medium py-3 px-4">Created</th>
                    <th className="text-right text-muted-foreground text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {gpgKeys.map((key) => (
                    <tr key={key.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-foreground font-medium">{key.name}</div>
                        <div className="text-tertiary text-xs">{key.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-muted-foreground text-xs bg-card px-2 py-1 rounded font-mono">
                          {truncateFingerprint(key.fingerprint)}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">{key.algorithm}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {(key.usage_flags || []).map((flag) => (
                            <Badge key={flag} variant="outline" className="text-xs border-border text-muted-foreground">{flag}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(key)}</td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              navigator.clipboard.writeText(key.fingerprint);
                              toast.success("Fingerprint copied!");
                            }}
                            title="Copy fingerprint"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          {!key.revoked_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-400 hover:text-blue-300"
                              onClick={() =>
                                rotateKey.mutate({
                                  id: key.id,
                                  payload: { expires_in_days: 365, set_new_default: true },
                                })
                              }
                              title="Rotate key"
                            >
                              <RefreshCcw className="w-4 h-4" />
                            </Button>
                          )}
                          {!key.revoked_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-cyan-400 hover:text-cyan-300"
                              onClick={() => extendExpiry.mutate({ id: key.id, expires_in_days: 90 })}
                              title="Extend expiry"
                            >
                              <Clock3 className="w-4 h-4" />
                            </Button>
                          )}
                          {!key.revoked_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-yellow-400 hover:text-yellow-300"
                              onClick={() => revokeKey.mutate({ id: key.id, reason: "No longer needed" })}
                              title="Revoke"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => deleteKey.mutate(key.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
    </div>
  );
};

export default GpgKeys;
