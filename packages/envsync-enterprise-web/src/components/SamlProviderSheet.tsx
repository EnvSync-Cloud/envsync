import { useEffect, useState } from "react";
import type { CreateSamlProviderRequest, SamlProviderResponse } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";

import { useCreateSamlProvider, useUpdateSamlProvider } from "../api/hooks";
import { SAML_PROVIDER_TYPES, samlProviderLabel, type SamlProviderType } from "../lib/saml-sp";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Textarea } from "@shell/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

type InputMode = "metadata" | "fields";

interface FormState {
  name: string;
  provider_type: SamlProviderType;
  is_default: boolean;
  enabled: boolean;
  mode: InputMode;
  idp_metadata_xml: string;
  entity_id: string;
  sso_url: string;
  certificate: string;
}

const emptyForm = (): FormState => ({
  name: "",
  provider_type: "okta",
  is_default: false,
  enabled: true,
  mode: "metadata",
  idp_metadata_xml: "",
  entity_id: "",
  sso_url: "",
  certificate: "",
});

function formFromProvider(provider: SamlProviderResponse): FormState {
  return {
    name: provider.name,
    provider_type: provider.provider_type as SamlProviderType,
    is_default: provider.is_default,
    enabled: provider.enabled,
    mode: "metadata",
    idp_metadata_xml: "",
    entity_id: provider.entity_id,
    sso_url: provider.sso_url,
    certificate: "",
  };
}

interface SamlProviderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider?: SamlProviderResponse | null;
}

export function SamlProviderSheet({ open, onOpenChange, provider }: SamlProviderSheetProps) {
  const createProvider = useCreateSamlProvider();
  const updateProvider = useUpdateSamlProvider();
  const [form, setForm] = useState<FormState>(emptyForm);
  const editing = Boolean(provider);
  const pending = createProvider.isPending || updateProvider.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(provider ? formFromProvider(provider) : emptyForm());
  }, [open, provider]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }

    try {
      if (editing && provider) {
        const payload: Parameters<typeof updateProvider.mutateAsync>[0] = {
          id: provider.id,
          name,
          enabled: form.enabled,
          is_default: form.is_default,
        };
        if (form.mode === "metadata") {
          const xml = form.idp_metadata_xml.trim();
          if (xml) payload.idp_metadata_xml = xml;
        } else {
          if (form.entity_id.trim()) payload.entity_id = form.entity_id.trim();
          if (form.sso_url.trim()) payload.sso_url = form.sso_url.trim();
          if (form.certificate.trim()) payload.certificate = form.certificate.trim();
        }
        await updateProvider.mutateAsync(payload);
        toast.success("Identity provider updated.");
      } else {
        const payload: CreateSamlProviderRequest = {
          name,
          provider_type: form.provider_type,
          is_default: form.is_default,
        };
        if (form.mode === "metadata") {
          const xml = form.idp_metadata_xml.trim();
          if (!xml) {
            toast.error("Paste IdP metadata XML or switch to manual fields.");
            return;
          }
          payload.idp_metadata_xml = xml;
        } else {
          const entityId = form.entity_id.trim();
          const ssoUrl = form.sso_url.trim();
          const certificate = form.certificate.trim();
          if (!entityId || !ssoUrl || !certificate) {
            toast.error("Entity ID, SSO URL, and certificate are required.");
            return;
          }
          payload.entity_id = entityId;
          payload.sso_url = ssoUrl;
          payload.certificate = certificate;
        }
        await createProvider.mutateAsync(payload);
        toast.success("Identity provider added.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save identity provider.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-border bg-card sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">
            {editing ? "Edit identity provider" : "Add identity provider"}
          </SheetTitle>
          <SheetDescription className="text-tertiary">
            Paste IdP metadata XML or enter entity ID, SSO URL, and signing certificate.
            Certificates are never shown after save — only fingerprint and expiry.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm text-muted-foreground">Name</span>
            <Input
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              placeholder="Okta Production"
              className="border-border bg-card text-foreground"
            />
          </label>

          {!editing && (
            <label className="space-y-2 block">
              <span className="text-sm text-muted-foreground">Provider type</span>
              <select
                value={form.provider_type}
                onChange={(event) => setField("provider_type", event.target.value as SamlProviderType)}
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {SAML_PROVIDER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {samlProviderLabel(type)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex gap-2 rounded-lg border border-border p-1">
            <Button
              type="button"
              size="sm"
              variant={form.mode === "metadata" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setField("mode", "metadata")}
            >
              Metadata XML
            </Button>
            <Button
              type="button"
              size="sm"
              variant={form.mode === "fields" ? "default" : "ghost"}
              className="flex-1"
              onClick={() => setField("mode", "fields")}
            >
              Manual fields
            </Button>
          </div>

          {form.mode === "metadata" ? (
            <label className="space-y-2 block">
              <span className="text-sm text-muted-foreground">
                {editing ? "Replace IdP metadata XML (optional)" : "IdP metadata XML"}
              </span>
              <Textarea
                value={form.idp_metadata_xml}
                onChange={(event) => setField("idp_metadata_xml", event.target.value)}
                placeholder={'<EntityDescriptor entityID="...">...</EntityDescriptor>'}
                className="min-h-[180px] border-border bg-card text-foreground font-mono text-xs"
              />
            </label>
          ) : (
            <>
              <label className="space-y-2 block">
                <span className="text-sm text-muted-foreground">IdP entity ID</span>
                <Input
                  value={form.entity_id}
                  onChange={(event) => setField("entity_id", event.target.value)}
                  placeholder="http://www.okta.com/exk123456789"
                  className="border-border bg-card text-foreground"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-sm text-muted-foreground">IdP SSO URL</span>
                <Input
                  value={form.sso_url}
                  onChange={(event) => setField("sso_url", event.target.value)}
                  placeholder="https://example.okta.com/app/abc123/sso/saml"
                  className="border-border bg-card text-foreground"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-sm text-muted-foreground">
                  {editing ? "Replace certificate PEM (optional)" : "IdP certificate (PEM)"}
                </span>
                <Textarea
                  value={form.certificate}
                  onChange={(event) => setField("certificate", event.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  className="min-h-[120px] border-border bg-card text-foreground font-mono text-xs"
                />
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(event) => setField("is_default", event.target.checked)}
            />
            Set as default IdP for this organization
          </label>

          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setField("enabled", event.target.checked)}
              />
              Enabled
            </label>
          )}

          <SheetFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="bg-emerald-600 text-foreground hover:bg-emerald-700"
            >
              {pending ? "Saving…" : editing ? "Save changes" : "Add IdP"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
