import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Download, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function copyToClipboard(value: string, label: string) {
  navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
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

function getStatusTone(status?: string) {
  return status?.toLowerCase() === "active"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-500/20"
    : "bg-white/[0.06] text-foreground ring-1 ring-white/10";
}

function getSerialPreview(serial?: string) {
  if (!serial) return "Unavailable";
  if (serial.length <= 18) return serial;
  return `${serial.slice(0, 10)}...${serial.slice(-8)}`;
}

export const MyCertificatesCard = () => {
  const { data, isLoading, error } = api.certificates.getMyCertificateBundle();
  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState(false);

  const bundleText = useMemo(() => {
    if (!data) return "";

    return [
      "# EnvSync certificate bundle",
      "",
      data.root_ca_pem,
      "",
      data.member_certificate.cert_pem ?? "",
      "",
      data.member_certificate.key_pem,
    ].join("\n");
  }, [data]);

  return (
    <Card className="border-border bg-card/70">
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 ring-1 ring-emerald-500/20">
            <ShieldCheck className="size-5 text-emerald-400" />
          </div>
          <div>
            <CardTitle className="text-base text-foreground">My Certificates</CardTitle>
            <p className="text-sm text-muted-foreground">Managed certificate bundle.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading certificate bundle...
          </div>
        ) : error || !data ? (
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
            Certificate bundle unavailable right now.
          </div>
        ) : (
          <>
            <div className="space-y-3 rounded-2xl border border-border bg-card/70 p-4">
              <div data-testid="my-certs-status-row" className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border-0 px-2.5 py-1 font-medium", getStatusTone(data.member_certificate.status))}>
                    {data.member_certificate.status}
                  </Badge>
                  <Badge variant="secondary" className="bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-200">
                    {data.member_certificate.metadata?.role_name ?? "System"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">{getSerialPreview(data.member_certificate.serial_hex)}</div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  data-testid="my-certs-copy-bundle"
                  variant="outline"
                  className="justify-start border-border text-foreground hover:bg-muted"
                  onClick={() => copyToClipboard(bundleText, "Certificate bundle")}
                >
                  <Copy className="mr-2 size-4" />
                  Copy bundle
                </Button>
                <Button
                  data-testid="my-certs-download-bundle"
                  variant="outline"
                  className="justify-start border-border text-foreground hover:bg-muted"
                  onClick={() => downloadText("envsync-certificate-bundle.pem", bundleText)}
                >
                  <Download className="mr-2 size-4" />
                  Download bundle
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-border text-foreground hover:bg-muted"
                  onClick={() => copyToClipboard(data.member_certificate.cert_pem ?? "", "Member certificate")}
                >
                  <Copy className="mr-2 size-4" />
                  Copy cert
                </Button>
                <Button
                  variant="outline"
                  className="justify-start border-border text-foreground hover:bg-muted"
                  onClick={() => downloadText("envsync-root-ca.pem", data.root_ca_pem)}
                >
                  <Download className="mr-2 size-4" />
                  Download CA
                </Button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-300" />
                  <span>Private key stays hidden until revealed.</span>
                </div>
              </div>
            </div>

            <Accordion type="multiple" className="space-y-3">
              {[
                { label: "Root CA", value: data.root_ca_pem, filename: "envsync-root-ca.pem" },
                { label: "Member Cert", value: data.member_certificate.cert_pem ?? "", filename: "envsync-member-cert.pem" },
                { label: "Private Key", value: data.member_certificate.key_pem, filename: "envsync-member-key.pem", isSensitive: true },
              ].map((entry) => {
                const isHiddenSensitiveSection = entry.isSensitive && !isPrivateKeyVisible;

                return (
                  <AccordionItem
                    key={entry.label}
                    value={entry.label}
                    data-testid={
                      entry.label === "Root CA"
                        ? "my-certs-section-root-ca"
                        : entry.label === "Member Cert"
                          ? "my-certs-section-member-cert"
                          : "my-certs-section-private-key"
                    }
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-card/70 px-4",
                      entry.isSensitive ? "border-amber-500/20" : "border-border"
                    )}
                  >
                    <AccordionTrigger className="py-4 text-left hover:no-underline">
                      <div className="flex min-w-0 items-center gap-2 pr-4">
                        <p className="text-sm font-medium text-foreground">{entry.label}</p>
                        {entry.isSensitive ? (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-200 ring-1 ring-amber-500/20">Sensitive</Badge>
                        ) : null}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {entry.isSensitive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-500/30 text-amber-800 dark:text-amber-100 hover:bg-amber-500/10"
                            onClick={() => setIsPrivateKeyVisible((visible) => !visible)}
                          >
                            {isPrivateKeyVisible ? (
                              <>
                                <EyeOff className="mr-2 size-3.5" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 size-3.5" />
                                Reveal
                              </>
                            )}
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-muted-foreground hover:bg-muted"
                          onClick={() => copyToClipboard(entry.value, entry.label)}
                        >
                          <Copy className="mr-2 size-3" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-muted-foreground hover:bg-muted"
                          onClick={() => downloadText(entry.filename, entry.value)}
                        >
                          <Download className="mr-2 size-3" />
                          Download
                        </Button>
                      </div>

                      {isHiddenSensitiveSection ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 dark:text-amber-100">
                          Reveal on trusted devices only.
                        </div>
                      ) : (
                        <Textarea
                          readOnly
                          value={entry.value}
                          className={cn(
                            "min-h-[140px] font-mono text-xs text-muted-foreground",
                            entry.isSensitive ? "border-amber-500/20 bg-card/80" : "border-border bg-card"
                          )}
                        />
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
};
