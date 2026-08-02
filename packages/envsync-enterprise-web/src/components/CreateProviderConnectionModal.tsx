import { useState, useEffect } from "react";
import { toast } from "sonner";

import {
  useCreateProviderConnection,
  useOrgSecrets,
} from "../api/hooks";
import type { EnterpriseProvider } from "../api/types";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import { Textarea } from "@shell/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";
import {
  emptyFieldValues,
  enterpriseProviderUi,
  mergeFieldValuesIntoRecord,
  type ProviderFieldConfig,
} from "../lib/enterprise-provider-ui";

type FieldState = Record<string, string>;

function FieldHint({ text }: { text?: string }) {
  if (!text) return null;
  return <p className="text-xs text-tertiary">{text}</p>;
}

function ProviderFieldEditor({
  field,
  value,
  onChange,
  secretOptions = [],
}: {
  field: ProviderFieldConfig;
  value: string;
  onChange: (value: string) => void;
  secretOptions?: string[];
}) {
  const commonClassName = "flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground";
  const listId = `${field.key}-secret-options`;

  return (
    <label className="space-y-2">
      <span className="text-sm text-muted-foreground">{field.label}</span>
      {field.kind === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={commonClassName}
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            list={field.kind === "secret-ref" ? listId : undefined}
          />
          {field.kind === "secret-ref" && secretOptions.length > 0 && (
            <datalist id={listId}>
              {secretOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
        </>
      )}
      <FieldHint text={field.helper} />
    </label>
  );
}

interface CreateProviderConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerFilter?: EnterpriseProvider;
}

export function CreateProviderConnectionModal({
  open,
  onOpenChange,
  providerFilter,
}: CreateProviderConnectionModalProps) {
  const createProviderConnection = useCreateProviderConnection();
  const { data: orgSecrets = [] } = useOrgSecrets();
  const orgSecretKeys = orgSecrets.map((secret) => secret.key);

  const [form, setForm] = useState({
    provider_type: providerFilter ?? ("github" as EnterpriseProvider),
    name: "",
    status: "active" as "active" | "inactive" | "error",
    authFields: emptyFieldValues(enterpriseProviderUi[providerFilter ?? "github"].connectionAuthFields),
    metadataFields: emptyFieldValues(enterpriseProviderUi[providerFilter ?? "github"].connectionMetadataFields),
    authRaw: "{}",
    metadataRaw: "{}",
  });

  const providerConfig = enterpriseProviderUi[form.provider_type];

  useEffect(() => {
    if (!open) return;
    const defaultProvider = providerFilter ?? "github";
    setForm({
      provider_type: defaultProvider,
      name: "",
      status: "active",
      authFields: emptyFieldValues(enterpriseProviderUi[defaultProvider].connectionAuthFields),
      metadataFields: emptyFieldValues(enterpriseProviderUi[defaultProvider].connectionMetadataFields),
      authRaw: "{}",
      metadataRaw: "{}",
    });
  }, [open, providerFilter]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createProviderConnection.mutateAsync({
        provider_type: form.provider_type,
        name: form.name,
        status: form.status,
        auth_config: mergeFieldValuesIntoRecord(
          providerConfig.connectionAuthFields,
          form.authFields,
          JSON.parse(form.authRaw) as Record<string, unknown>,
        ),
        metadata: mergeFieldValuesIntoRecord(
          providerConfig.connectionMetadataFields,
          form.metadataFields,
          JSON.parse(form.metadataRaw) as Record<string, unknown>,
        ),
      });
      toast.success("Provider connection created.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create provider connection.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-border bg-card sm:max-w-lg overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Create Provider Connection</SheetTitle>
          <SheetDescription className="text-tertiary">
            {providerConfig.providerHeadline}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {!providerFilter && (
            <label className="space-y-2">
              <span className="text-sm text-muted-foreground">Provider</span>
              <select
                value={form.provider_type}
                onChange={(event) =>
                  setForm({
                    provider_type: event.target.value as EnterpriseProvider,
                    name: "",
                    status: "active",
                    authFields: emptyFieldValues(enterpriseProviderUi[event.target.value as EnterpriseProvider].connectionAuthFields),
                    metadataFields: emptyFieldValues(enterpriseProviderUi[event.target.value as EnterpriseProvider].connectionMetadataFields),
                    authRaw: "{}",
                    metadataRaw: "{}",
                  })
                }
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {Object.values(enterpriseProviderUi).map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Connection name</span>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder={`${providerConfig.name} production`}
              className="border-border bg-card text-foreground"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "active" | "inactive" | "error" }))}
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="error">error</option>
            </select>
          </label>

          <div className="space-y-3">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wider">Auth fields</p>
            {providerConfig.connectionAuthFields.map((field) => (
              <ProviderFieldEditor
                key={field.key}
                field={field}
                value={form.authFields[field.key] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    authFields: { ...prev.authFields, [field.key]: value },
                  }))
                }
                secretOptions={field.kind === "secret-ref" ? orgSecretKeys : []}
              />
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-tertiary uppercase tracking-wider">Metadata fields</p>
            {providerConfig.connectionMetadataFields.map((field) => (
              <ProviderFieldEditor
                key={field.key}
                field={field}
                value={form.metadataFields[field.key] ?? ""}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    metadataFields: { ...prev.metadataFields, [field.key]: value },
                  }))
                }
              />
            ))}
          </div>

          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced JSON</summary>
            <div className="mt-3 grid gap-3">
              <label className="space-y-1.5">
                <span className="text-xs text-tertiary">Additional auth config</span>
                <Textarea
                  value={form.authRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, authRaw: event.target.value }))}
                  className="min-h-[80px] border-border bg-card text-foreground font-mono text-xs"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs text-tertiary">Additional metadata</span>
                <Textarea
                  value={form.metadataRaw}
                  onChange={(event) => setForm((prev) => ({ ...prev, metadataRaw: event.target.value }))}
                  className="min-h-[80px] border-border bg-card text-foreground font-mono text-xs"
                />
              </label>
            </div>
          </details>

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
              disabled={createProviderConnection.isPending}
              className="bg-emerald-600 text-foreground hover:bg-emerald-700"
            >
              {createProviderConnection.isPending ? "Creating..." : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
